// LeaderboardPage.tsx
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { adminApi } from '../services/api';

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');

  const { data, isLoading } = useQuery(
    ['leaderboard', period],
    () => adminApi.getLeaderboard(period)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leaderboard</h1>
        <div className="flex gap-1">
          {(['weekly','monthly','alltime'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-sm px-3 py-1.5 rounded-lg capitalize transition-colors ${
                period === p
                  ? 'bg-orange-500 text-white'
                  : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-12">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Citizen</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Points</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Streak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {isLoading && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">Loading…</td></tr>
            )}
            {data?.leaderboard?.map((u: any) => (
              <tr key={u.user_id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${u.rank <= 3 ? 'font-medium' : ''}`}>
                <td className="px-4 py-3 text-center">
                  {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : (
                    <span className="text-gray-400 tabular-nums text-xs">{u.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs text-orange-700 dark:text-orange-300 font-medium">
                      {u.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span>{u.name || 'Anonymous'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                  {parseInt(u.score).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {u.streak_days ? `🔥 ${u.streak_days}d` : '—'}
                </td>
              </tr>
            ))}
            {!isLoading && !data?.leaderboard?.length && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
