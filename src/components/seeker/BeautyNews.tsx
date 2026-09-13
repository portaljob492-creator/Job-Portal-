import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

export const BeautyNews: React.FC = () => {
  const [news, setNews] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news', { method: 'POST' });
      const data = await response.json();
      setNews(data.news);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#e0bec6]/50 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#8e004b] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#e2007c]" />
          <span>Latest Beauty Trends</span>
        </span>
        <button onClick={fetchNews} className="text-[#8c7077] hover:text-[#8e004b] p-1 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-[#8c7077]">Fetching latest trends...</div>
      ) : (
        <p className="text-xs text-[#1c1b1b] leading-relaxed">{news}</p>
      )}
    </div>
  );
};
