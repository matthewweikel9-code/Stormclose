'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Link2,
  ArrowLeftRight,
  Users,
  FileText,
  Clock,
  Settings,
  Zap,
  Database,
  ChevronRight,
  ExternalLink,
  Shield,
  Activity,
  Download,
  Upload,
  Calendar,
  Building2
} from 'lucide-react';

interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  contactsCount: number;
  jobsCount: number;
  pendingSync: number;
  errors: string[];
}

interface SyncLog {
  id: string;
  direction: 'inbound' | 'outbound';
  entity_type: 'contact' | 'job' | 'note' | 'activity';
  action: 'create' | 'update' | 'delete';
  status: 'success' | 'failed' | 'pending';
  message: string;
  created_at: string;
  jobnimbus_id?: string;
  local_id?: string;
}

interface WebhookEvent {
  id: string;
  event_type: string;
  received_at: string;
  processed: boolean;
  payload_preview: string;
}

export default function JobNimbusSyncPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'webhooks' | 'settings'>('overview');
  const [syncSettings, setSyncSettings] = useState({
    autoSync: true,
    syncInterval: 15,
    syncContacts: true,
    syncJobs: true,
    syncNotes: true,
    syncActivities: true,
  });

  // Fetch sync status
  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/jobnimbus/status');
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected);
        setSyncStatus(data.status);
        setSyncLogs(data.logs || []);
        setWebhookEvents(data.webhookEvents || []);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  // Connect to JobNimbus
  const connectJobNimbus = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your JobNimbus API key');
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch('/api/jobnimbus/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsConnected(true);
        setSyncStatus(data.status);
        setShowApiKeyInput(false);
        setApiKey('');
        // Initial sync
        triggerSync();
      } else {
        const error = await res.json();
        alert(error.message || 'Failed to connect');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect to JobNimbus');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from JobNimbus
  const disconnectJobNimbus = async () => {
    if (!confirm('Are you sure you want to disconnect from JobNimbus?')) return;

    try {
      const res = await fetch('/api/jobnimbus/disconnect', {
        method: 'POST',
      });

      if (res.ok) {
        setIsConnected(false);
        setSyncStatus(null);
        setSyncLogs([]);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  // Trigger manual sync
  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/jobnimbus/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full: true }),
      });

      if (res.ok) {
        await fetchSyncStatus();
      } else {
        const error = await res.json();
        alert(error.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Update sync settings
  const updateSettings = async () => {
    try {
      const res = await fetch('/api/jobnimbus/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncSettings),
      });

      if (res.ok) {
        alert('Settings saved');
      }
    } catch (error) {
      console.error('Settings error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
      case 'failed':
        return { bg: 'bg-red-500/20', text: 'text-red-400' };
      default:
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Link2 className="h-6 w-6 text-blue-400" />
            </div>
            JobNimbus Integration
          </h1>
          <p className="text-gray-400 mt-1">
            Two-way sync with your JobNimbus CRM
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <span className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Check className="h-4 w-4" />
                Connected
              </span>
            </>
          ) : (
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Link2 className="h-5 w-5" />
              Connect JobNimbus
            </button>
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Connect to JobNimbus</h3>
            <p className="text-gray-400 text-sm mb-4">
              Enter your JobNimbus API key to enable two-way sync. You can find your API key in 
              JobNimbus under Settings → API.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApiKeyInput(false);
                  setApiKey('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={connectJobNimbus}
                disabled={isConnecting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-lg p-1 w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'logs', label: 'Sync Logs', icon: FileText },
          { id: 'webhooks', label: 'Webhooks', icon: Zap },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Sync Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Contacts</span>
              </div>
              <p className="text-2xl font-bold text-white">{syncStatus?.contactsCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Synced from JobNimbus</p>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">Jobs</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{syncStatus?.jobsCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Active jobs linked</p>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{syncStatus?.pendingSync || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Changes to sync</p>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Check className="h-4 w-4" />
                <span className="text-sm">Last Sync</span>
              </div>
              <p className="text-lg font-bold text-emerald-400">
                {syncStatus?.lastSync ? formatTimeAgo(syncStatus.lastSync) : 'Never'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Auto-sync enabled</p>
            </div>
          </div>

          {/* Sync Direction Diagram */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h3 className="font-semibold text-white mb-4">Two-Way Sync Flow</h3>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Database className="h-10 w-10 text-blue-400" />
                </div>
                <p className="text-white font-medium">JobNimbus</p>
                <p className="text-sm text-gray-400">Your CRM</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Pull Updates</span>
                </div>
                <ArrowLeftRight className="h-8 w-8 text-gray-500" />
                <div className="flex items-center gap-2 text-orange-400">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">Push Changes</span>
                </div>
              </div>

              <div className="text-center">
                <div className="w-20 h-20 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-10 w-10 text-orange-400" />
                </div>
                <p className="text-white font-medium">StormAI</p>
                <p className="text-sm text-gray-400">Field Assistant</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-white">Contacts</p>
                <p className="text-xs text-gray-500">Auto-sync</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                <Building2 className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-white">Jobs</p>
                <p className="text-xs text-gray-500">Auto-sync</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                <FileText className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-white">Notes</p>
                <p className="text-xs text-gray-500">Auto-sync</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg text-center">
                <Calendar className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-white">Activities</p>
                <p className="text-xs text-gray-500">Auto-sync</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h3 className="font-semibold text-white mb-4">Recent Sync Activity</h3>
            {syncLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {isConnected ? 'No sync activity yet' : 'Connect to JobNimbus to start syncing'}
              </div>
            ) : (
              <div className="space-y-2">
                {syncLogs.slice(0, 5).map((log) => {
                  const statusBadge = getStatusBadge(log.status);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${log.direction === 'inbound' ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                          {log.direction === 'inbound' ? (
                            <Download className={`h-4 w-4 ${log.direction === 'inbound' ? 'text-emerald-400' : 'text-orange-400'}`} />
                          ) : (
                            <Upload className="h-4 w-4 text-orange-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm">
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1)} {log.entity_type}
                          </p>
                          <p className="text-xs text-gray-500">{log.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {log.status}
                        </span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(log.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="font-semibold text-white">Sync Logs</h3>
            <button className="text-sm text-gray-400 hover:text-white">Clear logs</button>
          </div>
          <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
            {syncLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No sync logs yet</div>
            ) : (
              syncLogs.map((log) => {
                const statusBadge = getStatusBadge(log.status);
                return (
                  <div key={log.id} className="p-4 hover:bg-gray-700/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded mt-0.5 ${log.direction === 'inbound' ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                          {log.direction === 'inbound' ? (
                            <Download className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Upload className="h-4 w-4 text-orange-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white">
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1)} {log.entity_type}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">{log.message}</p>
                          {log.jobnimbus_id && (
                            <p className="text-xs text-gray-500 mt-1">
                              JobNimbus ID: {log.jobnimbus_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {log.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              Webhook Configuration
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Configure these webhooks in JobNimbus to receive real-time updates.
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Webhook URL</p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/jobnimbus/webhook` : '/api/jobnimbus/webhook'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/jobnimbus/webhook`);
                      alert('Copied to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Contact Events</p>
                  <p className="text-white">Create, Update, Delete</p>
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-sm text-gray-400">Job Events</p>
                  <p className="text-white">Create, Update, Status Change</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold text-white">Recent Webhook Events</h3>
            </div>
            <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
              {webhookEvents.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No webhook events received</div>
              ) : (
                webhookEvents.map((event) => (
                  <div key={event.id} className="p-4 hover:bg-gray-700/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white">{event.event_type}</p>
                        <p className="text-sm text-gray-400 mt-1 font-mono truncate max-w-md">
                          {event.payload_preview}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          event.processed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {event.processed ? 'Processed' : 'Pending'}
                        </span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(event.received_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 max-w-2xl">
          <h3 className="font-semibold text-white mb-6">Sync Settings</h3>
          
          <div className="space-y-6">
            {/* Auto Sync */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Auto Sync</p>
                <p className="text-sm text-gray-400">Automatically sync changes in the background</p>
              </div>
              <button
                onClick={() => setSyncSettings(s => ({ ...s, autoSync: !s.autoSync }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  syncSettings.autoSync ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  syncSettings.autoSync ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Sync Interval */}
            <div>
              <label className="text-white font-medium block mb-2">Sync Interval</label>
              <select
                value={syncSettings.syncInterval}
                onChange={(e) => setSyncSettings(s => ({ ...s, syncInterval: parseInt(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            </div>

            {/* Entity Toggles */}
            <div>
              <p className="text-white font-medium mb-3">Entities to Sync</p>
              <div className="space-y-3">
                {[
                  { key: 'syncContacts', label: 'Contacts', icon: Users },
                  { key: 'syncJobs', label: 'Jobs', icon: Building2 },
                  { key: 'syncNotes', label: 'Notes', icon: FileText },
                  { key: 'syncActivities', label: 'Activities', icon: Calendar },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <span className="text-white">{label}</span>
                    </div>
                    <button
                      onClick={() => setSyncSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        syncSettings[key as keyof typeof syncSettings] ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        syncSettings[key as keyof typeof syncSettings] ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={updateSettings}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
            </div>

            {/* Disconnect */}
            {isConnected && (
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={disconnectJobNimbus}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors"
                >
                  Disconnect JobNimbus
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
