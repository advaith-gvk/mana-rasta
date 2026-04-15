// SLAPage.tsx
import React from 'react';
import { useQuery } from 'react-query';
import { adminApi } from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import { format, formatDistanceToNow } from 'date-fns';

export default function SLAPage() {
  const { data, isLoading } = useQuery('sla', () => adminApi.getSLA(), {
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">SLA Dashboard</h1>
        <span className={`text-sm font-medium ${data?.length ? 'text-red-500' : 'text-green-500'}`}>
          {data?.length || 0} overdue
        </span>
      </div>

      {!data?.length && !isLoading && (
        <div className="bg-green-50 dark:bg-green-950 rounded-xl px-6 py-10 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-medium text-green-700 dark:text-green-300">All reports within SLA</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">No overdue open reports</p>
        </div>
      )}

      {data?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Ward / Zone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Reported</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">SLA deadline</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Overdue by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
              )}
              {data?.map((r: any) => (
                <tr key={r.id} className="hover:bg-red-50/30 dark:hover:bg-red-950/10">
                  <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.ward_name || '—'}</p>
                    <p className="text-xs text-gray-400">{r.zone_name}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-500">{r.status?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-red-500">
                    {format(new Date(r.sla_deadline), 'dd MMM HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-red-500 tabular-nums">
                      {Math.round(parseFloat(r.overdue_hours))}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
