import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { adminApi } from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon in Vite
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

const STATUS_TIMELINE = [
  'submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'fixed',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  );
}

function KV({ label, value, mono = false, highlight }: {
  label: string; value: React.ReactNode; mono?: boolean; highlight?: 'red' | 'green' | 'amber';
}) {
  const color = highlight === 'red'   ? 'text-red-500 font-semibold'
              : highlight === 'green' ? 'text-green-600 font-semibold'
              : highlight === 'amber' ? 'text-amber-500 font-semibold'
              : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="flex justify-between items-start py-1.5 text-sm border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-gray-400 shrink-0 mr-4">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-xs' : ''} ${color}`}>{value ?? '—'}</span>
    </div>
  );
}

function OfficerCard({
  officer, level, slaLabel,
}: {
  officer: any; level: '1st contact' | '2nd contact' | 'Escalation'; slaLabel: string;
}) {
  if (!officer?.id) return null;
  const levelColor =
    level === '1st contact' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
    : level === '2nd contact' ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${levelColor}`}>
      <div className="w-9 h-9 rounded-full bg-white/60 dark:bg-black/20 flex items-center justify-center text-base font-semibold shrink-0">
        {officer.designation?.slice(0,2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{level}</span>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs opacity-70">{slaLabel}</span>
        </div>
        <p className="font-semibold text-sm mt-0.5 truncate">{officer.name}</p>
        <p className="text-xs opacity-75">{officer.designation}</p>
        {officer.phone && (
          <a href={`tel:${officer.phone}`} className="text-xs underline opacity-75 hover:opacity-100 mt-0.5 block">
            {officer.phone}
          </a>
        )}
        {officer.email && (
          <p className="text-xs opacity-60 truncate">{officer.email}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const navigate      = useNavigate();
  const qc            = useQueryClient();
  const [newStatus,   setNewStatus]   = useState('');
  const [statusNote,  setStatusNote]  = useState('');
  const [selectedImg, setSelectedImg] = useState(0);
  const [showBan,     setShowBan]     = useState(false);

  const { data: r, isLoading } = useQuery(
    ['report', id],
    () => adminApi.getReport(id!),
    { enabled: !!id }
  );

  const updateStatus = useMutation(
    ({ status, note }: { status: string; note: string }) =>
      adminApi.updateStatus(id!, { status, note }),
    {
      onSuccess: () => {
        toast.success('Status updated');
        qc.invalidateQueries(['report', id]);
        qc.invalidateQueries('reports');
        setNewStatus('');
        setStatusNote('');
      },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const banUser = useMutation(
    ({ type, reason }: { type: string; reason: string }) =>
      adminApi.banUser(r.user_id, { banType: type, reason }),
    {
      onSuccess: () => { toast.success('User banned'); setShowBan(false); },
      onError:   () => toast.error('Ban failed'),
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading report…
      </div>
    );
  }
  if (!r) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Report not found.
      </div>
    );
  }

  const images           = r.images?.filter((i: any) => i?.url) ?? [];
  const history          = r.history?.filter((h: any) => h?.to) ?? [];
  const chain            = r.redressal_chain ?? {};
  const availableStatus  = NEXT_STATUSES[r.status] ?? [];
  const slaBreached      = r.sla_deadline && new Date(r.sla_deadline) < new Date();

  const timelineIdx = STATUS_TIMELINE.indexOf(r.status);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <button onClick={() => navigate(-1)} className="hover:text-gray-600 dark:hover:text-gray-200">
          ← Back
        </button>
        <span>/</span>
        <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">{r.id?.slice(0,8)}…</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SeverityBadge severity={r.severity} />
          <StatusBadge status={r.status} />
          {slaBreached && (
            <span className="text-xs bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
              ⚠ SLA Breached
            </span>
          )}
          {r.igs_complaint_id && (
            <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-mono">
              IGS: {r.igs_complaint_id}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">
          Reported {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Status timeline */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-0">
          {STATUS_TIMELINE.map((s, i) => {
            const done    = i < timelineIdx || r.status === 'fixed';
            const current = i === timelineIdx && r.status !== 'fixed';
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    done    ? 'bg-green-500 border-green-500 text-white'
                    : current ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center capitalize leading-tight ${
                    current ? 'text-orange-600 dark:text-orange-400 font-semibold'
                    : done ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400'
                  }`}>
                    {s.replace('_', ' ')}
                  </span>
                </div>
                {i < STATUS_TIMELINE.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 -mt-4 ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left column (2/3) ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Image gallery */}
          {images.length > 0 && (
            <Section title="Photos">
              <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800">
                <img
                  src={images[selectedImg]?.url}
                  alt="Road pothole photo"
                  className="w-full h-64 object-cover"
                />
                {images[selectedImg]?.moderation === 'flagged_for_review' && (
                  <div className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5 flex items-center gap-1.5">
                    ⚠️ Image flagged for manual moderation review
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-2">
                  {images.map((img: any, i: number) => (
                    <button key={i} onClick={() => setSelectedImg(i)}>
                      <img
                        src={img.thumbnail || img.url}
                        alt={`Photo ${i + 1}`}
                        className={`w-16 h-16 object-cover rounded border-2 transition-all ${
                          i === selectedImg
                            ? 'border-orange-500'
                            : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Map */}
          <Section title="Location">
            <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 h-56 mb-4">
              <MapContainer
                center={[parseFloat(r.latitude), parseFloat(r.longitude)]}
                zoom={16}
                className="h-full w-full"
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© OpenStreetMap contributors'
                />
                <Marker position={[parseFloat(r.latitude), parseFloat(r.longitude)]}>
                  <Popup>
                    {r.ward_name} · {r.severity} pothole
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <KV label="Ward"        value={`${r.ward_name} (Ward #${r.ward_number})`} />
            <KV label="Circle"      value={r.circle_name} />
            <KV label="Zone"        value={r.zone_name} />
            <KV label="Coordinates" value={`${parseFloat(r.latitude).toFixed(6)}, ${parseFloat(r.longitude).toFixed(6)}`} mono />
            {r.address_text && <KV label="Address" value={r.address_text} />}
          </Section>

          {/* Report details */}
          <Section title="Report Details">
            <KV label="Road type"       value={<span className="capitalize">{r.road_type}</span>} />
            <KV label="Severity"        value={<SeverityBadge severity={r.severity} />} />
            <KV label="Priority score"  value={parseFloat(r.priority_score).toFixed(2)} mono />
            <KV label="Validations"     value={r.acknowledgment_count} />
            <KV label="Submitted"       value={format(new Date(r.created_at), 'dd MMM yyyy HH:mm')} />
            <KV
              label="SLA deadline"
              value={r.sla_deadline ? format(new Date(r.sla_deadline), 'dd MMM yyyy HH:mm') : '—'}
              highlight={slaBreached ? 'red' : undefined}
            />
            {r.fixed_at && (
              <KV label="Fixed at" value={format(new Date(r.fixed_at), 'dd MMM yyyy HH:mm')} highlight="green" />
            )}
            {r.description && (
              <div className="pt-3 mt-1">
                <p className="text-xs text-gray-400 mb-1">Note from reporter</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">{r.description}</p>
              </div>
            )}
          </Section>

          {/* Status history */}
          {history.length > 0 && (
            <Section title="Status History">
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                {history.map((h: any, i: number) => (
                  <div key={i} className="relative mb-4 last:mb-0">
                    <div className="absolute -left-[13px] top-1 w-3 h-3 rounded-full border-2 border-orange-400 bg-white dark:bg-gray-900" />
                    <p className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                      {h.to?.replace(/_/g, ' ')}
                    </p>
                    {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {h.at ? format(new Date(h.at), 'dd MMM yyyy HH:mm') : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* IGS Complaint Block */}
          <Section title="GHMC IGS Complaint">
            <div className="space-y-2">
              <KV
                label="IGS Complaint ID"
                value={r.igs_complaint_id ?? <span className="text-gray-400 italic">Not synced</span>}
                mono
              />
              <KV label="Category"    value="Engineering" />
              <KV label="Sub-category" value="Repairs to Road (Pot Holes)" />
              <KV
                label="Synced at"
                value={r.igs_synced_at
                  ? format(new Date(r.igs_synced_at), 'dd MMM yyyy HH:mm')
                  : <span className="text-gray-400 italic">Pending</span>
                }
              />
              <button
                className={`w-full mt-3 text-sm py-2 px-3 rounded-lg font-medium border transition-colors ${
                  r.igs_complaint_id
                    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 cursor-default'
                    : 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'
                }`}
                disabled={!!r.igs_complaint_id}
                onClick={() => toast('IGS sync coming in next update')}
              >
                {r.igs_complaint_id ? '✓ Synced to GHMC IGS' : '⇧ Sync to GHMC IGS'}
              </button>
            </div>
          </Section>

          {/* Redressal To chain */}
          <Section title="Redressal To (Authority Chain)">
            <div className="space-y-3">
              <OfficerCard
                officer={chain.ae}
                level="1st contact"
                slaLabel={`${r.road_type === 'arterial' || r.road_type === 'highway' ? '3' : '7'} day SLA`}
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">↓ if unresolved</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <OfficerCard
                officer={chain.ee}
                level="2nd contact"
                slaLabel="After SLA breach"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">↓ escalation</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <OfficerCard
                officer={chain.hq}
                level="Escalation"
                slaLabel="HQ — Chief Engineer / AC(PW)"
              />
              {!chain.ae?.id && (
                <p className="text-xs text-gray-400 italic text-center py-2">
                  No officers assigned — ward boundary data may be incomplete.
                </p>
              )}
            </div>
          </Section>

          {/* Reporter */}
          <Section title="Reporter">
            <KV label="Name"  value={r.reporter_name || 'Anonymous'} />
            <KV label="Phone" value={r.reporter_phone || '—'} />
            <div className="py-1.5 text-sm">
              <span className="text-gray-400">Risk score</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      r.user_risk > 70 ? 'bg-red-500'
                      : r.user_risk > 40 ? 'bg-amber-400'
                      : 'bg-green-500'
                    }`}
                    style={{ width: `${r.user_risk ?? 0}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
                  {r.user_risk ?? 0}/100
                </span>
              </div>
            </div>
          </Section>

          {/* Status actions */}
          {availableStatus.length > 0 && (
            <Section title="Update Status">
              <div className="flex gap-2 flex-wrap mb-3">
                {availableStatus.map((s: string) => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s === newStatus ? '' : s)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-colors ${
                      newStatus === s
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
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
                    {updateStatus.isLoading ? 'Saving…' : `Mark as ${newStatus.replace(/_/g, ' ')}`}
                  </button>
                </>
              )}
            </Section>
          )}

          {/* Ban reporter */}
          <div className="px-1">
            <button
              onClick={() => setShowBan(b => !b)}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
            >
              {showBan ? 'Cancel' : '⚠ Ban reporter'}
            </button>
            {showBan && (
              <div className="mt-2 space-y-2">
                <button
                  onClick={() => banUser.mutate({ type: 'temporary', reason: 'Abuse: actioned from report detail' })}
                  className="w-full text-xs px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Temporary ban (7 days)
                </button>
                <button
                  onClick={() => banUser.mutate({ type: 'permanent', reason: 'Permanent ban: actioned from report detail' })}
                  className="w-full text-xs px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Permanent ban
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
