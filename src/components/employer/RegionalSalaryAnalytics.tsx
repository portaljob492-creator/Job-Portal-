import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, MapPin, DollarSign, Award, Info, Filter, Sparkles, Building2 } from 'lucide-react';
import { JobPosting } from '../../types';

interface RegionalSalaryAnalyticsProps {
  jobs: JobPosting[];
  defaultRegion?: string;
}

interface SalaryDistributionData {
  range: string;
  count: number;
  commission: number;
  chairRental: number;
  hourly: number;
  marketPct: number;
}

export const RegionalSalaryAnalytics: React.FC<RegionalSalaryAnalyticsProps> = ({
  jobs,
  defaultRegion = 'Beverly Hills, CA'
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('Beverly Hills / Greater LA');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [chartType, setChartType] = useState<'distribution' | 'trend'>('distribution');

  // Sample data for regions
  const REGIONS = [
    'Beverly Hills / Greater LA',
    'Orange County, CA',
    'San Francisco Bay Area',
    'San Diego, CA'
  ];

  const CATEGORIES = ['All', 'Hair', 'Skincare', 'Nails', 'Makeup', 'Massage'];

  // Regional benchmark statistics
  const REGIONAL_STATS: Record<string, { medianSalary: string; topPaidSpecialty: string; totalOpenings: number; avgCommission: string }> = {
    'Beverly Hills / Greater LA': {
      medianSalary: '$74,500/yr',
      topPaidSpecialty: 'Balayage & Color Specialist ($92k avg)',
      totalOpenings: 342,
      avgCommission: '55% - 65%'
    },
    'Orange County, CA': {
      medianSalary: '$68,000/yr',
      topPaidSpecialty: 'Master Esthetician & MedSpa ($85k avg)',
      totalOpenings: 215,
      avgCommission: '50% - 60%'
    },
    'San Francisco Bay Area': {
      medianSalary: '$82,000/yr',
      topPaidSpecialty: 'Lead Stylist & Educator ($105k avg)',
      totalOpenings: 188,
      avgCommission: '55% - 70%'
    },
    'San Diego, CA': {
      medianSalary: '$65,000/yr',
      topPaidSpecialty: 'Extension Specialist ($78k avg)',
      totalOpenings: 145,
      avgCommission: '50% - 58%'
    }
  };

  // Salary Range Distribution Data per Region
  const DISTRIBUTION_DATA: Record<string, SalaryDistributionData[]> = {
    'Beverly Hills / Greater LA': [
      { range: '< $40k', count: 12, commission: 4, chairRental: 2, hourly: 6, marketPct: 8 },
      { range: '$40k - $60k', count: 38, commission: 18, chairRental: 8, hourly: 12, marketPct: 22 },
      { range: '$60k - $80k', count: 68, commission: 36, chairRental: 18, hourly: 14, marketPct: 38 },
      { range: '$80k - $100k', count: 42, commission: 25, chairRental: 12, hourly: 5, marketPct: 24 },
      { range: '$100k+', count: 18, commission: 12, chairRental: 5, hourly: 1, marketPct: 10 }
    ],
    'Orange County, CA': [
      { range: '< $40k', count: 18, commission: 6, chairRental: 3, hourly: 9, marketPct: 12 },
      { range: '$40k - $60k', count: 52, commission: 28, chairRental: 10, hourly: 14, marketPct: 32 },
      { range: '$60k - $80k', count: 58, commission: 32, chairRental: 16, hourly: 10, marketPct: 36 },
      { range: '$80k - $100k', count: 24, commission: 15, chairRental: 7, hourly: 2, marketPct: 15 },
      { range: '$100k+', count: 8, commission: 5, chairRental: 3, hourly: 0, marketPct: 5 }
    ],
    'San Francisco Bay Area': [
      { range: '< $40k', count: 6, commission: 2, chairRental: 1, hourly: 3, marketPct: 5 },
      { range: '$40k - $60k', count: 28, commission: 12, chairRental: 6, hourly: 10, marketPct: 18 },
      { range: '$60k - $80k', count: 54, commission: 28, chairRental: 14, hourly: 12, marketPct: 32 },
      { range: '$80k - $100k', count: 58, commission: 35, chairRental: 18, hourly: 5, marketPct: 34 },
      { range: '$100k+', count: 22, commission: 15, chairRental: 6, hourly: 1, marketPct: 13 }
    ],
    'San Diego, CA': [
      { range: '< $40k', count: 15, commission: 5, chairRental: 3, hourly: 7, marketPct: 14 },
      { range: '$40k - $60k', count: 48, commission: 24, chairRental: 10, hourly: 14, marketPct: 38 },
      { range: '$40k - $80k', count: 42, commission: 22, chairRental: 12, hourly: 8, marketPct: 32 },
      { range: '$80k - $100k', count: 16, commission: 10, chairRental: 5, hourly: 1, marketPct: 12 },
      { range: '$100k+', count: 6, commission: 4, chairRental: 2, hourly: 0, marketPct: 4 }
    ]
  };

  const TREND_DATA = [
    { year: '2022', avgSalary: 58000, medianSalary: 55000 },
    { year: '2023', avgSalary: 62500, medianSalary: 59000 },
    { year: '2024', avgSalary: 67000, medianSalary: 63500 },
    { year: '2025', avgSalary: 71000, medianSalary: 68000 },
    { year: '2026 (Current)', avgSalary: 74500, medianSalary: 71500 }
  ];

  const currentDist = DISTRIBUTION_DATA[selectedRegion] || DISTRIBUTION_DATA['Beverly Hills / Greater LA'];
  const currentStats = REGIONAL_STATS[selectedRegion] || REGIONAL_STATS['Beverly Hills / Greater LA'];

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1c1b1b] text-white p-3.5 rounded-2xl shadow-xl border border-white/10 text-xs space-y-1.5 min-w-[200px]">
          <p className="font-extrabold text-[#ffd9e2] text-sm flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Salary Bracket: {label}</span>
          </p>
          <p className="text-white/80">
            Total Posted Roles: <span className="font-bold text-white">{payload[0]?.payload?.count} roles</span>
          </p>
          <div className="pt-2 border-t border-white/10 space-y-1 text-[11px]">
            <p className="flex justify-between">
              <span className="text-[#ffb0c8]">Commission Positions:</span>
              <span className="font-bold">{payload[0]?.payload?.commission}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-[#a5f3fc]">Chair Rental / Booth:</span>
              <span className="font-bold">{payload[0]?.payload?.chairRental}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-[#fde68a]">Hourly / Salary:</span>
              <span className="font-bold">{payload[0]?.payload?.hourly}</span>
            </p>
          </div>
          <p className="text-[10px] text-emerald-300 font-semibold pt-1">
            ~{payload[0]?.payload?.marketPct}% of total regional beauty listings
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e0bec6]/60 shadow-sm p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e0bec6]/40">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-[#1c1b1b]">
              Regional Salary Distribution & Market Benchmark
            </h3>
          </div>
          <p className="text-xs text-[#594047] mt-1">
            Real-time compensation analytics for beauty & wellness roles across Southern California.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Region Selector */}
          <div className="flex items-center gap-1.5 bg-[#fdf8f8] px-3 py-1.5 rounded-2xl border border-[#e0bec6]">
            <MapPin className="w-3.5 h-3.5 text-[#8e004b]" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#1c1b1b] focus:outline-none cursor-pointer"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="flex items-center gap-1.5 bg-[#fdf8f8] px-3 py-1.5 rounded-2xl border border-[#e0bec6]">
            <Filter className="w-3.5 h-3.5 text-[#8e004b]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#1c1b1b] focus:outline-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Specialties' : c}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex bg-[#f1edec] p-1 rounded-2xl border border-[#e0bec6]">
            <button
              onClick={() => setChartType('distribution')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                chartType === 'distribution'
                  ? 'bg-[#8e004b] text-white shadow-2xs'
                  : 'text-[#594047] hover:text-[#1c1b1b]'
              }`}
            >
              Range Distribution
            </button>
            <button
              onClick={() => setChartType('trend')}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                chartType === 'trend'
                  ? 'bg-[#8e004b] text-white shadow-2xs'
                  : 'text-[#594047] hover:text-[#1c1b1b]'
              }`}
            >
              5-Year Growth
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#fdf8f8] p-4 rounded-2xl border border-[#ffd9e2] shadow-2xs">
          <div className="flex items-center justify-between text-[#8e004b] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Regional Median</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{currentStats.medianSalary}</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +6.2% YoY growth
          </p>
        </div>

        <div className="bg-[#fdf8f8] p-4 rounded-2xl border border-[#ffd9e2] shadow-2xs">
          <div className="flex items-center justify-between text-[#8e004b] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Paid Specialty</span>
            <Award className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-[#1c1b1b] truncate">{currentStats.topPaidSpecialty}</p>
          <p className="text-[11px] text-[#594047] mt-1">High-demand technical skill</p>
        </div>

        <div className="bg-[#fdf8f8] p-4 rounded-2xl border border-[#ffd9e2] shadow-2xs">
          <div className="flex items-center justify-between text-[#8e004b] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Regional Roles</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{currentStats.totalOpenings} listings</p>
          <p className="text-[11px] text-[#594047] mt-1">Across 85+ active salons</p>
        </div>

        <div className="bg-[#fdf8f8] p-4 rounded-2xl border border-[#ffd9e2] shadow-2xs">
          <div className="flex items-center justify-between text-[#8e004b] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Commission Split</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-[#1c1b1b]">{currentStats.avgCommission}</p>
          <p className="text-[11px] text-[#594047] mt-1">Plus 10-15% retail commission</p>
        </div>
      </div>

      {/* Main Interactive Recharts Chart Area */}
      <div className="bg-[#fdf8f8] p-5 rounded-2xl border border-[#e0bec6]/40 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#1c1b1b] uppercase tracking-wider flex items-center gap-2">
            <span>
              {chartType === 'distribution'
                ? `Salary Distribution for ${selectedRegion} (${selectedCategory === 'All' ? 'All Categories' : selectedCategory})`
                : `5-Year Average vs. Median Compensation Trend (${selectedRegion})`}
            </span>
          </h4>
          <span className="text-[11px] text-[#8c7077] font-medium hidden sm:inline">
            Interactive chart — hover bars for compensation tier breakdown
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'distribution' ? (
              <BarChart data={currentDist} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0bec6" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fill: '#1c1b1b', fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: '#e0bec6' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8c7077', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Listings', angle: -90, position: 'insideLeft', fill: '#8c7077', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 600 }}
                  formatter={(value) => {
                    if (value === 'commission') return 'Commission Split Roles';
                    if (value === 'chairRental') return 'Chair Rental / Booth';
                    if (value === 'hourly') return 'Base Salary / Hourly + Tips';
                    return value;
                  }}
                />
                <Bar dataKey="commission" stackId="a" fill="#8e004b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="chairRental" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="hourly" stackId="a" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8e004b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8e004b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0bec6" opacity={0.4} vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#1c1b1b', fontSize: 11, fontWeight: 700 }} />
                <YAxis
                  tick={{ fill: '#8c7077', fontSize: 11 }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}/yr`, 'Compensation']}
                  contentStyle={{ backgroundColor: '#1c1b1b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 600 }} />
                <Area type="monotone" dataKey="avgSalary" name="Average Regional Earnings" stroke="#8e004b" fillOpacity={1} fill="url(#colorAvg)" strokeWidth={2} />
                <Area type="monotone" dataKey="medianSalary" name="Median Base Earnings" stroke="#0284c7" fillOpacity={1} fill="url(#colorMed)" strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Competitive Benchmark Note for Salon Employer */}
      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-amber-900">
          <p className="font-bold">Salon Compensation Strategy Insight:</p>
          <p>
            In <span className="font-bold">{selectedRegion}</span>, 62% of top applicants target roles offering a guaranteed base draw or standard 55%+ commission structure. Postings offering retail product commission or paid continuing education receive <span className="font-semibold text-[#8e004b]">2.4x more candidate applications</span> on average.
          </p>
        </div>
      </div>
    </div>
  );
};
