import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(val: number | null | undefined) {
  if (val == null) return '—';
  return `${val}%`;
}

function ragColor(rag: string) {
  return rag === 'red'   ? '#ef4444'
       : rag === 'amber' ? '#f59e0b'
       :                   '#22c55e';
}

function ComplianceBar({ value }: { value: number | null }) {
  const v    = value ?? 0;
  const fill = v >= 80 ? 'bg-green-500' : v >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-mono w-9 text-right text-gray-600 dark:text-gray-300">{pct(value)}</span>
    </div>
  );
}

function RAGBadge({ status }: { status: string }) {
  const cls = status === 'red'   ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
            : status === 'amber' ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
            :                      'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400';
  const label = status === 'red' ? '● High risk' : status === 'amber' ? '● At risk' : '● On track';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

// ── Officer performance tab ────────────────────────────────────────────────────

function OfficerPerformanceTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'AE' | 'EE' | ''>('AE');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery(
    ['officer-perf', filter],
    () => adminApi.getOfficerPerformance(filter ? { designation: filter } : {}),
    { staleTime: 120_000 }
  );

  const refresh = useMutation(
    () => adminApi.refreshPerformance(),
    {
      onSuccess: () => {
        toast.success('Performance views refreshed');
        qc.invalidateQueries('officer-perf');
        qc.invalidateQueries('sla-heatmap');
      },
      onError: () => toast.error('Refresh failed'),
    }
  );

  const officers: any[] = data ?? [];
  const filtered = search
    ? officers.filter(o =>
        o.officer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.ward_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.circle_name?.toLowerCase().includes(search.toLowerCase())
      )
    : officers;

  // Top/bottom 5 for chart
  const chartData = [...officers]
    .sort((a, b) => (a.sla_compliance_pct ?? 0) - (b.sla_compliance_pct ?? 0))
    .slice(0, 10)
    .map(o => ({
      name:    o.officer_name?.split(' ').slice(-1)[0] ?? '?',
      fullName: o.officer_name,
      pct:     parseFloat(o.sla_compliance_pct) || 0,
      ward:    o.ward_name ?? o.circle_name,
    }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search officer or ward…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 w-52 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        {(['AE','EE',''] as const).map(d => (
          <button
            key={d || 'all'}
            onClick={() => setFilter(d)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              filter === d
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {d || 'All'}
          </button>
        ))}
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isLoading}
          className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {refresh.isLoading ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>

      {/* Bottom 10 compliance chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-medium mb-1">Lowest SLA compliance — bottom 10 officers</h2>
          <p className="text-xs text-gray-400 mb-4">Officers needing immediate attention</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(val: number) => [`${val}%`, 'SLA Compliance']}
                labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName ?? name}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="pct" radius={[0,4,4,0]} maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.pct >= 80 ? '#22c55e' : d.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Officers table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Officer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Scope</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Assigned</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Fixed</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Breached</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Avg fix</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">SLA compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No officers found</td></tr>
            )}
            {filtered.map((o: any) => (
              <tr key={o.officer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{o.officer_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                      {o.designation}
                    </span>
                    {o.employee_id && (
                      <span className="text-xs text-gray-400">{o.employee_id}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {o.ward_name && <p className="text-gray-700 dark:text-gray-300">{o.ward_name}</p>}
                  {o.circle_name && (
                    <p className="text-xs text-gray-400">{o.circle_name}</p>
                  )}
                  {o.zone_name && (
                    <p className="text-xs text-gray-400">{o.zone_name}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{o.total_assigned ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-600">{o.fixed_count ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.sla_breached > 0
                    ? <span className="text-red-500 font-semibold">{o.sla_breached}</span>
                    : <span className="text-gray-400">0</span>
                  }
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                  {o.avg_fix_hours != null ? `${o.avg_fix_hours}h` : '—'}
                </td>
                <td className="px-4 py-3 w-36">
                  <ComplianceBar value={parseFloat(o.sla_compliance_pct)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SLA Heatmap tab ────────────────────────────────────────────────────────────

function SLAHeatmapTab() {
  const { data, isLoading } = useQuery(
    'sla-heatmap',
    () => adminApi.getSLAHeatmap(),
    { staleTime: 120_000 }
  );

  const zones: any[] = data ?? [];

  return (
    <div className="space-y-6">
      {/* Zone cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse h-40" />
          ))
        )}
        {zones.map((z: any) => (
          <div
            key={z.zone_id}
            className="rounded-xl border bg-white dark:bg-gray-900 p-5 space-y-3"
            style={{ borderColor: ragColor(z.rag_status) + '60' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{z.zone_name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{z.total_open} open reports</p>
              </div>
              <RAGBadge status={z.rag_status} />
            </div>

            {/* Breach bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">SLA breach rate</span>
                <span className="font-semibold" style={{ color: ragColor(z.rag_status) }}>
                  {pct(z.breach_pct)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(z.breach_pct ?? 0, 100)}%`,
                    backgroundColor: ragColor(z.rag_status),
                  }}
                />
              </div>
            </div>

            {/* Counts */}
            <div className="flex gap-4 text-xs">
              <div>
                <p className="text-gray-400">On time</p>
                <p className="font-semibold text-green-600 tabular-nums">{z.sla_ok ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-400">Breached</p>
                <p className="font-semibold text-red-500 tabular-nums">{z.sla_breached ?? 0}</p>
              </div>
            </div>

            {/* Circle breakdown */}
            {z.circles?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none">
                  Circle breakdown ▾
                </summary>
                <div className="mt-2 space-y-1.5 pl-1">
                  {z.circles.map((c: any) => {
                    const bPct = c.open > 0 ? Math.round((c.breached / c.open) * 100) : 0;
                    const cRag = bPct > 40 ? 'red' : bPct > 15 ? 'amber' : 'green';
                    return (
                      <div key={c.circle_id} className="flex items-center justify-between gap-2">
                        <span className="text-gray-600 dark:text-gray-300 truncate">{c.circle_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${bPct}%`, backgroundColor: ragColor(cRag) }}
                            />
                          </div>
                          <span className="font-mono text-gray-500 w-8 text-right">{bPct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Heatmap legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 justify-end">
        <span>RAG thresholds:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Green &lt;15% breached</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Amber 15–40%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Red &gt;40%</span>
      </div>
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────

export default function OfficersPage() {
  const [tab, setTab] = useState<'performance' | 'heatmap'>('performance');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Officers &amp; SLA Compliance</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            AE/DEE performance at ward level · EE at circle level · Last 90 days
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
          <button
            onClick={() => setTab('performance')}
            className={`px-4 py-1.5 transition-colors ${
              tab === 'performance'
                ? 'bg-orange-500 text-white'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            👷 Officer performance
          </button>
          <button
            onClick={() => setTab('heatmap')}
            className={`px-4 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${
              tab === 'heatmap'
                ? 'bg-orange-500 text-white'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            🗺 SLA Heatmap
          </button>
        </div>
      </div>

      {tab === 'performance' ? <OfficerPerformanceTab /> : <SLAHeatmapTab />}
    </div>
  );
}
