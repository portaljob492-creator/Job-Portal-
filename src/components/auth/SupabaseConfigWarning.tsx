import React from 'react';
import { blockingSupabaseEnv, missingSupabaseEnv } from '../../lib/supabase';

/**
 * Shown only when the Supabase client could not be created because a required
 * `VITE_*` variable is genuinely missing (or still holds the `.env.example`
 * placeholder). It names the exact variables and where they must be set.
 */
export const SupabaseConfigWarning: React.FC = () => {
  const missing = blockingSupabaseEnv.length > 0 ? blockingSupabaseEnv : missingSupabaseEnv;
  const missingList = missing.length > 0 ? missing : (['VITE_SUPABASE_ANON_KEY'] as const);

  return (
    <div className="bg-amber-100 border-b border-amber-200 p-3 text-center text-sm text-amber-900 z-[101] relative">
      <p>
        <strong>Supabase not configured.</strong>{' '}
        {missingList.map((name, index) => (
          <React.Fragment key={name}>
            {index > 0 && ' and '}
            <code className="bg-amber-200 px-1 rounded">{name}</code>
          </React.Fragment>
        ))}{' '}
        {missingList.length > 1 ? 'are' : 'is'} missing, so sign-in and data are unavailable.
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Add {missingList.length > 1 ? 'them' : 'it'} to <code className="bg-amber-200 px-1 rounded">.env</code> in the
        project root (copy <code className="bg-amber-200 px-1 rounded">.env.example</code>), or on Vercel under{' '}
        <strong>Settings → Environment Variables</strong> for <strong>Production</strong> (and Preview), then{' '}
        <strong>redeploy</strong> — Vite inlines <code className="bg-amber-200 px-1 rounded">VITE_*</code> values at
        build time, so changing a variable does not update an existing deployment.
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Use the project URL and the anon/publishable key only. Never put the Supabase{' '}
        <code className="bg-amber-200 px-1 rounded">service_role</code> key in a{' '}
        <code className="bg-amber-200 px-1 rounded">VITE_*</code> variable — it is compiled into the public bundle.
      </p>
    </div>
  );
};
