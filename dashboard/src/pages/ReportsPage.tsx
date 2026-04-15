import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import ReportDrawer from '../components/ReportDrawer';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['','submitted','under_review','verified','assigned','in_progress','fixed','rejected','fraudulent'];
const SEVERITY_OPTIONS = ['','low','medium','high','critical'];
const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority score' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'newest',   label: 'Newest first' },
  { value: 'severity', label: 'Severity' },
];

export default function ReportsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    severity: '', status: '', sort: 'priority',
    min_age_hours: '', min_validations: '',
    page: 1, limit: 50,
  });
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery(
    ['reports', filters],
    () => adminApi.getQueue(Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)
    )),
    { keepPreviousData: true }
  );

  function setFilter(key: string, value: string | number) {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  }

  return (
    <div className="flex h-full">
      {/* Main table area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selected ? 'mr-96' : ''}`}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Reports</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{data?.total || 0} reports</span>
              <button
                onClick={() => adminApi.exportCSV()}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.severity}
              onChange={e => setFilter('severity', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800"
            >
              <option value="">All severities</option>
              {SEVERITY_OPTIONS.filter(Boolean).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={e => setFilter('status', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            <select
              value={filters.sort}
              onChange={e => setFilter('sort', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              type="number"
              placeholder="Min age (hrs)"
              value={filters.min_age_hours}
              onChange={e => setFilter('min_age_hours', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 w-32"
            />

            <input
              type="number"
              placeholder="Min validations"
              value={filters.min_validations}
              onChange={e => setFilter('min_validations', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 w-36"
            />

            {(filters.severity || filters.status || filters.min_age_hours || filters.min_validations) && (
              <button
                onClick={() => setFilters(f => ({ ...f, severity: '', status: '', min_age_hours: '', min_validations: '', page: 1 }))}
                className="text-sm text-red-500 hover:text-red-700 px-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Ward</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Score</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Validations</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Age</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td>
                </tr>
              )}
              {data?.data?.map((r: any) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r.id === selected ? null : r)}
                  className={`cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors ${
                    selected?.id === r.id ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-white dark:bg-gray-900'
                  }`}
                >
                  <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]">
                      {r.ward_name || '—'}
                    </p>
                    <p className="text-xs text-gray-400">{r.zone_name}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                    {parseFloat(r.priority_score).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {r.acknowledgment_count}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {formatDistanceToNow(new Date(r.created_at))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.sla_breached ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="SLA breached" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400" title="Within SLA" />
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.data?.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No reports match these filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > filters.limit && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {filters.page} of {Math.ceil(data.total / filters.limit)}
            </span>
            <div className="flex gap-2">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilter('page', filters.page - 1)}
                className="text-sm px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={filters.page * filters.limit >= data.total}
                onClick={() => setFilter('page', filters.page + 1)}
                className="text-sm px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <ReportDrawer
          reportId={selected.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
