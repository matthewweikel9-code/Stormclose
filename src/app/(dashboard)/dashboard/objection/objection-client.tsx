"use client";

import { FormEvent, useMemo, useState } from "react";
import { 
	OBJECTION_LIBRARY, 
	OBJECTION_CATEGORIES, 
	type ObjectionCategory, 
	type ObjectionTemplate,
	searchObjections 
} from "@/lib/objection-library";

type ObjectionFormState = {
  homeownerName: string;
  objection: string;
  projectType: string;
  keyBenefits: string;
  evidencePoints: string;
  tone: "consultative" | "confident" | "empathetic";
};

type ObjectionResponse = {
  objectionId: string;
  content: string;
  createdAt: string;
  model: string;
};

const initialForm: ObjectionFormState = {
  homeownerName: "",
  objection: "",
  projectType: "Roof replacement and insurance claim support",
  keyBenefits: "Licensed crew, insurance documentation support, clean timeline communication",
  evidencePoints: "Recent local installs, carrier-approved supplement success",
  tone: "consultative"
};

export function ObjectionClient() {
  const [form, setForm] = useState<ObjectionFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ObjectionResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "library">("library");
  const [selectedCategory, setSelectedCategory] = useState<ObjectionCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ObjectionTemplate | null>(null);
  const [templateCopied, setTemplateCopied] = useState(false);

  const filteredObjections = useMemo(() => {
    let results = OBJECTION_LIBRARY;
    
    if (searchQuery) {
      results = searchObjections(searchQuery);
    } else if (selectedCategory !== "all") {
      results = results.filter(obj => obj.category === selectedCategory);
    }
    
    return results;
  }, [selectedCategory, searchQuery]);

  const canSubmit = useMemo(() => {
    return form.objection.trim() && form.projectType.trim() && form.keyBenefits.trim();
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate-objection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeownerName: form.homeownerName,
          objection: form.objection,
          projectType: form.projectType,
          keyBenefits: form.keyBenefits
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          evidencePoints: form.evidencePoints
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          tone: form.tone
        })
      });

      const data = (await response.json()) as ObjectionResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate objection response.");
      }

      setResult({
        objectionId: data.objectionId,
        content: data.content,
        createdAt: data.createdAt,
        model: data.model
      });
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
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleCopyTemplate(text: string) {
    await navigator.clipboard.writeText(text);
    setTemplateCopied(true);
    setTimeout(() => setTemplateCopied(false), 1500);
  }

  function useTemplateForGeneration(template: ObjectionTemplate) {
    setForm(prev => ({
      ...prev,
      objection: template.objection,
      tone: template.suggestedTone
    }));
    setActiveTab("generate");
  }

  return (
    <section className="saas-shell">
      <header className="saas-page-header">
        <p className="saas-kicker">Sales Enablement</p>
        <h1 className="saas-title">Objection Handler</h1>
        <p className="saas-subtitle">
          Browse 30+ proven responses or generate custom AI-powered responses for any objection.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === "library"
              ? "bg-brand-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          📚 Objection Library
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

      {activeTab === "library" ? (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search objections..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedCategory("all"); }}
                className="input w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === "all" && !searchQuery
                    ? "bg-brand-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                All ({OBJECTION_LIBRARY.length})
              </button>
              {(Object.entries(OBJECTION_CATEGORIES) as [ObjectionCategory, typeof OBJECTION_CATEGORIES[ObjectionCategory]][]).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => { setSelectedCategory(key); setSearchQuery(""); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === key
                      ? cat.color
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Objection Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredObjections.map((obj) => (
              <div
                key={obj.id}
                onClick={() => setSelectedTemplate(selectedTemplate?.id === obj.id ? null : obj)}
                className={`saas-card cursor-pointer transition-all hover:border-brand-500/50 ${
                  selectedTemplate?.id === obj.id ? "ring-2 ring-brand-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OBJECTION_CATEGORIES[obj.category].color}`}>
                    {OBJECTION_CATEGORIES[obj.category].icon} {OBJECTION_CATEGORIES[obj.category].label}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{obj.suggestedTone}</span>
                </div>
                
                <h3 className="text-white font-medium mb-2">&ldquo;{obj.objection}&rdquo;</h3>
                
                {selectedTemplate?.id === obj.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Key Insights</p>
                      <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                        {obj.keyInsights.map((insight, i) => (
                          <li key={i}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Suggested Response</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{obj.suggestedResponse}</p>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyTemplate(obj.suggestedResponse); }}
                        className="button-secondary text-sm flex-1"
                      >
                        {templateCopied ? "Copied!" : "Copy Response"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); useTemplateForGeneration(obj); }}
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

          {filteredObjections.length === 0 && (
            <div className="saas-empty text-center py-12">
              No objections found. Try a different search or category.
            </div>
          )}
        </div>
      ) : (
        <div className="saas-grid">
          <form onSubmit={handleSubmit} className="saas-card space-y-4">
            <label className="saas-label">
              Homeowner name (optional)
              <input
                className="input"
                value={form.homeownerName}
                onChange={(event) => setForm((prev) => ({ ...prev, homeownerName: event.target.value }))}
                placeholder="Jane Smith"
              />
            </label>

            <label className="saas-label">
              Main objection
              <textarea
                className="textarea"
                value={form.objection}
                onChange={(event) => setForm((prev) => ({ ...prev, objection: event.target.value }))}
                placeholder="The quote is higher than another contractor and I want to wait."
                required
              />
            </label>

            <label className="saas-label">
              Project type
              <input
                className="input"
                value={form.projectType}
                onChange={(event) => setForm((prev) => ({ ...prev, projectType: event.target.value }))}
                required
              />
            </label>

            <label className="saas-label">
              Key benefits (comma-separated)
              <input
                className="input"
                value={form.keyBenefits}
                onChange={(event) => setForm((prev) => ({ ...prev, keyBenefits: event.target.value }))}
                required
              />
            </label>

            <label className="saas-label">
              Evidence points (comma-separated)
              <input
                className="input"
                value={form.evidencePoints}
                onChange={(event) => setForm((prev) => ({ ...prev, evidencePoints: event.target.value }))}
              />
            </label>

            <label className="saas-label">
              Response tone
              <select
                className="select"
                value={form.tone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    tone: event.target.value as "consultative" | "confident" | "empathetic"
                  }))
                }
              >
                <option value="consultative">Consultative</option>
                <option value="confident">Confident</option>
                <option value="empathetic">Empathetic</option>
              </select>
            </label>

            {error ? <div className="saas-error">{error}</div> : null}

            <button type="submit" disabled={!canSubmit || loading} className="button-primary w-full">
              {loading ? "Generating response..." : "Generate objection response"}
            </button>
          </form>

          <aside className="saas-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Generated response</h2>
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
                  Response #{result.objectionId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
                </p>
                <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-storm-border bg-storm-z0 p-4 text-sm leading-6 text-slate-200">
                  {result.content}
                </article>
              </>
            ) : (
              <div className="saas-empty">Generated objection response appears here after submission.</div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
