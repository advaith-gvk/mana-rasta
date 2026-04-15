// components/SeverityBadge.tsx
import React from 'react';

const COLORS: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
  high:     'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
  medium:   'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  low:      'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
};

export default function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${COLORS[severity] || 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  );
}
