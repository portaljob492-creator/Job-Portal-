import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, Building2, Info, IndianRupee, MapPin, TrendingUp } from 'lucide-react';
import { JobPosting } from '../../types';

interface RegionalSalaryAnalyticsProps {
  jobs: JobPosting[];
  defaultRegion?: string;
}

const SALARY_BUCKETS = [
  { label: '< ₹20k', min: 0, max: 20_000 },
  { label: '₹20k–₹40k', min: 20_000, max: 40_000 },
  { label: '₹40k–₹60k', min: 40_000, max: 60_000 },
  { label: '₹60k–₹1L', min: 60_000, max: 100_000 },
  { label: '₹1L+', min: 100_000, max: Number.POSITIVE_INFINITY },
] as const;

function midpoint(job: JobPosting): number | null {
  const min = job.salaryMin;
  const max = job.salaryMax;
  if (min != null && max != null) return (min + max) / 2;
  if (min != null) return min;
  if (max != null) return max;
  return null;
}

function jobRegion(job: JobPosting): string {
  return job.location?.trim() || [job.city, job.area].filter(Boolean).join(', ') || 'Location not specified';
}

export const RegionalSalaryAnalytics: React.FC<RegionalSalaryAnalyticsProps> = ({ jobs, defaultRegion }) => {
  const regions = useMemo(
    () => ['All locations', ...Array.from(new Set<string>(jobs.map(jobRegion))).sort((a, b) => a.localeCompare(b))],
    [jobs],
  );
  const categories = useMemo(
    () => ['All', ...Array.from(new Set<string>(jobs.map((job) => job.category).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))],
    [jobs],
  );
  const initialRegion = defaultRegion && regions.includes(defaultRegion) ? defaultRegion : 'All locations';
  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    if (!regions.includes(selectedRegion)) setSelectedRegion('All locations');
  }, [regions, selectedRegion]);
  useEffect(() => {
    if (!categories.includes(selectedCategory)) setSelectedCategory('All');
  }, [categories, selectedCategory]);

  const filteredJobs = useMemo(
    () => jobs.filter((job) =>
      (selectedRegion === 'All locations' || jobRegion(job) === selectedRegion)
      && (selectedCategory === 'All' || job.category === selectedCategory)),
    [jobs, selectedCategory, selectedRegion],
  );
  const salaryValues = useMemo(
    () => filteredJobs.map(midpoint).filter((value): value is number => value != null),
    [filteredJobs],
  );
  const distribution = useMemo(
    () => SALARY_BUCKETS.map((bucket) => ({
      range: bucket.label,
      listings: salaryValues.filter((salary) => salary >= bucket.min && salary < bucket.max).length,
    })),
    [salaryValues],
  );
  const median = useMemo(() => {
    if (!salaryValues.length) return null;
    const ordered = [...salaryValues].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }, [salaryValues]);
  const topCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of filteredJobs) counts.set(job.category || 'Other', (counts.get(job.category || 'Other') || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not enough data';
  }, [filteredJobs]);
  const openings = filteredJobs.reduce((total, job) => total + Math.max(job.openings || 1, 1), 0);
  const salaryCoverage = filteredJobs.length ? Math.round((salaryValues.length / filteredJobs.length) * 100) : 0;

  return (
    <div className="space-y-6 rounded-3xl border border-[#e0bec6]/60 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e0bec6]/40 pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffd9e2] text-[#8e004b]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-[#1c1b1b]">Salary insights from your job posts</h3>
          </div>
          <p className="mt-1 text-xs text-[#594047]">Calculated only from the currently loaded postings—no estimated market data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-2xl border border-[#e0bec6] bg-[#fdf8f8] px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#8e004b]" />
            <span className="sr-only">Location</span>
            <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="cursor-pointer bg-transparent text-xs font-bold text-[#1c1b1b] focus:outline-none">
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label className="rounded-2xl border border-[#e0bec6] bg-[#fdf8f8] px-3 py-1.5">
            <span className="sr-only">Category</span>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="cursor-pointer bg-transparent text-xs font-bold text-[#1c1b1b] focus:outline-none">
              {categories.map((category) => <option key={category} value={category}>{category === 'All' ? 'All specialties' : category}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#ffd9e2] bg-[#fdf8f8] p-4 shadow-2xs">
          <div className="mb-1 flex items-center justify-between text-[#8e004b]"><span className="text-[11px] font-bold uppercase tracking-wider">Median monthly salary</span><IndianRupee className="h-4 w-4" /></div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{median == null ? 'Not available' : `₹${Math.round(median).toLocaleString('en-IN')}`}</p>
          <p className="mt-1 text-[11px] text-[#594047]">From {salaryValues.length} post{salaryValues.length === 1 ? '' : 's'} with salary data</p>
        </div>
        <div className="rounded-2xl border border-[#ffd9e2] bg-[#fdf8f8] p-4 shadow-2xs">
          <div className="mb-1 flex items-center justify-between text-[#8e004b]"><span className="text-[11px] font-bold uppercase tracking-wider">Most-posted specialty</span><Award className="h-4 w-4" /></div>
          <p className="truncate text-sm font-bold text-[#1c1b1b]">{topCategory}</p>
          <p className="mt-1 text-[11px] text-[#594047]">Within the selected filters</p>
        </div>
        <div className="rounded-2xl border border-[#ffd9e2] bg-[#fdf8f8] p-4 shadow-2xs">
          <div className="mb-1 flex items-center justify-between text-[#8e004b]"><span className="text-[11px] font-bold uppercase tracking-wider">Openings represented</span><Building2 className="h-4 w-4" /></div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{openings}</p>
          <p className="mt-1 text-[11px] text-[#594047]">Across {filteredJobs.length} loaded post{filteredJobs.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-[#ffd9e2] bg-[#fdf8f8] p-4 shadow-2xs">
          <div className="mb-1 flex items-center justify-between text-[#8e004b]"><span className="text-[11px] font-bold uppercase tracking-wider">Salary coverage</span><TrendingUp className="h-4 w-4" /></div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{salaryCoverage}%</p>
          <p className="mt-1 text-[11px] text-[#594047]">Posts containing a numeric salary range</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#e0bec6]/40 bg-[#fdf8f8] p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1c1b1b]">Monthly salary distribution</h4>
        {salaryValues.length ? (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0bec6" opacity={0.4} vertical={false} />
                <XAxis dataKey="range" tick={{ fill: '#1c1b1b', fontSize: 11, fontWeight: 700 }} axisLine={{ stroke: '#e0bec6' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#8c7077', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${value} listing${Number(value) === 1 ? '' : 's'}`, 'Postings']} contentStyle={{ borderRadius: '12px', borderColor: '#e0bec6', fontSize: '12px' }} />
                <Bar dataKey="listings" name="Postings" fill="#8e004b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-[#594047]">No numeric salary data matches these filters.</div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p className="text-xs text-amber-900">These figures summarize your loaded job records only. They are not a regional market benchmark and should not be presented as industry-wide compensation data.</p>
      </div>
    </div>
  );
};
