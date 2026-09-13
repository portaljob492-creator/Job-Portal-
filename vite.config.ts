import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const requestedBase = process.env.VITE_APP_BASE_PATH?.trim() || '/';
  const appBase = `/${requestedBase.replace(/^\/+|\/+$/g, '')}${requestedBase === '/' ? '' : '/'}`;
  const asset = (value: string) => `${appBase}${value.replace(/^\//, '')}`;

  // Fail-fast visibility (a warning, not a build failure — demo mode without
  // Supabase is intentional): surface missing client env in the build log so a
  // misconfigured deploy is obvious before it ever reaches the browser.
  const viteEnv = loadEnv(mode, process.cwd(), '');
  const buildSupabaseUrl = (viteEnv.VITE_SUPABASE_URL ?? '').trim();
  const buildSupabaseAnonKey = (viteEnv.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const looksLikePlaceholder = (value: string): boolean =>
    /^(your[_-].*|.*placeholder.*|<.*>|\{\{.*\}\}|changeme|replace[_-]me|todo|x{3,})$/i.test(value);
  if (!buildSupabaseUrl || looksLikePlaceholder(buildSupabaseUrl)) {
    console.warn(
      '[vite] VITE_SUPABASE_URL is missing or a placeholder — the client will use the canonical Nexora project URL fallback. ' +
        '(Local: set it in .env; Vercel: Environment Variables, then redeploy.)',
    );
  }
  if (!buildSupabaseAnonKey || looksLikePlaceholder(buildSupabaseAnonKey)) {
    console.warn(
      '[vite] VITE_SUPABASE_ANON_KEY is missing or a placeholder — this build will run in Supabase demo mode ' +
        '(config banner, no auth/data). Set a real publishable key in .env or Vercel Environment Variables and rebuild. ' +
        '(Express hosts can alternatively set SUPABASE_ANON_KEY in the server environment — injected at runtime, no rebuild needed.)',
    );
  } else {
    console.log(
      `[vite] Supabase client env ok — VITE_SUPABASE_ANON_KEY present (len ${buildSupabaseAnonKey.length}), ` +
        `VITE_SUPABASE_URL ${buildSupabaseUrl ? 'present' : 'missing (canonical fallback)'}.`,
    );
  }

  return {
    base: appBase,
    // Only `VITE_*` variables are exposed to the browser bundle via
    // `import.meta.env` (Vite default, stated explicitly so client env can't
    // silently stop working if the prefix is ever customized).
    envPrefix: 'VITE_',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        includeAssets: [
          'icons/favicon-64.png',
          'icons/apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png',
        ],
        manifest: {
          id: appBase,
          name: 'Nexora Jobs — Beauty Careers',
          short_name: 'Nexora Jobs',
          description: 'Find beauty and wellness jobs, manage applications, interviews, offers, and salon hiring.',
          start_url: `${appBase}?source=pwa`,
          scope: appBase,
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          orientation: 'portrait-primary',
          background_color: '#fdf8f8',
          theme_color: '#8e004b',
          categories: ['business', 'lifestyle', 'productivity'],
          lang: 'en-IN',
          dir: 'ltr',
          icons: [
            { src: asset('icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: asset('icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: asset('icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // No `workbox` block: with the injectManifest strategy, precaching,
        // navigation fallback and runtime caching are implemented in
        // src/service-worker.ts (public content only — never authed data).
        devOptions: { enabled: false },
      }),
    ] as any,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
