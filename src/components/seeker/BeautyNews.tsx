import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { logger } from '../../lib/logger';

const newsLog = logger('news');

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string; requestId?: string };
}

export const BeautyNews: React.FC = () => {
  const [news, setNews] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);

  const fetchNews = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch('/api/news', { method: 'POST' });
      const requestId = response.headers.get('x-request-id') ?? undefined;
      // The API always answers JSON (success or standard error envelope), but a
      // static host without the server answers HTML — never crash on that.
      const data = (await response.json().catch(() => null)) as
        | { news?: unknown }
        | ApiErrorEnvelope
        | null;
      if (!response.ok || !data || typeof (data as { news?: unknown }).news !== 'string') {
        const envelope = (data as ApiErrorEnvelope | null)?.error;
        newsLog.warn('trend service request failed', {
          status: response.status,
          code: envelope?.code ?? 'unknown',
          requestId,
        });
        setNews(null);
        setFailed(true);
        return;
      }
      setNews((data as { news: string }).news);
    } catch (error) {
      // Network-level failure (offline, DNS, CORS): debugging context goes to
      // the structured log, the card shows an action-oriented retry state.
      newsLog.error('trend service unreachable', error);
      setNews(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#cbd5e1]/50 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#4f46e5] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#7c3aed]" />
          <span>Latest Beauty Trends</span>
        </span>
        <button onClick={fetchNews} className="text-[#64748b] hover:text-[#4f46e5] p-1 cursor-pointer" aria-label="Refresh trends">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-[#64748b]">Fetching latest trends...</div>
      ) : failed || !news ? (
        <p className="text-xs text-[#64748b] leading-relaxed">
          Trends are unavailable right now. Tap refresh to try again.
        </p>
      ) : (
        <p className="text-xs text-[#0f172a] leading-relaxed">{news}</p>
      )}
    </div>
  );
};
