'use client';

import { useState, useEffect } from 'react';
import {
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapIcon,
  CloudIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { CloudIcon as CloudSolidIcon } from '@heroicons/react/24/solid';

interface Territory {
  id: string;
  name: string;
  type: 'zip_codes' | 'polygon' | 'radius';
  zip_codes?: string[];
  center_lat?: number;
  center_lng?: number;
  radius_miles?: number;
  is_active: boolean;
  alert_enabled: boolean;
  email_alerts: boolean;
  push_alerts: boolean;
  sms_alerts: boolean;
  total_leads: number;
  active_storms: number;
  last_storm_at?: string;
  created_at: string;
}

interface StormAlert {
  id: string;
  alert_type: string;
  severity: string;
  headline: string;
  affected_areas: string[];
  hail_size_inches?: number;
  wind_speed_mph?: number;
  expires_at: string;
  issued_at: string;
  affects_user: boolean;
  matching_territories: string[];
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [alerts, setAlerts] = useState<StormAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingLeads, setGeneratingLeads] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTerritory, setNewTerritory] = useState({
    name: '',
    zip_codes: '',
    alert_enabled: true,
    email_alerts: true,
    push_alerts: true,
  });

  useEffect(() => {
    fetchData();
    // Poll for new alerts every 2 minutes
    const interval = setInterval(fetchAlerts, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTerritories(), fetchAlerts()]);
    setLoading(false);
  };

  const fetchTerritories = async () => {
    try {
      const res = await fetch('/api/territories');
      if (res.ok) {
        const data = await res.json();
        setTerritories(data.territories || []);
      }
    } catch (error) {
      console.error('Error fetching territories:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      // Try Xweather-powered endpoint first for real-time data
      const xweatherRes = await fetch('/api/weather/feed');
      if (xweatherRes.ok) {
        const data = await xweatherRes.json();
        // Transform Xweather response to match expected format
        const combinedAlerts = (data.alerts || []).map((alert: any) => ({
          id: alert.id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          headline: alert.headline,
          description: alert.description,
          affected_areas: alert.affected_areas || [],
          hail_size_inches: alert.hail_size_inches,
          wind_speed_mph: alert.wind_speed_mph,
          expires_at: alert.expires_at,
          issued_at: alert.issued_at || alert.onset_at,
          affects_user: alert.affects_user ?? true,
          matching_territories: [],
          source: 'xweather'
        }));
        setAlerts(combinedAlerts);
        return;
      }
      
      // Fallback to database alerts if Xweather fails
      const res = await fetch('/api/storm-alerts?limit=10');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // Fallback to database alerts
      try {
        const res = await fetch('/api/storm-alerts?limit=10');
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || []);
        }
      } catch {
        // Silent fail - show empty alerts
      }
    }
  };

  const handleCreateTerritory = async () => {
    if (!newTerritory.name || !newTerritory.zip_codes) return;

    const zipArray = newTerritory.zip_codes
      .split(/[,\s]+/)
      .map((z) => z.trim())
      .filter((z) => /^\d{5}$/.test(z));

    if (zipArray.length === 0) {
      alert('Please enter valid 5-digit zip codes');
      return;
    }

    try {
      const res = await fetch('/api/territories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTerritory.name,
          type: 'zip_codes',
          zip_codes: zipArray,
          alert_enabled: newTerritory.alert_enabled,
          email_alerts: newTerritory.email_alerts,
          push_alerts: newTerritory.push_alerts,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewTerritory({
          name: '',
          zip_codes: '',
          alert_enabled: true,
          email_alerts: true,
          push_alerts: true,
        });
        fetchTerritories();
      }
    } catch (error) {
      console.error('Error creating territory:', error);
    }
  };

  const handleDeleteTerritory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this territory?')) return;

    try {
      const res = await fetch(`/api/territories?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTerritories();
      }
    } catch (error) {
      console.error('Error deleting territory:', error);
    }
  };

  const toggleAlerts = async (territory: Territory) => {
    try {
      const res = await fetch('/api/territories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: territory.id,
          alert_enabled: !territory.alert_enabled,
        }),
      });
      if (res.ok) {
        fetchTerritories();
      }
    } catch (error) {
      console.error('Error toggling alerts:', error);
    }
  };

  const handleGenerateLeads = async (territoryId: string) => {
    setGeneratingLeads(territoryId);
    try {
      const res = await fetch(`/api/territories/${territoryId}/leads`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Show success feedback
        alert(`Generated ${data.leadsGenerated} new leads!`);
        fetchTerritories(); // Refresh to update lead counts
      } else {
        alert(data.message || 'No new leads generated');
      }
    } catch (error) {
      console.error('Error generating leads:', error);
      alert('Failed to generate leads');
    } finally {
      setGeneratingLeads(null);
    }
  };

  const getAlertTypeColor = (type: string) => {
    if (type.includes('tornado')) return 'bg-red-500';
    if (type.includes('thunderstorm')) return 'bg-orange-500';
    if (type.includes('hail')) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'extreme': return 'text-red-400';
      case 'severe': return 'text-orange-400';
      case 'moderate': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const formatAlertType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const userAlerts = alerts.filter((a) => a.affects_user);
  const allAlerts = alerts;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <CloudSolidIcon className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Loading storm data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <CloudSolidIcon className="w-8 h-8 text-white" />
              </div>
              Storm Command Center
            </h1>
            <p className="text-gray-400 mt-2 max-w-xl">
              Monitor severe weather in real-time. Get instant alerts when storms hit your territory. Auto-generate leads.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
          >
            <PlusIcon className="w-5 h-5" />
            Add Territory
          </button>
        </div>

        {/* Active Alerts Banner */}
        {userAlerts.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/50 rounded-xl p-5 shadow-lg shadow-red-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-bold text-red-400">
                ⚠️ {userAlerts.length} Active Alert{userAlerts.length > 1 ? 's' : ''} in Your Territory
              </h2>
            </div>
            <div className="space-y-3">
              {userAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-red-900/30 rounded-lg p-4 border border-red-500/30"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getAlertTypeColor(alert.alert_type)} text-white`}
                    >
                      {formatAlertType(alert.alert_type)}
                    </span>
                    <span className="text-sm font-medium">{alert.headline}</span>
                    {alert.hail_size_inches && (
                      <span className="text-xs bg-yellow-600/50 px-2.5 py-1 rounded-full font-medium">
                        🧊 {alert.hail_size_inches}" hail
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {alert.matching_territories.join(', ')}
                    </span>
                    <a
                      href="/dashboard/leads"
                      className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      View Leads →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Territories List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-green-400" />
              Your Territories
            </h2>

            {territories.length === 0 ? (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-10 text-center border border-gray-700">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MapPinIcon className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">No Territories Yet</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Define your sales territories to receive real-time storm alerts and auto-generated leads when severe weather strikes
                </p>
                <div className="space-y-4">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Create Your First Territory
                  </button>
                  <p className="text-gray-500 text-sm">
                    Pro tip: Add zip codes for areas you want to canvass
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {territories.map((territory) => (
                  <div
                    key={territory.id}
                    className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{territory.name}</h3>
                        <p className="text-sm text-gray-400">
                          {territory.zip_codes?.length || 0} zip codes
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAlerts(territory)}
                          className={`p-2 rounded-lg transition-colors ${
                            territory.alert_enabled
                              ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                          title={territory.alert_enabled ? 'Alerts On' : 'Alerts Off'}
                        >
                          {territory.alert_enabled ? (
                            <BellIcon className="w-5 h-5" />
                          ) : (
                            <BellSlashIcon className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteTerritory(territory.id)}
                          className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Zip codes preview */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {territory.zip_codes?.slice(0, 6).map((zip) => (
                        <span
                          key={zip}
                          className="bg-gray-700 text-xs px-2 py-1 rounded"
                        >
                          {zip}
                        </span>
                      ))}
                      {(territory.zip_codes?.length || 0) > 6 && (
                        <span className="text-xs text-gray-500">
                          +{(territory.zip_codes?.length || 0) - 6} more
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">
                          <span className="font-medium text-white">{territory.total_leads}</span> leads
                        </span>
                        {territory.active_storms > 0 && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <CloudIcon className="w-4 h-4" />
                            {territory.active_storms} active
                          </span>
                        )}
                      </div>
                      {/* Notification channels */}
                      <div className="flex items-center gap-2 text-gray-500">
                        {territory.email_alerts && (
                          <EnvelopeIcon className="w-4 h-4" title="Email alerts" />
                        )}
                        {territory.push_alerts && (
                          <DevicePhoneMobileIcon className="w-4 h-4" title="Push alerts" />
                        )}
                      </div>
                    </div>

                    {/* Generate Leads Button */}
                    <button
                      onClick={() => handleGenerateLeads(territory.id)}
                      disabled={generatingLeads === territory.id}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-all text-sm"
                    >
                      {generatingLeads === territory.id ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4" />
                          Generate AI Leads
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Storm Feed */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CloudIcon className="w-5 h-5 text-orange-400" />
              Live Storm Feed
              <span className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2.5 py-1 rounded-full font-bold animate-pulse">
                LIVE
              </span>
            </h2>

            <div className="bg-gray-800/80 rounded-xl border border-gray-700 divide-y divide-gray-700 max-h-[600px] overflow-y-auto backdrop-blur-sm">
              {allAlerts.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-white font-medium mb-2">All Clear</h3>
                  <p className="text-gray-400 text-sm">No active severe weather alerts</p>
                </div>
              ) : (
                allAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 hover:bg-gray-750 transition-colors ${
                      alert.affects_user ? 'bg-orange-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getAlertTypeColor(alert.alert_type)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium ${getSeverityColor(alert.severity)}`}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatAlertType(alert.alert_type)}
                          </span>
                          {alert.affects_user && (
                            <span className="text-xs bg-orange-600/30 text-orange-300 px-1.5 py-0.5 rounded">
                              YOUR AREA
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 line-clamp-2">
                          {alert.headline}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {alert.hail_size_inches && (
                            <span className="text-yellow-400">
                              🧊 {alert.hail_size_inches}" hail
                            </span>
                          )}
                          {alert.wind_speed_mph && (
                            <span className="text-blue-400">
                              💨 {alert.wind_speed_mph} mph
                            </span>
                          )}
                          <span>
                            Expires {new Date(alert.expires_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchAlerts}
              className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Alerts
            </button>
          </div>
        </div>

        {/* Add Territory Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold mb-4">Create Territory</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Territory Name</label>
                  <input
                    type="text"
                    value={newTerritory.name}
                    onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })}
                    placeholder="e.g., Dallas Metro"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Zip Codes (comma or space separated)
                  </label>
                  <textarea
                    value={newTerritory.zip_codes}
                    onChange={(e) => setNewTerritory({ ...newTerritory, zip_codes: e.target.value })}
                    placeholder="75001, 75002, 75003..."
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTerritory.alert_enabled}
                      onChange={(e) =>
                        setNewTerritory({ ...newTerritory, alert_enabled: e.target.checked })
                      }
                      className="rounded bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm">Enable storm alerts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer pl-6">
                    <input
                      type="checkbox"
                      checked={newTerritory.email_alerts}
                      onChange={(e) =>
                        setNewTerritory({ ...newTerritory, email_alerts: e.target.checked })
                      }
                      className="rounded bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm text-gray-400">Email notifications</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer pl-6">
                    <input
                      type="checkbox"
                      checked={newTerritory.push_alerts}
                      onChange={(e) =>
                        setNewTerritory({ ...newTerritory, push_alerts: e.target.checked })
                      }
                      className="rounded bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm text-gray-400">Push notifications</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTerritory}
                  disabled={!newTerritory.name || !newTerritory.zip_codes}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Territory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
