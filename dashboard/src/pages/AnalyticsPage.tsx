import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { adminApi } from '../services/api';
import StatCard from '../components/StatCard';
import { format, parseISO } from 'date-fns';

const SEVERITY_COLORS = ['#dc2626','#ea580c','#d97706','#65a30d'];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: analytics } = useQuery(['analytics', days], () => adminApi.getAnalytics(days));
  const { data: trend }     = useQuery(['trend', days],     () => adminApi.getTrend(days));
  const { data: zones }     = useQuery('zone-summary',       () => adminApi.getZoneSummary());

  const stats = analytics?.summary || {};

  const trendData = trend?.map((d: any) => ({
    date:     format(parseISO(d.date), 'dd MMM'),
    total:    d.total,
    fixed:    d.fixed,
    flagged:  d.flagged,
  })) || [];

  const severityData = analytics?.bySeverity?.map((d: any) => ({
    name:  d.severity.charAt(0).toUpperCase() + d.severity.slice(1),
    value: parseInt(d.count),
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Period:</span>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                days === d
                  ? 'bg-orange-500 text-white'
                  : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={stats.total_reports || 0}  color="blue" />
        <StatCard label="Fixed"         value={stats.fixed || 0}          color="green" />
        <StatCard label="Pending"       value={stats.pending || 0}        color="amber" />
        <StatCard
          label="Avg Fix Time"
          value={stats.avg_fix_hours ? `${Math.round(stats.avg_fix_hours)}h` : '—'}
          color="gray"
          sub="hours to fix"
        />
      </div>

      {/* Trend chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-medium text-sm mb-4">Report trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, #e5e7eb)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="total"   name="Total"   stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
            <Area type="monotone" dataKey="fixed"   name="Fixed"   stroke="#22c55e" fill="#f0fdf4" strokeWidth={2} />
            <Area type="monotone" dataKey="flagged" name="Flagged" stroke="#ef4444" fill="#fef2f2" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zone breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-medium text-sm mb-4">Open reports by zone</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zones?.slice(0, 8) || []} layout="vertical" margin={{ left: 80, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, #e5e7eb)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="zone" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="open"  name="Open"  fill="#f97316" radius={[0,3,3,0]} />
              <Bar dataKey="fixed" name="Fixed" fill="#22c55e" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity distribution */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-medium text-sm mb-4">Severity distribution</h2>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severityData.map((_: any, i: number) => (
                    <Cell key={i} fill={SEVERITY_COLORS[i % SEVERITY_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Zone table */}
      {zones?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-medium text-sm">Zone performance</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-5 py-2.5">Zone</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                  <th className="text-right px-4 py-2.5">Open</th>
                  <th className="text-right px-4 py-2.5">Fixed</th>
                  <th className="text-right px-4 py-2.5">SLA breaches</th>
                  <th className="text-right px-5 py-2.5">Avg fix (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {zones.map((z: any) => (
                  <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-5 py-2.5 font-medium">{z.zone}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{z.total}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{z.open}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{z.fixed}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-500">{z.sla_breached}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-gray-500">
                      {z.avg_fix_hours ? Math.round(z.avg_fix_hours) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
