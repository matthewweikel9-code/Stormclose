'use client';

import { useState, useEffect } from 'react';
import {
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface IntegrationStatus {
  connected: boolean;
  connectedAt: string | null;
}

export default function IntegrationsPage() {
  const [jnApiKey, setJnApiKey] = useState('');
  const [jnStatus, setJnStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkJobNimbusStatus();
  }, []);

  const checkJobNimbusStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/jobnimbus/connect');
      if (res.ok) {
        const data = await res.json();
        setJnStatus(data);
      }
    } catch (err) {
      console.error('Failed to check JN status:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectJobNimbus = async () => {
    if (!jnApiKey.trim()) {
      setError('Please enter your JobNimbus API key');
      return;
    }

    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/integrations/jobnimbus/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: jnApiKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to connect');
        return;
      }

      setSuccess('JobNimbus connected successfully!');
      setJnApiKey('');
      checkJobNimbusStatus();
    } catch (err) {
      setError('Failed to connect to JobNimbus');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectJobNimbus = async () => {
    if (!confirm('Are you sure you want to disconnect JobNimbus?')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/integrations/jobnimbus/connect', {
        method: 'DELETE',
      });

      if (res.ok) {
        setJnStatus({ connected: false, connectedAt: null });
        setSuccess('JobNimbus disconnected');
      }
    } catch (err) {
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="mt-1 text-slate-400">
          Connect StormClose AI with your favorite tools
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <XCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* JobNimbus Integration */}
      <div className="bg-storm-z2 rounded-xl border border-[#334155] overflow-hidden">
        <div className="p-6 border-b border-[#334155]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">JobNimbus</h2>
                <p className="text-sm text-slate-400">
                  Export leads directly to your JobNimbus CRM
                </p>
              </div>
            </div>
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 text-slate-400 animate-spin" />
            ) : jnStatus?.connected ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium">
                <CheckCircleIcon className="h-4 w-4" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1 bg-slate-500/10 text-slate-400 rounded-full text-sm font-medium">
                <XCircleIcon className="h-4 w-4" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {jnStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#0F172A] rounded-lg">
                <div>
                  <p className="text-sm text-slate-400">Connected since</p>
                  <p className="text-white font-medium">
                    {jnStatus.connectedAt
                      ? new Date(jnStatus.connectedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Unknown'}
                  </p>
                </div>
                <button
                  onClick={disconnectJobNimbus}
                  disabled={disconnecting}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors font-medium disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-400 mb-2">What you can do:</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Export leads to JobNimbus as contacts</li>
                  <li>• Lead scores and storm data are included in notes</li>
                  <li>• Leads are tagged with &quot;StormClose&quot; for easy filtering</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-amber-400">How to get your API key:</h4>
                  <ol className="text-sm text-slate-400 mt-2 space-y-1">
                    <li>1. Log in to your JobNimbus account</li>
                    <li>2. Go to Settings → API Keys</li>
                    <li>3. Click &quot;Create API Key&quot;</li>
                    <li>4. Copy the key and paste it below</li>
                  </ol>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  JobNimbus API Key
                </label>
                <input
                  type="password"
                  value={jnApiKey}
                  onChange={(e) => setJnApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-3 bg-[#0F172A] border border-[#334155] rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={connectJobNimbus}
                disabled={connecting || !jnApiKey.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-5 w-5" />
                    Connect JobNimbus
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Xactimate Integration (Coming Soon) */}
      <div className="mt-6 bg-storm-z2 rounded-xl border border-[#334155] overflow-hidden opacity-60">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Xactimate</h2>
                <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs font-medium">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Import ESX files for supplement analysis
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
