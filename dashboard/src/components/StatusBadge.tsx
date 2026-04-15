import React from 'react';

const COLORS: Record<string, string> = {
  submitted:    'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  under_review: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  verified:     'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
  assigned:     'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
  in_progress:  'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
  fixed:        'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
  rejected:     'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  fraudulent:   'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
