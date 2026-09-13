import express from "express";
import fs from "fs";
import path from "path";
// Loads `.env` into `process.env` for the runtime-injection below (no-op when
// the file is absent, e.g. on hosts that provide real environment variables).
// Build-time `VITE_*` values baked into the bundle still take precedence.
import "dotenv/config";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { logger } from "./src/lib/logger";

const serverLog = logger("server");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

/** Reads a server-side env var, accepting `VITE_*` first then plain aliases. */
function readServerEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isPlaceholderEnvValue(value: string): boolean {
  if (!value) return true;
  return /^(your[_-].*|.*placeholder.*|<.*>|\{\{.*\}\}|changeme|replace[_-]me|todo|x{3,})$/i.test(value);
}

interface RuntimeEnvPayload {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_STORAGE_KEY?: string;
}

/**
 * Runtime env for the browser, injected into every served index.html by this
 * server. It lets Docker/VM/express hosts configure Supabase purely via server
 * environment variables WITHOUT rebuilding the bundle: the client prefers
 * build-time `import.meta.env` values when usable and falls back to this
 * injection otherwise (see `src/lib/supabase.ts`).
 *
 * Static hosts without this server (e.g. Vercel) rely solely on build-time
 * `VITE_*` variables baked in by Vite — set those in the host's dashboard.
 */
function resolveRuntimeEnv(): RuntimeEnvPayload {
  const url = readServerEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = readServerEnv(
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const storageKey = readServerEnv("VITE_SUPABASE_STORAGE_KEY", "SUPABASE_STORAGE_KEY");
  return {
    ...(url && !isPlaceholderEnvValue(url) ? { VITE_SUPABASE_URL: url } : {}),
    ...(anonKey && !isPlaceholderEnvValue(anonKey) ? { VITE_SUPABASE_ANON_KEY: anonKey } : {}),
    ...(storageKey ? { VITE_SUPABASE_STORAGE_KEY: storageKey } : {}),
  };
}

function buildRuntimeEnvScript(payload: RuntimeEnvPayload): string {
  // `<` is unicode-escaped so a crafted value can never break out of the script tag.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<script>window.__NEXORA_RUNTIME_ENV__=${json};</script>`;
}

function logRuntimeEnvSummary(payload: RuntimeEnvPayload): void {
  const urlState = payload.VITE_SUPABASE_URL
    ? "present"
    : "MISSING (client uses build-time value, else the canonical URL fallback)";
  const keyState = payload.VITE_SUPABASE_ANON_KEY
    ? `present (len ${payload.VITE_SUPABASE_ANON_KEY.length})`
    : "MISSING (client uses build-time VITE_SUPABASE_ANON_KEY, else demo mode)";
  serverLog.info(`Supabase runtime env for browser injection — URL: ${urlState}; anon key: ${keyState}.`);
}

// ---------------------------------------------------------------------------
// Standard API errors: action-oriented, information-hiding, request-correlated.
// Every API failure returns `{ error: { code, message, requestId } }` while the
// full structured record (stack, upstream context) goes to stderr only.
// ---------------------------------------------------------------------------

type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "ai_unavailable"
  | "ai_upstream_error"
  | "internal_error";

function requestIdOf(req: express.Request): string {
  return (req as express.Request & { requestId?: string }).requestId ?? "unknown";
}

function sendApiError(
  req: express.Request,
  res: express.Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  cause?: unknown,
): void {
  const requestId = requestIdOf(req);
  logger("api", { requestId }).error(`${req.method} ${req.originalUrl} failed`, cause, {
    status,
    code,
  });
  res.status(status).json({ error: { code, message, requestId } });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Correlation id for every request: returned to the caller (`x-request-id`)
  // and attached to every log record, so a client-facing error can be traced
  // back to its full debugging history.
  app.use((req, res, next) => {
    const requestId = randomUUID().slice(0, 8);
    (req as express.Request & { requestId?: string }).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const startedAt = Date.now();
    res.on("finish", () => {
      logger("http", { requestId }).info(`${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });

  app.use(express.json());

  const runtimeEnv = resolveRuntimeEnv();
  logRuntimeEnvSummary(runtimeEnv);

  // Health routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health/supabase", async (req, res) => {
    const url = (process.env.VITE_SUPABASE_URL || 'https://qwaehqsmodekbgvnaavz.supabase.co').replace(/\/+$/, '');
    const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    const hasValidKey = Boolean(anonKey && anonKey.startsWith('eyJ') && anonKey.split('.').length === 3);

    if (!hasValidKey) {
      return res.status(503).json({
        ok: false,
        configured: false,
        message: "Supabase environment variables missing or invalid in server runtime",
        url,
        hasAnonKey: Boolean(anonKey),
      });
    }

    try {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const start = Date.now();
      const { data, error } = await client.from('public_job_listings').select('id').limit(1);
      const latencyMs = Date.now() - start;

      if (error) {
        return res.status(502).json({
          ok: false,
          configured: true,
          message: `Supabase query error: ${error.message}`,
          url,
          latencyMs,
        });
      }

      return res.json({
        ok: true,
        configured: true,
        message: "Supabase client initialized and connected successfully",
        url,
        latencyMs,
        recordsReturned: data?.length ?? 0,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        configured: true,
        message: `Failed to initialize or connect to Supabase: ${err?.message}`,
      });
    }
  });

  // API routes
  app.post("/api/news", async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      sendApiError(
        req, res, 503, "ai_unavailable",
        "Trend service is not configured. Please try again later.",
      );
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "What are the latest beauty industry news and trends? Please provide a concise summary.",
        config: {
            tools: [{ googleSearch: {} }],
        }
      });
      res.json({ news: response.text });
    } catch (error) {
      // Upstream AI failure: 502 (not 500) so callers can tell "dependency is
      // down, retry later" apart from "our server is broken".
      sendApiError(
        req, res, 502, "ai_upstream_error",
        "Trend service is temporarily unavailable. Please try again later.",
        error,
      );
    }
  });

  // Unknown API endpoints answer JSON (never the SPA shell), so fetch callers
  // can rely on the error envelope instead of crashing on HTML.
  app.use("/api", (req, res) => {
    sendApiError(req, res, 404, "not_found", "Unknown API endpoint.");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // `index: false` so `/` also flows through the injection handler below
    // instead of being served raw by the static middleware.
    app.use(express.static(distPath, { index: false }));
    const runtimeScript = buildRuntimeEnvScript(runtimeEnv);
    let cachedIndexHtml: string | null = null;
    const getIndexHtml = (): string => {
      if (!cachedIndexHtml) {
        const raw = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
        // Module scripts are deferred, so an inline classic script anywhere in
        // <head> is guaranteed to run before the client bundle reads it.
        cachedIndexHtml = raw.includes('</head>')
          ? raw.replace('</head>', `${runtimeScript}</head>`)
          : `${runtimeScript}${raw}`;
      }
      return cachedIndexHtml;
    };
    app.get('*', (req, res) => {
      res.type('html').send(getIndexHtml());
    });
  }

  // Final safety net: malformed JSON bodies become 400s, anything else becomes
  // a generic 500 envelope. Internal details never leave the server.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const status =
      typeof error === "object" && error !== null && "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? ((error as { status: number }).status as number)
        : 500;
    if (status === 400) {
      sendApiError(req, res, 400, "bad_request", "Invalid request body.", error);
      return;
    }
    sendApiError(
      req, res, 500, "internal_error",
      "Something went wrong on our side. Please try again later.",
      error,
    );
  });

  app.listen(PORT, "0.0.0.0", () => {
    serverLog.info(`Server running on http://localhost:${PORT}`, { port: PORT });
  });
}

startServer();
