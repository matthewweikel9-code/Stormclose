'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  Calculator,
  Search,
  MapPin,
  Clock,
  Loader2,
  Home,
  DollarSign,
  FileCheck,
  Upload,
  ExternalLink,
  Calendar,
  Sparkles,
  FileUp,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type DocTab = 'appointments' | 'reports' | 'xactimate' | 'quick-actions';

interface Appointment {
  id: string;
  mission_id: string;
  mission_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number | null;
  longitude?: number | null;
  homeowner_name: string | null;
  lead_id: string | null;
  outcome: string;
  completed_at: string | null;
  updated_at: string | null;
  exported_to_jobnimbus: boolean;
}

interface Report {
  id: string;
  property_address: string;
  roof_type: string;
  shingle_type: string;
  damage_notes: string;
  insurance_company: string;
  created_at: string;
}

interface XactimateEstimate {
  id: string;
  property_address: string;
  claim_number: string | null;
  insurance_carrier: string | null;
  original_rcv: number | null;
  status: string;
  created_at: string;
  lead_id?: string | null;
}

function normalizeAddress(addr: string): string {
  return (addr || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function addressesMatch(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

export default function DocumentsHubPage() {
  const [activeTab, setActiveTab] = useState<DocTab>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [estimates, setEstimates] = useState<XactimateEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [reportPanel, setReportPanel] = useState<{
    address: string;
    homeownerName?: string;
    lat?: number;
    lng?: number;
    promptForAddress?: boolean;
  } | null>(null);
  const [quickActionAddress, setQuickActionAddress] = useState('');
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAppointments = async () => {
    const res = await fetch('/api/documents/appointments');
    if (res.ok) {
      const data = await res.json();
      setAppointments(data.appointments || []);
    }
  };

  const fetchReports = async () => {
    const res = await fetch('/api/reports');
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports || []);
    }
  };

  const fetchEstimates = async () => {
    const res = await fetch('/api/xactimate');
    if (res.ok) {
      const data = await res.json();
      setEstimates(data.estimates || []);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAppointments(), fetchReports(), fetchEstimates()]).finally(() =>
      setLoading(false)
    );
  }, []);

  const handleExportDocument = async (
    entityType: 'report' | 'xactimate_estimate',
    entityId: string
  ) => {
    setExportingId(entityId);
    try {
      const res = await fetch('/api/integrations/jobnimbus/export-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (entityType === 'report') fetchReports();
        else fetchEstimates();
      } else {
        const msg = data.error || 'Export failed';
        alert(msg + (msg.includes('Connect') ? ' Go to Team → Integrations to connect JobNimbus.' : ''));
      }
    } catch (err) {
      alert('Export failed. Check your connection and try again.');
    } finally {
      setExportingId(null);
    }
  };

  const handleGenerateReport = async (address: string, homeownerName?: string, lat?: number, lng?: number) => {
    setReportPanel({ address, homeownerName, lat, lng });
    setReportContent(null);
    setReportError(null);
    setReportLoading(true);
    try {
      const res = await fetch('/api/reports/generate-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          homeownerName: homeownerName || undefined,
          lat: lat ?? 0,
          lng: lng ?? 0,
          saveToReports: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportContent(data.content || '');
      } else {
        setReportError(data.error || 'Failed to generate report');
      }
    } catch (err) {
      setReportError('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportPanel || !reportContent) return;
    setReportSaving(true);
    setReportError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_address: reportPanel.address,
          report_content: reportContent,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchReports();
        setReportPanel(null);
        setReportContent(null);
      } else {
        setReportError(data.error || 'Failed to save report');
      }
    } catch (err) {
      setReportError('Failed to save report');
    } finally {
      setReportSaving(false);
    }
  };

  const handleUploadXactimate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/xactimate/upload', { method: 'POST', body: formData });
      if (res.ok) {
        await fetchEstimates();
      } else {
        const data = await res.json();
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const timeAgo = (date: string | null) => {
    if (!date) return '—';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (v: number | null) => {
    if (v == null) return '—';
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  const fullAddress = (a: { address: string; city?: string; state?: string; zip?: string }) =>
    [a.address, a.city, a.state, a.zip].filter(Boolean).join(', ');

  const filteredAppointments = appointments.filter(
    (a) =>
      !searchQuery ||
      a.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.mission_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredReports = reports.filter(
    (r) =>
      !searchQuery ||
      (r.property_address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredEstimates = estimates.filter(
    (e) =>
      !searchQuery ||
      (e.property_address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { id: DocTab; label: string; count: number }[] = [
    { id: 'appointments', label: 'Appointments', count: appointments.length },
    { id: 'reports', label: 'Reports', count: reports.length },
    { id: 'xactimate', label: 'Xactimate', count: estimates.length },
    { id: 'quick-actions', label: 'Quick Actions', count: 0 },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow shadow-lg shadow-storm-purple/20">
              <FileText className="h-5 w-5 text-white" />
            </span>
            Documents Hub
          </h1>
          <p className="mt-1 text-sm text-storm-muted">
            Appointments from Storm Ops, reports, Xactimate estimates, and export to JobNimbus
          </p>
        </div>
      </div>

      {/* Tab Bar + Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-1 storm-card rounded-xl p-1.5 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-storm-purple/15 text-white shadow-sm'
                  : 'text-storm-subtle hover:text-storm-muted hover:bg-storm-z2/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-2xs px-1.5 py-0.5 rounded-md ${
                    activeTab === tab.id ? 'bg-storm-purple/20 text-storm-glow' : 'bg-storm-z2 text-storm-subtle'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {activeTab !== 'quick-actions' && (
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-storm-z1 border border-storm-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-storm-subtle focus:outline-none focus:border-storm-purple/50"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-storm-glow animate-spin" />
          <span className="ml-3 text-storm-muted text-sm">Loading...</span>
        </div>
      ) : activeTab === 'appointments' ? (
        filteredAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAppointments.map((apt) => {
              const linkedReport = reports.find((r) =>
                addressesMatch(r.property_address, apt.address)
              );
              const linkedEstimate = estimates.find(
                (e) =>
                  addressesMatch(e.property_address, apt.address) ||
                  (apt.lead_id && e.lead_id === apt.lead_id)
              );
              return (
                <div key={apt.id} className="storm-card-interactive p-5 group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-storm-purple/10 flex items-center justify-center">
                        <Home className="w-4 h-4 text-storm-glow" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-white text-sm truncate max-w-[180px]">
                          {apt.address}
                        </h3>
                        <p className="text-2xs text-storm-subtle">
                          {apt.mission_name} • {apt.city && apt.state ? `${apt.city}, ${apt.state}` : apt.zip}
                        </p>
                      </div>
                    </div>
                    {apt.exported_to_jobnimbus && (
                      <Badge variant="success" className="text-2xs">Exported</Badge>
                    )}
                  </div>
                  {apt.homeowner_name && (
                    <p className="text-2xs text-storm-subtle mb-2">{apt.homeowner_name}</p>
                  )}
                  <div className="flex items-center gap-2 text-2xs text-storm-subtle mb-3">
                    <Clock className="w-3 h-3" />
                    {timeAgo(apt.completed_at || apt.updated_at)}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-storm-border/50 mb-3">
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs ${
                        linkedReport ? 'bg-blue-500/10 text-blue-400' : 'bg-storm-z2 text-storm-subtle'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      Report
                    </div>
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs ${
                        linkedEstimate ? 'bg-emerald-500/10 text-emerald-400' : 'bg-storm-z2 text-storm-subtle'
                      }`}
                    >
                      <Calculator className="w-3 h-3" />
                      Xactimate
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        handleGenerateReport(
                          fullAddress(apt),
                          apt.homeowner_name || undefined,
                          apt.latitude ?? undefined,
                          apt.longitude ?? undefined
                        )
                      }
                      className="button-secondary text-xs flex items-center gap-1.5 py-1.5 px-2"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Report
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="button-secondary text-xs flex items-center gap-1.5 py-1.5 px-2"
                    >
                      <Upload className="w-3 h-3" />
                      Upload Xactimate
                    </button>
                    {apt.exported_to_jobnimbus ? (
                      <span className="text-2xs text-emerald-400 flex items-center gap-1 px-2 py-1.5">
                        <FileCheck className="w-3 h-3" />
                        Exported to JN
                      </span>
                    ) : (
                      <span className="text-2xs text-storm-subtle px-2 py-1.5">
                        Lead exported on Appointment Set
                      </span>
                    )}
                    <Link
                      href="/dashboard/storm-map"
                      className="button-secondary text-xs flex items-center gap-1.5 py-1.5 px-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Storm Ops
                    </Link>
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(fullAddress(apt))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="storm-card p-12 text-center">
            <div className="w-16 h-16 bg-storm-z2 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-storm-subtle" />
            </div>
            <h3 className="text-white font-medium text-sm mb-1.5">No appointments yet</h3>
            <p className="text-storm-subtle text-xs mb-4">
              Click &quot;Appointment Set&quot; on mission stops in Storm Ops to add roofs here
            </p>
            <Link href="/dashboard/storm-map" className="button-primary inline-flex items-center gap-2 text-xs">
              <ExternalLink className="w-3.5 h-3.5" />
              Open Storm Ops
            </Link>
          </div>
        )
      ) : activeTab === 'reports' ? (
        filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((r) => (
              <div key={r.id} className="storm-card-interactive p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white text-sm truncate max-w-[200px]">
                    {r.property_address}
                  </h3>
                </div>
                <p className="text-2xs text-storm-subtle mb-2">
                  {r.roof_type} • {r.insurance_company || 'N/A'}
                </p>
                <div className="flex items-center gap-2 text-2xs text-storm-subtle mb-3">
                  <Clock className="w-3 h-3" />
                  {formatDate(r.created_at)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportDocument('report', r.id)}
                    disabled={!!exportingId}
                    className="button-primary text-xs flex items-center gap-1.5 py-2 px-3"
                  >
                    {exportingId === r.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileCheck className="w-3 h-3" />
                    )}
                    Export to JobNimbus
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="storm-card p-12 text-center">
            <FileText className="w-12 h-12 text-storm-subtle mx-auto mb-4" />
            <h3 className="text-white font-medium text-sm mb-1.5">No reports yet</h3>
            <p className="text-storm-subtle text-xs">
              Generate reports from appointments or use Quick Actions
            </p>
          </div>
        )
      ) : activeTab === 'xactimate' ? (
        filteredEstimates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEstimates.map((e) => (
              <div key={e.id} className="storm-card-interactive p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white text-sm truncate max-w-[200px]">
                    {e.property_address}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {e.original_rcv != null && (
                    <span className="text-sm font-semibold text-emerald-400">
                      {formatCurrency(e.original_rcv)}
                    </span>
                  )}
                  <Badge variant="default">{e.status}</Badge>
                </div>
                <p className="text-2xs text-storm-subtle mb-3">
                  {e.insurance_carrier || 'N/A'} • {e.claim_number || '—'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportDocument('xactimate_estimate', e.id)}
                    disabled={!!exportingId}
                    className="button-primary text-xs flex items-center gap-1.5 py-2 px-3"
                  >
                    {exportingId === e.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileCheck className="w-3 h-3" />
                    )}
                    Export to JobNimbus
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="storm-card p-12 text-center">
            <Calculator className="w-12 h-12 text-storm-subtle mx-auto mb-4" />
            <h3 className="text-white font-medium text-sm mb-1.5">No Xactimate estimates yet</h3>
            <p className="text-storm-subtle text-xs mb-4">
              Upload .esx, .pdf, or .xml files from Xactimate
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="button-primary inline-flex items-center gap-2 text-xs"
            >
              <FileUp className="w-3.5 h-3.5" />
              Upload Estimate
            </button>
          </div>
        )
      ) : (
        <div className="storm-card p-8">
          <h3 className="font-medium text-white text-sm mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="storm-card-interactive p-4 flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">OCR Estimate</p>
                <p className="text-2xs text-storm-subtle">Upload Xactimate .esx, .pdf, or .xml</p>
              </div>
            </button>
            <button
              onClick={() => {
                setReportPanel({ address: '', promptForAddress: true });
                setReportContent(null);
                setReportError(null);
                setQuickActionAddress('');
              }}
              className="storm-card-interactive p-4 flex items-center gap-3 text-left w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-storm-purple/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-storm-glow" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Generate Report</p>
                <p className="text-2xs text-storm-subtle">AI property report for any address</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Report Generation Panel */}
      {reportPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="storm-card w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-storm-border">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-storm-glow" />
                AI Report Generator
              </h2>
              <button
                onClick={() => {
                  setReportPanel(null);
                  setReportContent(null);
                  setReportError(null);
                  setQuickActionAddress('');
                }}
                className="p-2 text-storm-subtle hover:text-white rounded-lg hover:bg-storm-z2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportPanel.promptForAddress ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-storm-muted">Enter the property address to generate an AI damage assessment report.</p>
                <input
                  type="text"
                  value={quickActionAddress}
                  onChange={(e) => setQuickActionAddress(e.target.value)}
                  placeholder="123 Main St, City, ST 12345"
                  className="w-full bg-storm-z1 border border-storm-border rounded-xl px-4 py-3 text-sm text-white placeholder-storm-subtle focus:outline-none focus:border-storm-purple/50"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleGenerateReport(quickActionAddress.trim(), undefined, undefined, undefined)
                    }
                    disabled={!quickActionAddress.trim() || reportLoading}
                    className="button-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Report
                  </button>
                  <button
                    onClick={() => {
                      setReportPanel(null);
                      setQuickActionAddress('');
                    }}
                    className="button-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : reportLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-storm-glow animate-spin mb-4" />
                <p className="text-storm-muted text-sm">Generating AI report for {reportPanel.address}...</p>
              </div>
            ) : reportError ? (
              <div className="p-6">
                <p className="text-red-400 text-sm mb-4">{reportError}</p>
                <button
                  onClick={() => setReportPanel(null)}
                  className="button-secondary"
                >
                  Close
                </button>
              </div>
            ) : reportContent ? (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-storm-muted bg-storm-z1 rounded-xl p-4">
                      {reportContent}
                    </pre>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border-t border-storm-border">
                  <button
                    onClick={handleSaveReport}
                    disabled={reportSaving}
                    className="button-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {reportSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                    Save to Reports
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(reportContent || '');
                      setReportCopied(true);
                      setTimeout(() => setReportCopied(false), 2000);
                    }}
                    className="button-secondary flex items-center gap-2"
                  >
                    {reportCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {reportCopied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => {
                      setReportPanel(null);
                      setReportContent(null);
                    }}
                    className="button-secondary"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".esx,.pdf,.xml"
        className="hidden"
        onChange={handleUploadXactimate}
      />
    </div>
  );
}
