# Logging & Errors Convention

Two channels, two audiences. Never mix them.

## 1. Debugging logs (developer-facing) — `src/lib/logger.ts`

```ts
import { logger } from '../lib/logger';

logger('auth').info('session restored', { userId });
logger('api', { requestId }).error('POST /api/news failed', error, { status: 502 });
```

- **Contextual history:** every record is `{ ts, level, scope, msg, requestId?, data?, err? }`.
  Server requests get an 8-char correlation id (`x-request-id` header + all log lines), so a
  client-facing error can be traced back through the events that caused it.
- **Structured data:** production emits one JSON object per line (parseable by any log pipeline);
  development prints compact human-readable lines. Override with `LOG_FORMAT=json|pretty`
  (client: `VITE_LOG_LEVEL` also accepted). Level via `LOG_LEVEL=debug|info|warn|error`
  (production default: `info`, so `debug` is compiled out of prod noise).
- **Security & privacy sensitive:** everything is deep-sanitized before emission —
  secret-shaped keys (`password`, `token`, `authorization`, `cookie`, `service_role`, …) become
  `[redacted]`, JWTs become `[redacted-jwt]`, `sb_secret_*` is redacted, emails are masked
  (`j***@example.com`). Stack traces are kept server-side and in dev only
  (`LOG_STACKS=1|0` overrides). The service worker additionally logs action ids/methods, never
  payloads.
- Rules: never `console.*` directly in app code (import the logger); never log full payloads
  containing user data at `info`+ without a need; `logger.error(msg, err, data)` — error object
  always second.

## 2. Standard errors (client/caller-facing)

- **Action-oriented:** every message tells the caller what failed *and what to do next*
  ("…Please try again later", "…request a fresh link"). No dead-end copy.
- **Information hiding:** no stacks, SQL, schema/table names, RLS internals, or token material.
  Client: `mapBackendError` / `mapAuthError` map known failures to safe copy, and unknown text
  passes through `toSafeMessage()` (sanitized, ≤280 chars, technical-looking content collapses
  to the fallback). Server: `sendApiError()` logs the full record to stderr and returns only:
  ```json
  { "error": { "code": "ai_upstream_error", "message": "Trend service is temporarily unavailable. Please try again later.", "requestId": "a1b2c3d4" } }
  ```
- **Standardized interfaces:**
  - HTTP: `400 bad_request` (malformed input) · `404 not_found` (`/api/*` always JSON, never the
    SPA shell) · `502 ai_upstream_error` (dependency down, retry later) · `503 ai_unavailable`
    (misconfigured dependency) · `500 internal_error` (our bug). Every API response carries
    `x-request-id`.
  - CLI (`scripts/*.mjs`): failures print `✖ <action-oriented message>` to **stderr** and exit
    non-zero (`1` general failure; `2` usage/expected-missing-input where asserted, e.g.
    `reset-user-password`). Throwing on a failed `assertCheck` satisfies this (uncaught → exit 1).

## 3. Operational workflow (example)

1. **System failure:** Gemini times out during `POST /api/news`.
2. **Standard error:** API returns HTTP `502` + `{ error: { code: "ai_upstream_error", message:
   "Trend service is temporarily unavailable. Please try again later.", requestId } }`. The UI
   shows a retry state — never the upstream message.
3. **Debugging log:** stderr gets the structured `ERROR` record with timestamp, `requestId`,
   route, upstream error name/message/code and stack — correlatable with the `http` access line
   for the same `requestId`.
