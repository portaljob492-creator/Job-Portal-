/**
 * Structured, leveled, sanitizing logger — the single logging interface for the
 * app, the express server, and the service worker.
 *
 * Debugging-log principles applied here (see `docs/logging-and-errors.md`):
 *
 * - **Contextual history:** every record carries a timestamp, level, scope and
 *   optional `requestId`, so a failure can be traced back through the events
 *   that led to it. Server requests get a correlation id via middleware.
 * - **Security & privacy sensitive:** everything is deep-sanitized before it is
 *   emitted — secret-shaped keys, JWTs, `sb_secret_*` keys and email addresses
 *   are redacted/masked, so records are safe to push to storage.
 * - **Structured data:** production output is one JSON object per line
 *   (`{ ts, level, scope, msg, requestId, data, err }`); development output is
 *   a compact human-readable line.
 *
 * What this module is NOT: it never decides user-facing copy. Standard errors
 * (action-oriented, information-hiding) live in `mapBackendError` /
 * `mapAuthError` / `toSafeMessage` and the server's API error envelope.
 *
 * Environment-safe: no Node imports, `import.meta.env`/`process` access is
 * guarded, so this file also bundles into the service worker.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  stack?: string;
}

export interface LogRecord {
  ts: string;
  level: LogLevel;
  scope: string;
  msg: string;
  requestId?: string;
  data?: unknown;
  err?: SerializedError;
}

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  /** `err` is serialized (message + code, stack only where allowed) and sanitized. */
  error(msg: string, err?: unknown, data?: unknown): void;
  /** Derive a logger that merges extra context (e.g. `{ requestId }`) into every record. */
  child(context: Record<string, unknown>): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function readEnv(name: string): string {
  try {
    const viteEnv =
      typeof import.meta !== 'undefined'
        ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? {})
        : {};
    const fromVite = viteEnv[name] ?? viteEnv[name.replace(/^LOG_/, 'VITE_LOG_')];
    if (typeof fromVite === 'string' && fromVite) return fromVite;
  } catch {
    /* non-Vite runtime */
  }
  try {
    const nodeEnv =
      typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {};
    // Accept both `LOG_LEVEL` and `VITE_LOG_LEVEL` so one name works everywhere.
    const value = nodeEnv[name] ?? nodeEnv[name.replace(/^VITE_/, '')] ?? nodeEnv[`VITE_${name}`];
    if (typeof value === 'string' && value) return value;
  } catch {
    /* browser without process shim */
  }
  return '';
}

function resolveLevel(): LogLevel {
  const raw = readEnv('LOG_LEVEL').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  const mode = readEnv('MODE').toLowerCase();
  const prod = mode === 'production' || readEnv('PROD') === 'true' || readEnv('NODE_ENV') === 'production';
  return prod ? 'info' : 'debug';
}

function resolveJsonFormat(): boolean {
  const explicit = readEnv('LOG_FORMAT').toLowerCase();
  if (explicit === 'json') return true;
  if (explicit === 'pretty') return false;
  const mode = readEnv('MODE').toLowerCase();
  return mode === 'production' || readEnv('PROD') === 'true' || readEnv('NODE_ENV') === 'production';
}

function resolveStackTraces(): boolean {
  // Stacks are developer-facing context: kept on the server and in dev, dropped
  // from browser records so console output stays free of internals.
  const explicit = readEnv('LOG_STACKS').toLowerCase();
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;
  const isServer = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (isServer) return true;
  return !resolveJsonFormat();
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

const SECRET_KEY_PATTERN =
  /password|passwd|pwd|secret|token|id_token|access_token|refresh_token|session_?key|api[_-]?key|apikey|authorization|cookie|set-cookie|service_role|private_?key|client_?secret|credential|otp|passcode|pin$/i;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SB_SECRET_PATTERN = /\bsb_secret_[A-Za-z0-9_-]{8,}/g;
const SB_PUBLISHABLE_PATTERN = /\bsb_publishable_[A-Za-z0-9_-]{8,}/g;
const EMAIL_PATTERN = /([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,})/g;

function maskEmail(_match: string, local: string, domain: string): string {
  return `${local.slice(0, 1)}***@${domain}`;
}

function sanitizeString(value: string): string {
  return value
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(SB_SECRET_PATTERN, '[redacted-key]')
    .replace(SB_PUBLISHABLE_PATTERN, (m) => `${m.slice(0, 14)}…(len ${m.length})`)
    .replace(EMAIL_PATTERN, maskEmail);
}

/**
 * Deep-sanitizes an arbitrary value for safe logging. Secret-shaped object keys
 * are redacted wholesale; strings are scrubbed of JWTs, secret keys and emails.
 * Circular structures are replaced with `[circular]` instead of throwing.
 */
export function sanitize<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value) as T;
  if (typeof value !== 'object') return value;
  if (depth > 6) return '[truncated]' as T;
  if (seen.has(value)) return '[circular]' as T;
  seen.add(value);

  if (value instanceof Error) {
    return serializeError(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1, seen)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = '[redacted]';
    } else if (key.toLowerCase() === 'email' && typeof entry === 'string') {
      out[key] = sanitizeString(entry);
    } else {
      out[key] = sanitize(entry, depth + 1, seen);
    }
  }
  return out as T;
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code.slice(0, 64);
    if (typeof code === 'number') return String(code);
  }
  return undefined;
}

function errorStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const record = error as { status?: unknown; statusCode?: unknown };
  const status = record.status ?? record.statusCode;
  return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
}

/** Information-hiding serialization: name/message/code travel, stacks stay server-side. */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const record: SerializedError = {
      name: error.name || 'Error',
      message: sanitizeString(error.message || 'Unknown error').slice(0, 2000),
    };
    const code = errorCodeOf(error);
    if (code) record.code = code;
    const status = errorStatusOf(error);
    if (status !== undefined) record.status = status;
    if (resolveStackTraces() && typeof error.stack === 'string') {
      record.stack = sanitizeString(error.stack).slice(0, 8000);
    }
    return record;
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: sanitizeString(error).slice(0, 2000) };
  }
  try {
    return {
      name: 'Error',
      message: sanitizeString(JSON.stringify(error) || 'Unknown error').slice(0, 2000),
    };
  } catch {
    return { name: 'Error', message: 'Unserializable error' };
  }
}

// ---------------------------------------------------------------------------
// User-facing message helper (standard-error side)
// ---------------------------------------------------------------------------

const RAW_TECHNICAL_PATTERN =
  /select\s+.+\s+from\s+|insert\s+into\s+|PGRST\d+|auth\.uid\(\)|row-level|row level security|constraint\s+"?[a-z_]+|relation\s+"?[a-z_.]+|function\s+[a-z_.]+\(|JWT|expired|claim|supabase-js|postgrest|permission denied for (table|schema|function)/i;

/**
 * Derives a safe user-facing message from an unknown failure. Known-safe text
 * passes through (sanitized, capped); anything technical-looking — SQL, schema
 * names, grants, token internals — collapses to the action-oriented fallback so
 * standard errors never disclose internals.
 */
export function toSafeMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const cleaned = sanitizeString(raw).replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 280 || RAW_TECHNICAL_PATTERN.test(cleaned)) return fallback;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

function emit(record: LogRecord): void {
  try {
    const active = resolveLevel();
    if (LEVEL_ORDER[record.level] < LEVEL_ORDER[active]) return;
    if (resolveJsonFormat()) {
      const line = JSON.stringify(record);
      if (record.level === 'error' || record.level === 'warn') {
        // eslint-disable-next-line no-console
        console.error(line);
      } else {
        // eslint-disable-next-line no-console
        console.log(line);
      }
      return;
    }
    const parts = [`[${record.ts}]`, `[${record.level}]`, `[${record.scope}]`, record.msg];
    if (record.requestId) parts.push(`(req ${record.requestId})`);
    const line = parts.join(' ');
    const extras: unknown[] = [];
    if (record.data !== undefined) extras.push(record.data);
    if (record.err !== undefined) extras.push(record.err);
    switch (record.level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(line, ...extras);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.log(line, ...extras);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(line, ...extras);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(line, ...extras);
        break;
    }
  } catch {
    // Logging must never break the app it instruments.
  }
}

function baseLogger(scope: string, context: Record<string, unknown>): Logger {
  const record = (level: LogLevel, msg: string, data?: unknown, err?: unknown): void => {
    const entry: LogRecord = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg,
    };
    const requestId = context.requestId;
    if (typeof requestId === 'string' && requestId) entry.requestId = requestId;
    const rest = { ...context };
    delete rest.requestId;
    const mergedData =
      data === undefined
        ? Object.keys(rest).length > 0
          ? rest
          : undefined
        : Object.keys(rest).length > 0
          ? { ...rest, ...(typeof data === 'object' && data !== null ? (data as object) : { value: data }) }
          : data;
    if (mergedData !== undefined) entry.data = sanitize(mergedData);
    if (err !== undefined) entry.err = serializeError(err);
    emit(entry);
  };
  return {
    debug: (msg, data) => record('debug', msg, data),
    info: (msg, data) => record('info', msg, data),
    warn: (msg, data) => record('warn', msg, data),
    error: (msg, err, data) => record('error', msg, data, err),
    child: (extra) => baseLogger(scope, { ...context, ...extra }),
  };
}

/** Creates a scoped logger, e.g. `logger('auth')`, `logger('server').child({ requestId })`. */
export function logger(scope: string, context: Record<string, unknown> = {}): Logger {
  return baseLogger(scope, context);
}
