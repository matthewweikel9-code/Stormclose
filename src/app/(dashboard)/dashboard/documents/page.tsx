'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Ruler,
  Calculator,
  Upload,
  Download,
  Eye,
  Loader2,
  Search,
  ChevronRight,
  Check,
  AlertTriangle,
  Sparkles,
  DollarSign,
  Home,
  Printer,
  MapPin,
  Zap,
  FileSpreadsheet,
  BarChart3,
  ClipboardList,
} from 'lucide-react';

type ActiveTab = 'estimates' | 'roof-measure' | 'reports' | 'xactimate' | 'supplements';

const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'estimates', label: 'Estimate Generator', icon: Calculator },
  { id: 'roof-measure', label: 'Roof Measurement', icon: Ruler },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'xactimate', label: 'Xactimate', icon: FileSpreadsheet },
  { id: 'supplements', label: 'Supplements', icon: ClipboardList },
];

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('estimates');

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D5CFF] to-[#A78BFA] shadow-lg shadow-[#6D5CFF]/20">
            <FileText className="h-5 w-5 text-white" />
          </span>
          Documents
        </h1>
        <p className="mt-1 text-sm text-slate-400">Estimates, roof measurements, reports, and insurance documentation</p>
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
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[calc(100vh-14rem)]">
        {activeTab === 'estimates' && <EstimateGeneratorPanel />}
        {activeTab === 'roof-measure' && <RoofMeasurePanel />}
        {activeTab === 'reports' && <ReportsPanel />}
        {activeTab === 'xactimate' && <XactimatePanel />}
        {activeTab === 'supplements' && <SupplementsPanel />}
      </div>
    </div>
  );
}

// ============================================================================
// ESTIMATE GENERATOR PANEL
// ============================================================================

interface PricingSettings {
  costPerSquare: number;
  tearOffCostPerSquare: number;
  disposalCostPerSquare: number;
  overheadPercent: number;
  profitPercent: number;
}

function EstimateGeneratorPanel() {
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [roofSquares, setRoofSquares] = useState(25);
  const [pitch, setPitch] = useState(6);
  const [complexity, setComplexity] = useState<'simple' | 'moderate' | 'complex'>('moderate');
  const [includeTearOff, setIncludeTearOff] = useState(true);
  const [shingleType, setShingleType] = useState('architectural');
  const [pricing, setPricing] = useState<PricingSettings>({
    costPerSquare: 450,
    tearOffCostPerSquare: 75,
    disposalCostPerSquare: 50,
    overheadPercent: 10,
    profitPercent: 20,
  });
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const materialCosts: Record<string, { name: string; cost: number }> = {
    '3tab': { name: '3-Tab Shingles', cost: 80 },
    architectural: { name: 'Architectural Shingles', cost: 120 },
    premium: { name: 'Premium Designer Shingles', cost: 200 },
    metal: { name: 'Metal Roofing', cost: 350 },
  };

  const generateEstimate = useCallback(() => {
    setLoading(true);
    const wasteFactors = { simple: 0.10, moderate: 0.15, complex: 0.20 };
    const wasteFactor = wasteFactors[complexity];
    const shingleCost = materialCosts[shingleType]?.cost || 120;
    const squaresWithWaste = Math.ceil(roofSquares * (1 + wasteFactor));

    const materialTotal = squaresWithWaste * shingleCost;
    const tearOffTotal = includeTearOff ? roofSquares * pricing.tearOffCostPerSquare : 0;
    const disposalTotal = includeTearOff ? roofSquares * pricing.disposalCostPerSquare : 0;
    const laborTotal = roofSquares * pricing.costPerSquare;
    const subtotal = materialTotal + tearOffTotal + disposalTotal + laborTotal;
    const overhead = subtotal * (pricing.overheadPercent / 100);
    const profit = subtotal * (pricing.profitPercent / 100);
    const totalCost = subtotal + overhead + profit;

    setTimeout(() => {
      setEstimate({
        customerName,
        address,
        roofSquares,
        squaresWithWaste,
        pitch,
        complexity,
        shingleType: materialCosts[shingleType]?.name,
        materialTotal,
        tearOffTotal,
        disposalTotal,
        laborTotal,
        subtotal,
        overhead,
        profit,
        totalCost,
        wasteFactor,
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
    }, 500);
  }, [customerName, address, roofSquares, pitch, complexity, shingleType, includeTearOff, pricing]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Home className="h-5 w-5 text-[#A78BFA]" />
            Customer Info
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Dallas, TX" className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]" />
            </div>
          </div>
        </div>

        {/* Roof Details */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Ruler className="h-5 w-5 text-[#A78BFA]" />
            Roof Details
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Roof Squares</label>
                <input type="number" value={roofSquares} onChange={(e) => setRoofSquares(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#6D5CFF]" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Pitch</label>
                <input type="number" value={pitch} onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#6D5CFF]" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Complexity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['simple', 'moderate', 'complex'] as const).map((c) => (
                  <button key={c} onClick={() => setComplexity(c)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                      complexity === c ? 'border-[#6D5CFF] bg-[#6D5CFF]/10 text-white' : 'border-[#1F2937] bg-[#0B0F1A] text-slate-400 hover:border-[#374151]'
                    }`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Shingle Type</label>
              <select value={shingleType} onChange={(e) => setShingleType(e.target.value)}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#6D5CFF]">
                {Object.entries(materialCosts).map(([key, { name }]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeTearOff} onChange={(e) => setIncludeTearOff(e.target.checked)}
                className="rounded border-[#1F2937] bg-[#0B0F1A] text-[#6D5CFF] focus:ring-[#6D5CFF]" />
              <span className="text-sm text-slate-400">Include tear-off & disposal</span>
            </label>
          </div>
          <button onClick={generateEstimate} disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Generate Estimate
          </button>
        </div>
      </div>

      {/* Estimate Preview */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Estimate Preview</h3>
        {estimate ? (
          <div className="space-y-4">
            {/* Total */}
            <div className="rounded-xl bg-gradient-to-r from-[#6D5CFF]/10 to-[#A78BFA]/10 border border-[#6D5CFF]/20 p-6 text-center">
              <p className="text-3xl font-bold text-white">${estimate.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-slate-400 mt-1">Total Estimate</p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {[
                { label: `Materials (${estimate.shingleType})`, value: estimate.materialTotal },
                { label: 'Labor', value: estimate.laborTotal },
                ...(estimate.tearOffTotal > 0 ? [{ label: 'Tear-Off', value: estimate.tearOffTotal }] : []),
                ...(estimate.disposalTotal > 0 ? [{ label: 'Disposal', value: estimate.disposalTotal }] : []),
                { label: `Overhead (${pricing.overheadPercent}%)`, value: estimate.overhead },
                { label: `Profit (${pricing.profitPercent}%)`, value: estimate.profit },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#1F2937]/50 last:border-0">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="text-sm text-white font-medium">${item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Squares (with waste)</span><span className="text-white">{estimate.squaresWithWaste}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Waste Factor</span><span className="text-white">{(estimate.wasteFactor * 100).toFixed(0)}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Pitch</span><span className="text-white">{estimate.pitch}/12</span></div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#1F2937] px-4 py-2.5 text-sm text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#1F2937] px-4 py-2.5 text-sm text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calculator className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Configure details and generate an estimate</p>
            <p className="text-xs text-slate-500 mt-1">Includes materials, labor, overhead & profit</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ROOF MEASURE PANEL (Google Solar API)
// ============================================================================

interface AddressPrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface RoofSegment {
  id: number;
  areaSqFt: number;
  pitchDegrees: number;
  pitchRatio: string;
  azimuthDegrees: number;
  direction: string;
  pitchMultiplier: number;
}

interface MeasurementResult {
  success: boolean;
  address: string;
  coordinates: { lat: number; lng: number };
  measurements: {
    totalAreaSqFt: number;
    totalSquares: number;
    groundAreaSqFt: number;
    facetCount: number;
    avgPitchDegrees: number;
    avgPitchRatio: string;
  };
  segments: RoofSegment[];
  estimates: {
    shingleBundles: number;
    underlaymentRolls: number;
    ridgeCapBundles: number;
    dripEdgeFeet: number;
    costRange: { low: number; high: number };
  };
  imageryDate: string;
  dataQuality: string;
}

function RoofMeasurePanel() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const addressParam = searchParams.get('address');
    if (addressParam && !address) setAddress(addressParam);
  }, [searchParams, address]);

  // Address autocomplete
  const handleAddressChange = (value: string) => {
    setAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) { setPredictions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          setShowPredictions(true);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const selectPrediction = (prediction: AddressPrediction) => {
    setAddress(prediction.description);
    setPredictions([]);
    setShowPredictions(false);
  };

  const measureRoof = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/roof-measurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Measurement failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Ruler className="h-5 w-5 text-[#A78BFA]" />
          Instant Roof Measurement
        </h3>
        <p className="text-sm text-slate-400 mb-4">Powered by Google Solar API — get accurate roof dimensions from satellite imagery</p>
        <div className="relative flex gap-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && measureRoof()}
              placeholder="Enter property address..."
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
            />
            {showPredictions && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[#1F2937] bg-[#111827] shadow-xl overflow-hidden">
                {predictions.map((p) => (
                  <button
                    key={p.placeId}
                    onClick={() => selectPrediction(p)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-[#1E293B] transition-colors border-b border-[#1F2937]/50 last:border-0"
                  >
                    <MapPin className="inline h-3 w-3 mr-2 text-slate-500" />
                    <span className="text-white">{p.mainText}</span>
                    <span className="text-slate-500 ml-1">{p.secondaryText}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={measureRoof} disabled={loading || !address.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ruler className="h-4 w-4" />}
            Measure
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Measurements */}
          <div className="lg:col-span-2 rounded-xl border border-[#1F2937] bg-[#111827] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Measurement Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-white">{result.measurements.totalSquares}</p>
                <p className="text-xs text-slate-400">Squares</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-white">{result.measurements.totalAreaSqFt.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Total Sq Ft</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-white">{result.measurements.facetCount}</p>
                <p className="text-xs text-slate-400">Facets</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-2xl font-bold text-white">{result.measurements.avgPitchRatio}</p>
                <p className="text-xs text-slate-400">Avg Pitch</p>
              </div>
            </div>

            {/* Segments */}
            {result.segments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Roof Segments</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1F2937] text-left text-xs text-slate-500 uppercase">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Area</th>
                        <th className="px-3 py-2">Pitch</th>
                        <th className="px-3 py-2">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.segments.map((seg) => (
                        <tr key={seg.id} className="border-b border-[#1F2937]/50">
                          <td className="px-3 py-2 text-sm text-slate-500">{seg.id}</td>
                          <td className="px-3 py-2 text-sm text-white">{seg.areaSqFt.toLocaleString()} sqft</td>
                          <td className="px-3 py-2 text-sm text-white">{seg.pitchRatio}</td>
                          <td className="px-3 py-2 text-sm text-slate-400">{seg.direction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Materials & Cost */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Material Estimates</h3>
              <div className="space-y-3">
                {[
                  { label: 'Shingle Bundles', value: result.estimates.shingleBundles },
                  { label: 'Underlayment Rolls', value: result.estimates.underlaymentRolls },
                  { label: 'Ridge Cap Bundles', value: result.estimates.ridgeCapBundles },
                  { label: 'Drip Edge (ft)', value: result.estimates.dripEdgeFeet },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-[#1F2937]/50 last:border-0">
                    <span className="text-sm text-slate-400">{item.label}</span>
                    <span className="text-sm text-white font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h3 className="text-lg font-semibold text-emerald-400 mb-2">Cost Estimate</h3>
              <p className="text-2xl font-bold text-white">
                ${result.estimates.costRange.low.toLocaleString()} - ${result.estimates.costRange.high.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">Based on market rates for your area</p>
            </div>

            <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Imagery Date</span><span className="text-white">{result.imageryDate}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Data Quality</span><span className="text-white">{result.dataQuality}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REPORTS PANEL
// ============================================================================

function ReportsPanel() {
  const [reportType, setReportType] = useState<string>('property');
  const [reportAddress, setReportAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const reportTypes = [
    { id: 'property', name: 'Property Report', icon: Home, description: 'Full property analysis with storm history' },
    { id: 'storm', name: 'Storm Report', icon: AlertTriangle, description: 'Detailed storm impact assessment' },
    { id: 'measurement', name: 'Measurement Report', icon: Ruler, description: 'Roof measurements and material list' },
    { id: 'route', name: 'Route Report', icon: MapPin, description: 'Optimized route with stop details' },
  ];

  const generateReport = async () => {
    if (!reportAddress.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType, address: reportAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Report generation failed');
      setGeneratedReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#A78BFA]" />
          Generate Report
        </h3>

        {/* Report Type Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {reportTypes.map((rt) => {
            const Icon = rt.icon;
            return (
              <button
                key={rt.id}
                onClick={() => setReportType(rt.id)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  reportType === rt.id
                    ? 'border-[#6D5CFF] bg-[#6D5CFF]/10'
                    : 'border-[#1F2937] bg-[#0B0F1A] hover:border-[#374151]'
                }`}
              >
                <Icon className={`h-5 w-5 mb-2 ${reportType === rt.id ? 'text-[#A78BFA]' : 'text-slate-500'}`} />
                <p className="text-sm font-medium text-white">{rt.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{rt.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={reportAddress}
            onChange={(e) => setReportAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateReport()}
            placeholder="Enter address or storm details..."
            className="flex-1 rounded-lg border border-[#1F2937] bg-[#0B0F1A] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#6D5CFF]"
          />
          <button onClick={generateReport} disabled={loading || !reportAddress.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5B4AE8] disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      {/* Generated Report */}
      {generatedReport && (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Generated Report</h3>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] px-3 py-1.5 text-xs text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
                <Download className="h-3 w-3" /> PDF
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] px-3 py-1.5 text-xs text-slate-400 hover:bg-[#1E293B] hover:text-white transition-colors">
                <Printer className="h-3 w-3" /> Print
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
            {typeof generatedReport.report === 'string' ? generatedReport.report : JSON.stringify(generatedReport, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// XACTIMATE PANEL
// ============================================================================

interface XactimateEstimate {
  id: string;
  claim_number: string;
  property_address: string;
  insurance_carrier: string;
  original_rcv: number;
  original_acv: number;
  status: string;
  ai_analysis?: {
    missing_items: { category: string; item: string; xactimate_code: string; estimated_value: number; confidence: number }[];
    suggested_supplement: number;
    confidence: number;
    summary: string;
  };
  created_at: string;
}

function XactimatePanel() {
  const [estimates, setEstimates] = useState<XactimateEstimate[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<XactimateEstimate | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEstimates = async () => {
      try {
        const res = await fetch('/api/xactimate');
        if (res.ok) {
          const data = await res.json();
          setEstimates(data.estimates || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimates();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/xactimate/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setEstimates((prev) => [data.estimate || data, ...prev]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeEstimate = async (id: string) => {
    try {
      const res = await fetch('/api/xactimate/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEstimates((prev) => prev.map((e) => (e.id === id ? { ...e, ...data.estimate, status: 'analyzed' } : e)));
        setSelectedEstimate((prev) => (prev?.id === id ? { ...prev, ...data.estimate, status: 'analyzed' } : prev));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload + List */}
      <div className="space-y-4">
        {/* Upload */}
        <div className="rounded-xl border-2 border-dashed border-[#1F2937] bg-[#111827] p-6 text-center hover:border-[#6D5CFF]/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept=".esx,.pdf,.xml" onChange={handleUpload} className="hidden" />
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#A78BFA] mx-auto" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Upload Xactimate File</p>
              <p className="text-xs text-slate-500">.esx, .pdf, or .xml</p>
            </>
          )}
        </div>

        {/* Estimate List */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Uploaded Estimates</h3>
          {estimates.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No estimates uploaded yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {estimates.map((est) => (
                <button
                  key={est.id}
                  onClick={() => setSelectedEstimate(est)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    selectedEstimate?.id === est.id
                      ? 'border-[#6D5CFF] bg-[#6D5CFF]/10'
                      : 'border-[#1F2937] bg-[#0B0F1A] hover:border-[#374151]'
                  }`}
                >
                  <p className="text-sm text-white truncate">{est.property_address || est.claim_number}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">{est.insurance_carrier}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      est.status === 'analyzed' ? 'bg-emerald-500/10 text-emerald-400' :
                      est.status === 'analyzing' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-700/50 text-slate-400'
                    }`}>{est.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="lg:col-span-2 rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        {selectedEstimate ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{selectedEstimate.property_address}</h3>
              {selectedEstimate.status !== 'analyzed' && (
                <button onClick={() => analyzeEstimate(selectedEstimate.id)}
                  className="flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B4AE8] transition-all">
                  <Sparkles className="h-4 w-4" /> AI Analyze
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">${selectedEstimate.original_rcv?.toLocaleString()}</p>
                <p className="text-xs text-slate-400">RCV</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">${selectedEstimate.original_acv?.toLocaleString()}</p>
                <p className="text-xs text-slate-400">ACV</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">{selectedEstimate.insurance_carrier || '-'}</p>
                <p className="text-xs text-slate-400">Carrier</p>
              </div>
              <div className="rounded-lg bg-[#0B0F1A] border border-[#1F2937] p-3 text-center">
                <p className="text-lg font-bold text-white">{selectedEstimate.claim_number || '-'}</p>
                <p className="text-xs text-slate-400">Claim #</p>
              </div>
            </div>

            {/* AI Analysis */}
            {selectedEstimate.ai_analysis && (
              <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> AI Supplement Recommendation
                    </h4>
                    <span className="text-xs text-emerald-400">{selectedEstimate.ai_analysis.confidence}% confident</span>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    +${selectedEstimate.ai_analysis.suggested_supplement.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{selectedEstimate.ai_analysis.summary}</p>
                </div>

                {selectedEstimate.ai_analysis.missing_items?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Missing Line Items</h4>
                    <div className="space-y-2">
                      {selectedEstimate.ai_analysis.missing_items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-[#0B0F1A] border border-[#1F2937] px-3 py-2">
                          <div>
                            <p className="text-sm text-white">{item.item}</p>
                            <p className="text-xs text-slate-500">{item.xactimate_code} · {item.category}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-400">+${item.estimated_value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileSpreadsheet className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Upload and select an estimate to analyze</p>
            <p className="text-xs text-slate-500 mt-1">AI will identify missing line items and supplement opportunities</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUPPLEMENTS PANEL (links to AI Tools supplement, for document viewing)
// ============================================================================

function SupplementsPanel() {
  const [supplements, setSupplements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupplements = async () => {
      try {
        const res = await fetch('/api/supplements');
        if (res.ok) {
          const data = await res.json();
          setSupplements(data.supplements || data.data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSupplements();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#6D5CFF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#A78BFA]" />
            Generated Supplements
          </h3>
          <a href="/dashboard/ai-tools" className="flex items-center gap-1 text-sm text-[#A78BFA] hover:text-[#6D5CFF] transition-colors">
            <Sparkles className="h-3 w-3" /> Generate New
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
        
        {supplements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No supplements generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Go to AI Tools → Supplement Generator to create one</p>
            <a href="/dashboard/ai-tools" className="mt-4 flex items-center gap-2 rounded-lg bg-[#6D5CFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B4AE8] transition-all">
              <Sparkles className="h-4 w-4" /> Go to Supplement Generator
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {supplements.map((supp: any, idx: number) => (
              <div key={supp.id || idx} className="rounded-lg border border-[#1F2937] bg-[#0B0F1A] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{supp.title || supp.address || `Supplement #${idx + 1}`}</p>
                  <span className="text-xs text-slate-500">{supp.created_at ? new Date(supp.created_at).toLocaleDateString() : ''}</span>
                </div>
                {supp.content && (
                  <p className="mt-2 text-xs text-slate-400 line-clamp-2">{supp.content.substring(0, 150)}...</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
