import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { adminApi } from '../services/api';
import StatCard from '../components/StatCard';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import 'leaflet/dist/leaflet.css';

const HYDERABAD_CENTER: [number, number] = [17.385, 78.4867];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#65a30d',
};

export default function DashboardPage() {
  const [mapReports, setMapReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const { data: analytics } = useQuery(
    'analytics',
    () => adminApi.getAnalytics(30),
    { refetchInterval: 60_000 }
  );

  const { data: queue } = useQuery(
    'queue',
    () => adminApi.getQueue({ limit: 20, sort: 'priority' }),
    { refetchInterval: 30_000 }
  );

  const { data: slaData } = useQuery('sla-count', () => adminApi.getSLA());

  async function handleMapMove(e: any) {
    const bounds = e.target.getBounds();
    const reports = await adminApi.getViewport({
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
      limit:  300,
    });
    setMapReports(reports);
  }

  const stats = analytics?.summary || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <span className="text-sm text-gray-400">Last 30 days</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Reports"     value={stats.total_reports || 0}         color="blue" />
        <StatCard label="Open"              value={stats.pending || 0}               color="amber" />
        <StatCard label="Fixed"             value={stats.fixed || 0}                 color="green" />
        <StatCard label="SLA Breached"      value={slaData?.length || 0}             color="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Map */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden h-96">
          <MapContainer
            center={HYDERABAD_CENTER}
            zoom={11}
            className="h-full w-full"
            whenCreated={(map) => {
              map.on('moveend', handleMapMove);
              map.on('zoomend', handleMapMove);
              // Initial load
              setTimeout(() => map.fire('moveend'), 500);
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© OpenStreetMap contributors'
            />
            {mapReports.map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.latitude, r.longitude]}
                radius={r.severity === 'critical' ? 9 : r.severity === 'high' ? 7 : 5}
                pathOptions={{
                  color:       SEVERITY_COLORS[r.severity] || '#888',
                  fillColor:   SEVERITY_COLORS[r.severity] || '#888',
                  fillOpacity: 0.7,
                  weight:      1,
                }}
                eventHandlers={{ click: () => setSelectedReport(r) }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium capitalize">{r.severity} pothole</p>
                    <p className="text-gray-500 capitalize">{r.status}</p>
                    <p className="text-gray-500">{r.acknowledgment_count} validations</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Priority queue */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-medium text-sm">Priority Queue</h2>
            <a href="/reports" className="text-xs text-orange-600 hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-80 overflow-y-auto">
            {queue?.data?.map((r: any) => (
              <a
                key={r.id}
                href={`/reports/${r.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <SeverityBadge severity={r.severity} />
                    <StatusBadge status={r.status} />
                    {r.sla_breached && (
                      <span className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">SLA</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {r.ward_name || 'Unknown ward'} · {r.zone_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.acknowledgment_count} validations ·{' '}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className="text-xs text-gray-400 font-mono mt-0.5">
                  {parseFloat(r.priority_score).toFixed(1)}
                </span>
              </a>
            ))}
            {!queue?.data?.length && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No open reports
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
