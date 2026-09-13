import React from 'react';

export const SupabaseConfigWarning: React.FC = () => {
  return (
    <div className="bg-amber-100 border-b border-amber-200 p-3 text-center text-sm text-amber-900 z-[101] relative">
      <p>
        <strong>Supabase not configured.</strong> Please add{' '}
        <code className="bg-amber-200 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
        <code className="bg-amber-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to your <code className="bg-amber-200 px-1 rounded">.env</code> file in Settings.
      </p>
    </div>
  );
};
