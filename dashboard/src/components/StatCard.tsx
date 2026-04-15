import React from 'react';

const COLOR_MAP: Record<string, string> = {
  blue:  'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
  green: 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300',
  red:   'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300',
  gray:  'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

interface Props {
  label: string;
  value: number | string;
  color?: string;
  sub?: string;
}

export default function StatCard({ label, value, color = 'gray', sub }: Props) {
  return (
    <div className={`rounded-xl px-4 py-4 ${COLOR_MAP[color] || COLOR_MAP.gray}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}
