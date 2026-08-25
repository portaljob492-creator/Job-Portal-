/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Universal Nexora PKCE session storage key (defaults to nexora.auth.<project-ref>). */
  readonly VITE_SUPABASE_STORAGE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
