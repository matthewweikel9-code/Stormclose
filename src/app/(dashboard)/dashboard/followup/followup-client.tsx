"use client";

import { FormEvent, useState } from "react";
import { 
	MESSAGE_SEQUENCES, 
	SEQUENCE_TYPES, 
	type SequenceType, 
	type MessageSequence,
	type SequenceMessage,
	personalizeMessage 
} from "@/lib/message-sequences";

type FollowupStatus = "waiting_on_insurance" | "undecided" | "ghosted";

type FormState = {
  homeownerName: string;
  inspectionDate: string;
  status: FollowupStatus;
};

type FollowupResponse = {
  followupId: string;
  content: string;
  status: FollowupStatus;
  createdAt: string;
  model: string;
};

const statusLabels: Record<FollowupStatus, string> = {
  waiting_on_insurance: "Waiting on insurance",
  undecided: "Undecided",
  ghosted: "Ghosted"
};

const CHANNEL_ICONS = {
	text: "💬",
	email: "📧",
	call: "📞"
};

export function FollowupClient() {
  const [form, setForm] = useState<FormState>({
    homeownerName: "",
    inspectionDate: "",
    status: "waiting_on_insurance"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FollowupResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "sequences">("sequences");
  const [selectedSequence, setSelectedSequence] = useState<MessageSequence | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<SequenceMessage | null>(null);
  const [filterType, setFilterType] = useState<SequenceType | "all">("all");
  const [personalizeVars, setPersonalizeVars] = useState({
    name: "",
    address: "",
    your_name: "",
    company: ""
  });
  const [messageCopied, setMessageCopied] = useState(false);

  const filteredSequences = filterType === "all" 
    ? MESSAGE_SEQUENCES 
    : MESSAGE_SEQUENCES.filter(s => s.type === filterType);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as FollowupResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate follow-up.");
      }

      setResult(data);
    } catch (submitError) {
      setResult(null);
      setError(submitError instanceof Error ? submitError.message : "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.content) {
      return;
    }

    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function handleCopyMessage(message: SequenceMessage) {
    const personalized = personalizeMessage(message.template, personalizeVars);
    await navigator.clipboard.writeText(personalized);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 1500);
  }

  function useMessageForGeneration(message: SequenceMessage) {
    setForm(prev => ({
      ...prev,
      homeownerName: personalizeVars.name || prev.homeownerName
    }));
    setActiveTab("generate");
  }

  return (
    <section className="saas-shell">
      <header className="saas-page-header">
        <p className="saas-kicker">Customer Success</p>
        <h1 className="saas-title">Follow-Up Center</h1>
        <p className="saas-subtitle">
          Use proven message sequences or generate custom AI follow-ups for any situation.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("sequences")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === "sequences"
              ? "bg-brand-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          📋 Message Sequences
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === "generate"
              ? "bg-brand-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          ✨ AI Generator
        </button>
      </div>

      {activeTab === "sequences" ? (
        <div className="space-y-6">
          {/* Quick Personalization */}
          <div className="saas-card">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Personalization (optional)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Customer name"
                value={personalizeVars.name}
                onChange={(e) => setPersonalizeVars(prev => ({ ...prev, name: e.target.value }))}
                className="input text-sm"
              />
              <input
                type="text"
                placeholder="Property address"
                value={personalizeVars.address}
                onChange={(e) => setPersonalizeVars(prev => ({ ...prev, address: e.target.value }))}
                className="input text-sm"
              />
              <input
                type="text"
                placeholder="Your name"
                value={personalizeVars.your_name}
                onChange={(e) => setPersonalizeVars(prev => ({ ...prev, your_name: e.target.value }))}
                className="input text-sm"
              />
              <input
                type="text"
                placeholder="Company name"
                value={personalizeVars.company}
                onChange={(e) => setPersonalizeVars(prev => ({ ...prev, company: e.target.value }))}
                className="input text-sm"
              />
            </div>
          </div>

          {/* Filter by Type */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filterType === "all"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              All Sequences
            </button>
            {(Object.entries(SEQUENCE_TYPES) as [SequenceType, typeof SEQUENCE_TYPES[SequenceType]][]).map(([key, type]) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filterType === key
                    ? type.color
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>

          {/* Sequences Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSequences.map((seq) => (
              <div
                key={seq.id}
                onClick={() => setSelectedSequence(selectedSequence?.id === seq.id ? null : seq)}
                className={`saas-card cursor-pointer transition-all hover:border-brand-500/50 ${
                  selectedSequence?.id === seq.id ? "ring-2 ring-brand-500" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEQUENCE_TYPES[seq.type].color}`}>
                    {SEQUENCE_TYPES[seq.type].icon} {SEQUENCE_TYPES[seq.type].label}
                  </span>
                  <span className="text-xs text-slate-500">{seq.totalDays} days</span>
                </div>
                
                <h3 className="text-white font-semibold mb-1">{seq.name}</h3>
                <p className="text-sm text-slate-400 mb-3">{seq.description}</p>
                
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{seq.messages.length} messages</span>
                  <span>•</span>
                  <span>{seq.messages.filter(m => m.channel === "text").length} texts</span>
                  <span>•</span>
                  <span>{seq.messages.filter(m => m.channel === "email").length} emails</span>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Sequence Detail */}
          {selectedSequence && (
            <div className="saas-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedSequence.name}</h3>
                  <p className="text-sm text-slate-400">{selectedSequence.description}</p>
                </div>
                <button
                  onClick={() => setSelectedSequence(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Best For Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedSequence.bestFor.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Message Timeline */}
              <div className="space-y-4">
                {selectedSequence.messages.map((message, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedMessage(selectedMessage === message ? null : message)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedMessage === message 
                        ? "border-brand-500 bg-brand-500/10" 
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{CHANNEL_ICONS[message.channel]}</span>
                        <div>
                          <p className="font-medium text-white">
                            Day {message.day} - {message.channel.charAt(0).toUpperCase() + message.channel.slice(1)}
                          </p>
                          <p className="text-xs text-slate-400">{message.purpose}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        message.tone === "friendly" ? "bg-green-100 text-green-800" :
                        message.tone === "professional" ? "bg-blue-100 text-blue-800" :
                        "bg-orange-100 text-orange-800"
                      }`}>
                        {message.tone}
                      </span>
                    </div>

                    {message.subject && (
                      <p className="text-sm text-slate-300 mb-2">
                        <span className="text-slate-500">Subject:</span> {message.subject}
                      </p>
                    )}

                    {selectedMessage === message && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <pre className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed font-sans mb-4">
                          {personalizeMessage(message.template, personalizeVars)}
                        </pre>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyMessage(message); }}
                            className="button-secondary text-sm flex-1"
                          >
                            {messageCopied ? "Copied!" : "Copy Message"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); useMessageForGeneration(message); }}
                            className="button-primary text-sm flex-1"
                          >
                            Customize with AI
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="saas-grid">
          <form onSubmit={handleSubmit} className="saas-card space-y-4">
            <label className="saas-label">
              Homeowner name
              <input
                className="input"
                value={form.homeownerName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, homeownerName: event.target.value }))
                }
                placeholder="Jane Smith"
                required
              />
            </label>

            <label className="saas-label">
              Inspection date
              <input
                type="date"
                className="input"
                value={form.inspectionDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, inspectionDate: event.target.value }))
                }
                required
              />
            </label>

            <label className="saas-label">
              Status
              <select
                className="select"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as FollowupStatus }))
                }
              >
                <option value="waiting_on_insurance">Waiting on insurance</option>
                <option value="undecided">Undecided</option>
                <option value="ghosted">Ghosted</option>
              </select>
            </label>

            {error ? <div className="saas-error">{error}</div> : null}

            <button
              type="submit"
              disabled={loading || !form.homeownerName || !form.inspectionDate}
              className="button-primary w-full"
            >
              {loading ? "Generating follow-up..." : "Generate follow-up"}
            </button>
          </form>

          <aside className="saas-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Generated message</h2>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!result?.content}
                className="button-secondary disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-4/5 animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-700" />
              </div>
            ) : result ? (
              <>
                <p className="mb-3 text-xs text-slate-400">
                  {statusLabels[result.status]} • #{result.followupId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
                </p>
                <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#1F2937] bg-[#0B0F1A] p-4 text-sm leading-6 text-slate-200">
                  {result.content}
                </article>
              </>
            ) : (
              <div className="saas-empty">Generated follow-up appears here after submission.</div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
