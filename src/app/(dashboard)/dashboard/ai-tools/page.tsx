'use client';

import React, { useState, useRef, useEffect, useMemo, FormEvent } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Sparkles,
  Building2,
  FileText,
  Shield,
  Send,
  Copy,
  Check,
  Loader2,
  Search,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  BookOpen,
  Target,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

type ActiveTab = 'objection' | 'negotiation' | 'supplements' | 'carriers';

const tabs: { id: ActiveTab; label: string; icon: React.ElementType; badge?: string; badgeColor?: string }[] = [
  { id: 'objection', label: 'Objection Handler', icon: MessageSquare, badge: 'Pro', badgeColor: 'bg-[#6D5CFF]/20 text-[#A78BFA]' },
  { id: 'negotiation', label: 'Negotiation Coach', icon: Shield, badge: 'Pro+', badgeColor: 'bg-amber-500/20 text-amber-400' },
  { id: 'supplements', label: 'Supplement Generator', icon: FileText, badge: 'Pro+', badgeColor: 'bg-amber-500/20 text-amber-400' },
  { id: 'carriers', label: 'Carrier Intelligence', icon: Building2, badge: 'Enterprise', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
];

export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('objection');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D5CFF] to-[#A78BFA] shadow-lg shadow-[#6D5CFF]/20">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          AI Tools
        </h1>
        <p className="mt-1 text-sm text-slate-400">AI-powered sales coaching, objection handling, and insurance intelligence</p>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl bg-[#111827] p-1.5 border border-[#1F2937] scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#6D5CFF]/15 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-[#A78BFA]' : ''}`} />
              {tab.label}
              {tab.badge && (
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {activeTab === 'objection' && <ObjectionPanel />}
        {activeTab === 'negotiation' && <NegotiationPanel />}
        {activeTab === 'supplements' && <SupplementPanel />}
        {activeTab === 'carriers' && <CarrierPanel />}
      </div>
    </div>
  );
}

// ============================================================================
// OBJECTION HANDLER PANEL
// ============================================================================

interface ObjectionFormState {
  homeownerName: string;
  objection: string;
  projectType: string;
  tone: 'consultative' | 'confident' | 'empathetic';
}

function ObjectionPanel() {
  const [form, setForm] = useState<ObjectionFormState>({
    homeownerName: '',
    objection: '',
    projectType: 'Roof replacement and insurance claim support',
    tone: 'consultative',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.objection.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          keyBenefits: ['Storm damage repair', 'Insurance claim assistance', 'Free inspection'],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate response');
      setResult(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#A78BFA]" />
          Generate Response
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Homeowner Name</label>
            <input
              type="text"
              value={form.homeownerName}
              onChange={(e) => setForm({ ...form, homeownerName: e.target.value })}
              placeholder="e.g., John Smith"
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Objection *</label>
            <textarea
              value={form.objection}
              onChange={(e) => setForm({ ...form, objection: e.target.value })}
              placeholder='e.g., "I need to think about it" or "Your price is too high"'
              rows={4}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF] resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(['consultative', 'confident', 'empathetic'] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setForm({ ...form, tone })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                    form.tone === tone
                      ? 'border-[#6D5CFF] bg-[#6D5CFF]/10 text-white'
                      : 'border-[#1F2937] bg-[#0B0F1A] text-slate-400 hover:border-[#374151]'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !form.objection.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Response
          </button>
        </form>

        {/* Common Objections Quick Access */}
        <div className="mt-6 border-t border-[#1F2937] pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Common Objections</p>
          <div className="space-y-1">
            {[
              'I need to get more quotes',
              'My insurance will deny the claim',
              'I can\'t afford the deductible',
              'I want to wait until next year',
              'I don\'t trust contractors',
            ].map((obj) => (
              <button
                key={obj}
                onClick={() => setForm({ ...form, objection: obj })}
                className="w-full text-left rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors"
              >
                &ldquo;{obj}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Response */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">AI Response</h3>
          {result && (
            <button
              onClick={copyResponse}
              className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] px-3 py-1.5 text-xs text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
        {result ? (
          <div className="prose prose-invert max-w-none">
            <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Enter an objection and generate a response</p>
            <p className="text-xs text-slate-500 mt-1">AI will craft a professional, persuasive response</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NEGOTIATION COACH PANEL
// ============================================================================

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const CARRIERS = [
  "State Farm", "Allstate", "Liberty Mutual", "USAA", "Farmers", "Progressive",
  "Nationwide", "Travelers", "American Family", "GEICO", "Other"
];

interface NegMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function NegotiationPanel() {
  const [state, setState] = useState('');
  const [carrier, setCarrier] = useState('');
  const [objectionType, setObjectionType] = useState('');
  const [situation, setSituation] = useState('');
  const [messages, setMessages] = useState<NegMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!situation.trim() || !state) {
      setError('Please enter your situation and select a state');
      return;
    }

    const userMessage: NegMessage = { role: 'user', content: situation, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setSituation('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation: userMessage.content,
          state,
          carrier: carrier || undefined,
          objectionType: objectionType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get coaching');

      setMessages((prev) => [...prev, { role: 'assistant', content: data.coaching, timestamp: new Date() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Setup Panel */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#A78BFA]" />
          Negotiation Setup
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">State *</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
            >
              <option value="">Select state...</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Insurance Carrier</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
            >
              <option value="">Select carrier...</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Issue Type</label>
            <select
              value={objectionType}
              onChange={(e) => setObjectionType(e.target.value)}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
            >
              <option value="">Select type...</option>
              {['O&P Denial', 'Depreciation Dispute', 'Line Item Dispute', 'Scope of Work', 'Coverage Denial', 'Low Estimate', 'Other'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="lg:col-span-2 rounded-xl border border-[#1F2937] bg-[#111827] flex flex-col h-[600px]">
        <div className="p-4 border-b border-[#1F2937]">
          <h3 className="text-lg font-semibold text-white">AI Negotiation Coach</h3>
          <p className="text-xs text-slate-500">Describe your situation and get expert negotiation guidance</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Shield className="h-12 w-12 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Start a conversation with your AI coach</p>
              <p className="text-xs text-slate-500 mt-1">Describe the insurance negotiation situation you&apos;re facing</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#6D5CFF]/20 text-white'
                  : 'bg-[#0B0F1A] border border-[#1F2937] text-slate-300'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] text-slate-500 mt-2">{msg.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-[#0B0F1A] border border-[#1F2937] px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-[#A78BFA]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#1F2937]">
          {error && (
            <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {error}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Describe your negotiation situation..."
              className="flex-1 rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !situation.trim() || !state}
              className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUPPLEMENT GENERATOR PANEL
// ============================================================================

const DAMAGE_TYPES = ['Hail Damage', 'Wind Damage', 'Storm Damage', 'Water Damage', 'Fire Damage', 'Tree Impact', 'Mixed Damage'];
const ROOF_TYPES = ['Asphalt Shingle', 'Metal', 'Tile', 'Slate', 'Wood Shake', 'Flat/TPO', 'EPDM'];

function SupplementPanel() {
  const [adjusterEstimate, setAdjusterEstimate] = useState('');
  const [damageType, setDamageType] = useState('');
  const [state, setState] = useState('');
  const [roofType, setRoofType] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/supplements/ocr', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setOcrResult(data);
        if (data.lineItems) {
          const total = data.lineItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
          setAdjusterEstimate(`$${total.toLocaleString()}`);
        }
      }
    } catch {
      setError('OCR processing failed');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const generateSupplement = async () => {
    if (!adjusterEstimate.trim() || !damageType || !state) {
      setError('Please fill in required fields');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjusterEstimate,
          damageType,
          state,
          roofType,
          ocrData: ocrResult,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate supplement');
      setResult(data.supplement || data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#A78BFA]" />
            Supplement Details
          </h3>

          {/* OCR Upload */}
          <div className="mb-4 rounded-lg border-2 border-dashed border-[#1F2937] p-4 text-center hover:border-[#6D5CFF]/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleOcrUpload} className="hidden" />
            {isOcrProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#A78BFA]" />
                <span className="text-sm text-slate-400">Processing document...</span>
              </div>
            ) : ocrResult ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Check className="h-5 w-5" />
                <span className="text-sm">Document processed successfully</span>
              </div>
            ) : (
              <>
                <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Upload adjuster estimate (PDF/Image)</p>
                <p className="text-xs text-slate-500">OCR will extract line items automatically</p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Adjuster Estimate Amount *</label>
              <input
                type="text"
                value={adjusterEstimate}
                onChange={(e) => setAdjusterEstimate(e.target.value)}
                placeholder="e.g., $8,500"
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Damage Type *</label>
                <select
                  value={damageType}
                  onChange={(e) => setDamageType(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
                >
                  <option value="">Select...</option>
                  {DAMAGE_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">State *</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
                >
                  <option value="">Select...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Roof Type</label>
              <select
                value={roofType}
                onChange={(e) => setRoofType(e.target.value)}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6D5CFF]"
              >
                <option value="">Select...</option>
                {ROOF_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}

          <button
            onClick={generateSupplement}
            disabled={loading || !adjusterEstimate.trim() || !damageType || !state}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Generate Supplement
          </button>
        </div>
      </div>

      {/* Result */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Generated Supplement</h3>
        {result ? (
          <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
            {result}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Fill in details and generate a supplement</p>
            <p className="text-xs text-slate-500 mt-1">AI will identify missing line items and generate documentation</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CARRIER INTELLIGENCE PANEL
// ============================================================================

interface CarrierSummary {
  id: string;
  name: string;
  approvalRate: number;
  avgClaimValue: number;
  supplementSuccessRate: number;
}

interface CarrierDetails {
  name: string;
  approvalRate: number;
  avgClaimValue: number;
  commonDenials: string[];
  supplementSuccessRate: number;
  avgResponseTime: string;
  negotiationTips: string[];
  preferredDocumentation: string[];
}

function CarrierPanel() {
  const [carriers, setCarriers] = useState<CarrierSummary[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchCarriers = async () => {
      try {
        const res = await fetch('/api/carriers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          setCarriers(data.carriers || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCarriers();
  }, []);

  const fetchDetails = async (carrierId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch('/api/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: carrierId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCarrier(data.carrier);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Carrier List */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#A78BFA]" />
          Insurance Carriers
        </h3>
        {carriers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No carrier data available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {carriers.map((c) => (
              <button
                key={c.id}
                onClick={() => fetchDetails(c.id)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  selectedCarrier?.name === c.name
                    ? 'border-[#6D5CFF] bg-[#6D5CFF]/10'
                    : 'border-[#1F2937] bg-[#0B0F1A] hover:border-[#374151]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{c.name}</span>
                  <span className={`text-xs font-semibold ${
                    c.approvalRate >= 75 ? 'text-emerald-400' :
                    c.approvalRate >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {c.approvalRate}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span>Avg: ${c.avgClaimValue?.toLocaleString()}</span>
                  <span>Supp: {c.supplementSuccessRate}%</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carrier Details */}
      <div className="lg:col-span-2 rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        {loadingDetails ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>
        ) : selectedCarrier ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">{selectedCarrier.name}</h3>
              <p className="text-sm text-slate-400">Response Time: {selectedCarrier.avgResponseTime}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className={`text-2xl font-bold ${selectedCarrier.approvalRate >= 75 ? 'text-emerald-400' : selectedCarrier.approvalRate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {selectedCarrier.approvalRate}%
                </p>
                <p className="text-xs text-slate-400">Approval Rate</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-white">${selectedCarrier.avgClaimValue?.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Avg Claim Value</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-[#A78BFA]">{selectedCarrier.supplementSuccessRate}%</p>
                <p className="text-xs text-slate-400">Supplement Success</p>
              </div>
            </div>

            {/* Common Denials */}
            {selectedCarrier.commonDenials?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" /> Common Denial Reasons
                </h4>
                <div className="space-y-1">
                  {selectedCarrier.commonDenials.map((denial, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-[#0B0F1A] border border-[#1F2937] px-3 py-2 text-sm text-slate-300">
                      <span className="text-red-400">•</span> {denial}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Negotiation Tips */}
            {selectedCarrier.negotiationTips?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-400" /> Negotiation Tips
                </h4>
                <div className="space-y-1">
                  {selectedCarrier.negotiationTips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg bg-[#0B0F1A] border border-[#1F2937] px-3 py-2 text-sm text-slate-300">
                      <span className="text-emerald-400 mt-0.5">✓</span> {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Documentation */}
            {selectedCarrier.preferredDocumentation?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#A78BFA]" /> Preferred Documentation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCarrier.preferredDocumentation.map((doc, idx) => (
                    <span key={idx} className="rounded-full bg-[#6D5CFF]/10 border border-[#6D5CFF]/20 px-3 py-1 text-xs text-[#A78BFA]">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Select a carrier to view intelligence</p>
            <p className="text-xs text-slate-500 mt-1">Approval rates, denial patterns, and negotiation strategies</p>
          </div>
        )}
      </div>
    </div>
  );
}
