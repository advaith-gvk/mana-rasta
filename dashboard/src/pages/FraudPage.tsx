import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const REASON_LABELS: Record<string, string> = {
  duplicate_location: 'Duplicate location',
  duplicate_image:    'Duplicate image',
  ip_limit:           'IP rate limit',
  device_limit:       'Device rate limit',
  impossible_travel:  'Impossible travel',
  burst_submission:   'Burst submission',
  user_limit:         'User rate limit',
  manual_review:      'Manual review',
};

export default function FraudPage() {
  const qc = useQueryClient();
  const [selectedReason, setSelectedReason] = useState('');

  const { data, isLoading } = useQuery(
    ['fraud', selectedReason],
    () => adminApi.getFraud(selectedReason ? { reason: selectedReason } : {}),
    { refetchInterval: 60_000 }
  );

  const banUser = useMutation(
    ({ userId, type }: { userId: string; type: string }) =>
      adminApi.banUser(userId, { banType: type, reason: 'Banned from fraud dashboard' }),
    {
      onSuccess: () => { toast.success('User banned'); qc.invalidateQueries('fraud'); },
      onError: () => toast.error('Ban failed'),
    }
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fraud Dashboard</h1>
        <span className="text-sm text-gray-500">{data?.events?.length || 0} unreviewed events</span>
      </div>

      {/* Stats by reason */}
      {data?.stats?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.stats.map((s: any) => (
            <button
              key={s.reason}
              onClick={() => setSelectedReason(r => r === s.reason ? '' : s.reason)}
              className={`text-left rounded-xl px-4 py-3 border transition-colors ${
                selectedReason === s.reason
                  ? 'border-red-400 bg-red-50 dark:bg-red-950'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300'
              }`}
            >
              <p className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{REASON_LABELS[s.reason] || s.reason}</p>
            </button>
          ))}
        </div>
      )}

      {selectedReason && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Filtering by: <strong>{REASON_LABELS[selectedReason]}</strong></span>
          <button onClick={() => setSelectedReason('')} className="text-red-500 hover:text-red-700">Clear</button>
        </div>
      )}

      {/* Events table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Reason</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Details</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Risk</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">When</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
            )}
            {data?.events?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-[140px]">{e.user_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{e.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
                    {REASON_LABELS[e.reason] || e.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono max-w-[200px] truncate">
                  {e.source_ip} · {e.details?.lat?.toFixed(4)}, {e.details?.lng?.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold tabular-nums text-sm ${
                    e.risk_score > 70 ? 'text-red-500' : e.risk_score > 40 ? 'text-amber-500' : 'text-green-500'
                  }`}>
                    {e.risk_score}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => banUser.mutate({ userId: e.user_id, type: 'temporary' })}
                      className="text-xs px-2 py-1 border border-amber-200 text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      Temp ban
                    </button>
                    <button
                      onClick={() => banUser.mutate({ userId: e.user_id, type: 'permanent' })}
                      className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      Perm ban
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.events?.length && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                  No fraud events to review 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
