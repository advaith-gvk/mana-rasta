import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import SeverityBadge from './SeverityBadge';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  reportId: string;
  onClose: () => void;
}

const NEXT_STATUSES: Record<string, string[]> = {
  submitted:    ['under_review', 'rejected', 'fraudulent'],
  under_review: ['verified', 'rejected', 'fraudulent'],
  verified:     ['assigned', 'rejected'],
  assigned:     ['in_progress'],
  in_progress:  ['fixed', 'rejected'],
  fixed:        [],
  rejected:     [],
  fraudulent:   [],
};

export default function ReportDrawer({ reportId, onClose }: Props) {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [statusNote,  setStatusNote]  = useState('');
  const [newStatus,   setNewStatus]   = useState('');
  const [showBanMenu, setShowBanMenu] = useState(false);

  const { data: report, isLoading } = useQuery(
    ['report', reportId],
    () => adminApi.getReport(reportId)
  );

  const updateStatus = useMutation(
    ({ status, note }: { status: string; note: string }) =>
      adminApi.updateStatus(reportId, { status, note }),
    {
      onSuccess: () => {
        toast.success('Status updated');
        qc.invalidateQueries(['report', reportId]);
        qc.invalidateQueries('reports');
        setNewStatus('');
        setStatusNote('');
      },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const banUser = useMutation(
    ({ type, reason }: { type: string; reason: string }) =>
      adminApi.banUser(report.user_id, { banType: type, reason }),
    {
      onSuccess: () => {
        toast.success('User banned');
        setShowBanMenu(false);
      },
      onError: () => toast.error('Ban failed'),
    }
  );

  if (isLoading) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    );
  }

  const r = report;
  if (!r) return null;

  const availableStatuses = NEXT_STATUSES[r.status] || [];

  return (
    <div className="fixed right-0 top-0 h-full w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={r.severity} />
          <StatusBadge status={r.status} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { onClose(); navigate(`/reports/${reportId}`); }}
            className="text-xs text-orange-500 hover:text-orange-700 dark:hover:text-orange-300 font-medium hover:underline"
          >
            Full detail →
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">×</button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Image */}
        {r.images?.[0]?.url && (
          <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800">
            <img
              src={r.images[0].url}
              alt="Road pothole photo"
              className="w-full h-48 object-cover"
            />
            {r.images[0].moderation === 'flagged_for_review' && (
              <div className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5">
                ⚠️ Image flagged for manual moderation review
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</h3>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-400">Ward:</span> <span className="font-medium">{r.ward_name} (#{r.ward_number})</span></p>
            <p><span className="text-gray-400">Circle:</span> {r.circle_name}</p>
            <p><span className="text-gray-400">Zone:</span> {r.zone_name}</p>
            <p className="font-mono text-xs text-gray-500">{parseFloat(r.latitude).toFixed(6)}, {parseFloat(r.longitude).toFixed(6)}</p>
            {r.address_text && <p className="text-gray-500 text-xs">{r.address_text}</p>}
          </div>
        </div>

        {/* Redressal To chain */}
        {r.redressal_chain?.ae?.id && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Redressal To (IGS)</h3>
            <div className="space-y-2 text-xs">
              {[
                { key: 'ae', label: '1st contact', color: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' },
                { key: 'ee', label: '2nd contact', color: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' },
                { key: 'hq', label: 'Escalation',  color: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300' },
              ].map(({ key, label, color }) => {
                const off = r.redressal_chain?.[key];
                if (!off?.id) return null;
                return (
                  <div key={key} className={`rounded-lg border px-3 py-2 ${color}`}>
                    <p className="opacity-60 font-medium uppercase tracking-wide text-[10px]">{label}</p>
                    <p className="font-semibold mt-0.5">{off.name}</p>
                    <p className="opacity-70">{off.designation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Details</h3>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-400">Road type:</span> <span className="capitalize">{r.road_type}</span></p>
            <p><span className="text-gray-400">Validations:</span> {r.acknowledgment_count}</p>
            <p><span className="text-gray-400">Priority score:</span> <span className="font-mono">{parseFloat(r.priority_score).toFixed(2)}</span></p>
            <p><span className="text-gray-400">Reported:</span> {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
            {r.sla_deadline && (
              <p>
                <span className="text-gray-400">SLA deadline:</span>{' '}
                <span className={new Date(r.sla_deadline) < new Date() ? 'text-red-500 font-medium' : ''}>
                  {format(new Date(r.sla_deadline), 'dd MMM yyyy HH:mm')}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Reporter info */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reporter</h3>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-400">Name:</span> {r.reporter_name || 'Anonymous'}</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Risk score:</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full ${r.user_risk > 70 ? 'bg-red-500' : r.user_risk > 40 ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${r.user_risk}%` }}
                />
              </div>
              <span className="font-mono text-xs">{r.user_risk}/100</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {r.description && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Note</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{r.description}</p>
          </div>
        )}

        {/* Status history */}
        {r.history?.filter((h: any) => h.to)?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">History</h3>
            <div className="space-y-2">
              {r.history.filter((h: any) => h.to).map((h: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-gray-900 dark:text-gray-100 capitalize">{h.to?.replace('_', ' ')}</span>
                    {h.note && <span className="text-gray-400"> — {h.note}</span>}
                    <p className="text-gray-400">{h.at ? format(new Date(h.at), 'dd MMM HH:mm') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {availableStatuses.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Update Status</h3>
            <div className="flex gap-2 flex-wrap mb-2">
              {availableStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-colors ${
                    newStatus === s
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {newStatus && (
              <>
                <textarea
                  rows={2}
                  placeholder="Note (optional)"
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 resize-none mb-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <button
                  onClick={() => updateStatus.mutate({ status: newStatus, note: statusNote })}
                  disabled={updateStatus.isLoading}
                  className="w-full text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 font-medium disabled:opacity-50 transition-colors"
                >
                  {updateStatus.isLoading ? 'Saving…' : `Mark as ${newStatus.replace('_', ' ')}`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Ban user */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <button
            onClick={() => setShowBanMenu(b => !b)}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            {showBanMenu ? 'Cancel' : '⚠ Ban reporter'}
          </button>
          {showBanMenu && (
            <div className="mt-2 space-y-2">
              <button
                onClick={() => banUser.mutate({ type: 'temporary', reason: 'Abuse: reported from admin dashboard' })}
                className="w-full text-xs px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              >
                Temporary ban (7 days)
              </button>
              <button
                onClick={() => banUser.mutate({ type: 'permanent', reason: 'Permanent ban: reported from admin dashboard' })}
                className="w-full text-xs px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Permanent ban
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
