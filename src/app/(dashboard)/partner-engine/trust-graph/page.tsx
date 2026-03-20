'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowRight,
  Loader2,
  Sparkles,
  FileCheck,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Handshake,
  Target,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface SourceIntelligence {
  partnerId: string;
  name: string;
  type: string;
  tier: string;
  referralsSent: number;
  closeRate: number;
  avgJobValue: number;
  revenue: number;
  lastActivityAt: string | null;
  healthScore: number;
}

interface Referral {
  id: string;
  partnerId: string | null;
  partnerName: string | null;
  homeownerName: string | null;
  propertyAddress: string;
  status: string;
  contractValue: number;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string | null;
}

interface TrustPack {
  sourceName: string | null;
  sourceLabel: string;
  personalizedIntro: string;
  companyCredibility: string;
  propertyAddress: string;
  stormContext: string | null;
  estimateRange: { low: number; high: number } | null;
  nextSteps: string;
  cta: string;
}

interface CloseStrategy {
  firstCallScript: string;
  likelyObjection: string;
  rebuttal: string;
  urgencyAngle: string;
  credibilityAngle: string;
  recommendedAction: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    realtor: 'Realtor',
    insurance_agent: 'Insurance Agent',
    property_manager: 'Property Manager',
    home_inspector: 'Home Inspector',
    contractor: 'Contractor',
    other: 'Partner',
  };
  return map[t] ?? t;
}

function getHealthColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export default function TrustGraphPage() {
  const [sources, setSources] = useState<SourceIntelligence[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const [trustPack, setTrustPack] = useState<TrustPack | null>(null);
  const [closeStrategy, setCloseStrategy] = useState<CloseStrategy | null>(null);
  const [trustPackLoading, setTrustPackLoading] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [objectionResponse, setObjectionResponse] = useState<string | null>(null);
  const [objectionLoading, setObjectionLoading] = useState(false);
  const [objectionError, setObjectionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourcesRes, refsRes] = await Promise.all([
        fetch('/api/trust-graph/sources'),
        fetch('/api/partner-engine/referrals'),
      ]);

      const sourcesJson = (await sourcesRes.json()) as ApiEnvelope<{ sources: SourceIntelligence[] }>;
      const refsJson = (await refsRes.json()) as ApiEnvelope<Referral[]>;

      if (sourcesJson.error) throw new Error(sourcesJson.error);
      if (refsJson.error) throw new Error(refsJson.error);

      setSources(sourcesJson.data?.sources ?? []);
      setReferrals(refsJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Trust Graph');
      setSources([]);
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedReferralId) {
      setTrustPack(null);
      setCloseStrategy(null);
      setObjectionResponse(null);
      setObjectionError(null);
      return;
    }
    setTrustPackLoading(true);
    setStrategyLoading(true);
    setTrustPack(null);
    setCloseStrategy(null);

    Promise.all([
      fetch('/api/trust-graph/trust-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId: selectedReferralId }),
      }).then(async (r) => {
        const json = (await r.json()) as ApiEnvelope<TrustPack>;
        if (json.data) setTrustPack(json.data);
      }).finally(() => setTrustPackLoading(false)),

      fetch('/api/trust-graph/close-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId: selectedReferralId }),
      }).then(async (r) => {
        const json = (await r.json()) as ApiEnvelope<CloseStrategy>;
        if (json.data) setCloseStrategy(json.data);
      }).finally(() => setStrategyLoading(false)),
    ]);
  }, [selectedReferralId]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/partner-engine/referrals/${id}/sync`, { method: 'POST' });
      if (!res.ok) {
        const json = (await res.json()) as ApiEnvelope<null>;
        throw new Error(json.error ?? 'Sync failed');
      }
      void fetchData();
    } catch {
      // ignore
    } finally {
      setSyncingId(null);
    }
  };

  const handleGenerateObjection = async () => {
    if (!closeStrategy) return;
    setObjectionLoading(true);
    setObjectionError(null);
    setObjectionResponse(null);
    try {
      const res = await fetch('/api/generate-objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objection: closeStrategy.likelyObjection,
          projectType: 'Roof replacement and insurance claim support',
          keyBenefits: [
            'Licensed crew',
            'Insurance documentation support',
            'Clean timeline communication',
            closeStrategy.credibilityAngle,
          ].filter(Boolean),
          evidencePoints: [closeStrategy.rebuttal].filter(Boolean),
          tone: 'consultative',
          homeownerName: selectedReferral?.homeownerName ?? undefined,
        }),
      });
      const json = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate');
      setObjectionResponse(json.content ?? null);
    } catch (e) {
      setObjectionError(e instanceof Error ? e.message : 'Failed to generate objection response');
    } finally {
      setObjectionLoading(false);
    }
  };

  const handleCopyTrustPack = () => {
    if (!trustPack) return;
    const text = [
      trustPack.personalizedIntro,
      '',
      trustPack.companyCredibility,
      '',
      trustPack.propertyAddress,
      trustPack.stormContext ? `\n${trustPack.stormContext}` : '',
      '',
      trustPack.nextSteps,
      '',
      trustPack.cta,
    ].filter(Boolean).join('\n');
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedReferral = referrals.find((r) => r.id === selectedReferralId);

  if (loading && sources.length === 0 && referrals.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="storm-card p-6">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-4 w-80 rounded mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="storm-card p-5">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="skeleton h-7 w-24 rounded-lg mt-3" />
              <div className="skeleton h-3 w-16 rounded mt-2" />
            </div>
          ))}
        </div>
        <div className="storm-card p-12">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-3/4 rounded mt-3" />
          <div className="skeleton h-4 w-1/2 rounded mt-3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <Link href="/partner-engine" className="button-secondary text-sm">
            Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <section className="storm-card-glow overflow-hidden border-storm-purple/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
              <Shield className="h-6 w-6 text-storm-glow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Trust Graph</h1>
              <p className="text-sm text-storm-muted">
                Convert referred homeowners faster. Build trust instantly. Strengthen partner relationships.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/partner-engine/referrals" className="button-primary flex items-center gap-2 text-sm">
              <ArrowRight className="h-4 w-4" />
              Work Referrals
            </Link>
            <Link href="/partner-engine/partners" className="button-secondary flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Manage Partners
            </Link>
          </div>
        </div>
      </section>

      {/* Top Sources */}
      <section className="storm-card overflow-hidden">
        <div className="glow-line" />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-storm-glow" />
            <h3 className="text-sm font-semibold text-white">Top Sources by Revenue & Health</h3>
            <button onClick={() => void fetchData()} className="ml-auto p-2 text-storm-subtle hover:text-white rounded-lg hover:bg-storm-z2">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {sources.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 text-storm-subtle mx-auto mb-3" />
              <p className="text-sm font-medium text-white">No referral sources yet</p>
              <p className="text-xs text-storm-subtle mt-1">Add partners and receive referrals to see source intelligence</p>
              <Link href="/partner-engine/partners" className="button-primary mt-4 inline-flex gap-2 text-sm">
                <ExternalLink className="h-4 w-4" />
                Add Partners
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.slice(0, 8).map((s) => (
                <div
                  key={s.partnerId}
                  className="flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-storm-z2/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-purple/15 text-storm-glow">
                    <Handshake className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{s.name}</span>
                      <Badge variant="default">{typeLabel(s.type)}</Badge>
                      <span className={`text-xs font-medium ${getHealthColor(s.healthScore)}`}>
                        Health {s.healthScore}
                      </span>
                    </div>
                    <span className="text-2xs text-storm-subtle">
                      {s.referralsSent} referrals · {s.closeRate.toFixed(0)}% close · {formatCurrency(s.avgJobValue)} avg
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(s.revenue)}</p>
                    <p className="text-2xs text-storm-subtle">Last: {formatDate(s.lastActivityAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Referrals + Trust Pack + Close Strategy */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Referrals */}
        <div className="storm-card overflow-hidden lg:col-span-1">
          <div className="glow-line" />
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <ArrowRight className="h-4 w-4 text-storm-glow" />
              Recent Referrals
            </h3>
            {referrals.length === 0 ? (
              <div className="py-8 text-center">
                <ArrowRight className="h-10 w-10 text-storm-subtle mx-auto mb-2" />
                <p className="text-xs text-storm-subtle">No referrals yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {referrals.slice(0, 12).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReferralId(r.id)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                      selectedReferralId === r.id ? 'bg-storm-purple/15 border border-storm-purple/30' : 'hover:bg-storm-z2/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-white truncate">{r.propertyAddress}</p>
                    <p className="text-2xs text-storm-subtle">{r.partnerName ?? 'Direct'} · {statusLabel(r.status)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trust Pack Preview */}
        <div className="storm-card overflow-hidden lg:col-span-1">
          <div className="glow-line" />
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-storm-glow" />
              Trust Pack
            </h3>
            {!selectedReferralId ? (
              <div className="py-8 text-center">
                <Target className="h-10 w-10 text-storm-subtle mx-auto mb-2" />
                <p className="text-xs text-storm-subtle">Select a referral to generate Trust Pack</p>
              </div>
            ) : trustPackLoading ? (
              <div className="py-8 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-storm-glow" />
                <span className="text-sm text-storm-muted">Generating...</span>
              </div>
            ) : trustPack ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-storm-z1 border border-storm-border p-3 text-xs text-storm-muted space-y-2">
                  <p>{trustPack.personalizedIntro}</p>
                  <p>{trustPack.companyCredibility}</p>
                  {trustPack.stormContext && <p className="text-storm-glow">{trustPack.stormContext}</p>}
                  <p>{trustPack.nextSteps}</p>
                  <p className="font-medium text-white">{trustPack.cta}</p>
                </div>
                <button onClick={handleCopyTrustPack} className="button-secondary w-full flex items-center justify-center gap-2 text-xs">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Trust Pack'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* AI Close Strategy */}
        <div className="storm-card overflow-hidden lg:col-span-1">
          <div className="glow-line" />
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-storm-glow" />
              Close Strategy
            </h3>
            {!selectedReferralId ? (
              <div className="py-8 text-center">
                <MessageSquare className="h-10 w-10 text-storm-subtle mx-auto mb-2" />
                <p className="text-xs text-storm-subtle">Select a referral for AI close strategy</p>
              </div>
            ) : strategyLoading ? (
              <div className="py-8 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-storm-glow" />
                <span className="text-sm text-storm-muted">Generating...</span>
              </div>
            ) : closeStrategy ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">First Call Script</p>
                  <p className="text-storm-muted">{closeStrategy.firstCallScript}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">Likely Objection</p>
                  <p className="text-storm-muted">{closeStrategy.likelyObjection}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">Rebuttal</p>
                  <p className="text-storm-muted">{closeStrategy.rebuttal}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">Urgency</p>
                  <p className="text-storm-glow">{closeStrategy.urgencyAngle}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">Next Action</p>
                  <p className="text-white font-medium">{closeStrategy.recommendedAction}</p>
                </div>
                <div className="pt-3 border-t border-storm-border">
                  <button
                    type="button"
                    onClick={() => void handleGenerateObjection()}
                    disabled={objectionLoading}
                    className="button-primary w-full flex items-center justify-center gap-2 text-xs"
                  >
                    {objectionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Generate objection response
                  </button>
                  {objectionError && (
                    <p className="text-xs text-red-400 mt-2">{objectionError}</p>
                  )}
                  {objectionResponse && (
                    <div className="mt-3 rounded-xl bg-storm-z0 border border-storm-border p-3">
                      <p className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-1">AI response</p>
                      <p className="text-sm text-storm-muted whitespace-pre-wrap">{objectionResponse}</p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(objectionResponse ?? '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="mt-2 text-xs text-storm-glow hover:underline flex items-center gap-1"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Partner Update Timeline + Actions */}
      {selectedReferral && (
        <div className="storm-card overflow-hidden">
          <div className="glow-line" />
          <div className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleSync(selectedReferral.id)}
                disabled={!!selectedReferral.lastSyncedAt || syncingId === selectedReferral.id}
                className="button-primary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {syncingId === selectedReferral.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck className="h-4 w-4" />
                )}
                Sync to JobNimbus
              </button>
              {selectedReferral.lastSyncedAt && (
                <span className="flex items-center gap-2 text-sm text-emerald-400">
                  <FileCheck className="h-4 w-4" />
                  Synced {formatDate(selectedReferral.lastSyncedAt)}
                </span>
              )}
              <Link
                href="/partner-engine/referrals"
                className="button-secondary flex items-center gap-2 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Referrals
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
