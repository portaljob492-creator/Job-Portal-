import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      try {
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, 'utf8');
          const envPayload = {
            VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://qwaehqsmodekbgvnaavz.supabase.co',
            VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
            VITE_SUPABASE_STORAGE_KEY: process.env.VITE_SUPABASE_STORAGE_KEY || '',
          };
          const envScript = `<script id="__RUNTIME_ENV__">window.__ENV__ = ${JSON.stringify(envPayload)};</script>`;
          if (html.includes('</head>')) {
            html = html.replace('</head>', `${envScript}</head>`);
          } else {
            html = `${envScript}${html}`;
          }
          res.send(html);
          return;
        }
      } catch (err) {
        console.error('Failed to inject runtime env into index.html:', err);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
