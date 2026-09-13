import React from 'react';

interface JobsInlineSkeletonProps {
  rows?: number;
  className?: string;
  label?: string;
}

/** Lightweight, accessible loading placeholders shared by Jobs-only screens. */
export const JobsInlineSkeleton: React.FC<JobsInlineSkeletonProps> = ({
  rows = 3,
  className = '',
  label = 'Loading content',
}) => (
  <div role="status" aria-label={label} className={`animate-pulse space-y-3 ${className}`}>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded-full bg-slate-200" />
            <div className="h-2.5 w-4/5 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    ))}
    <span className="sr-only">{label}…</span>
  </div>
);

export const JobsWorkspaceSkeleton: React.FC = () => (
  <div role="status" aria-live="polite" className="min-h-screen bg-slate-50 text-slate-900">
    <div className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-gradient-to-r from-indigo-100 to-violet-100" />
        <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-44 rounded-full bg-slate-200" />
        <div className="h-3 w-72 max-w-full rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 h-10 w-10 rounded-2xl bg-indigo-100" />
            <div className="mb-3 h-4 w-1/2 rounded-full bg-slate-200" />
            <div className="h-3 w-4/5 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <JobsInlineSkeleton rows={3} />
    </main>
    <span className="sr-only">Loading your Jobs workspace…</span>
  </div>
);
