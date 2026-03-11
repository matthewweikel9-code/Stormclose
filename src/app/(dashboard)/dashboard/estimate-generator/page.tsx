"use client";

import { useState, useCallback, useRef } from "react";

interface MaterialItem {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

interface LaborItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  totalCost: number;
}

interface Estimate {
  id: string;
  customerName: string;
  address: string;
  phone?: string;
  email?: string;
  roofSquares: number;
  pitch: number;
  complexity: "simple" | "moderate" | "complex";
  materials: MaterialItem[];
  labor: LaborItem[];
  subtotal: number;
  wasteFactor: number;
  overhead: number;
  profit: number;
  totalCost: number;
  createdAt: string;
}

interface PricingSettings {
  costPerSquare: number;
  tearOffCostPerSquare: number;
  disposalCostPerSquare: number;
  overheadPercent: number;
  profitPercent: number;
}

export default function EstimateGeneratorPage() {
  const [activeTab, setActiveTab] = useState<"create" | "preview" | "proposal">("create");
  
  // Customer Info
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Roof Info
  const [roofSquares, setRoofSquares] = useState(25);
  const [pitch, setPitch] = useState(6);
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex">("moderate");
  const [includeTearOff, setIncludeTearOff] = useState(true);
  const [layers, setLayers] = useState(1);

  // Pricing
  const [pricing, setPricing] = useState<PricingSettings>({
    costPerSquare: 450,
    tearOffCostPerSquare: 75,
    disposalCostPerSquare: 50,
    overheadPercent: 10,
    profitPercent: 20,
  });

  // Material customization
  const [shingleType, setShingleType] = useState("architectural");
  const [shingleBrand, setShingleBrand] = useState("GAF Timberline HDZ");

  // Estimate
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Material costs per square
  const materialCosts: Record<string, { name: string; cost: number }> = {
    "3tab": { name: "3-Tab Shingles", cost: 80 },
    "architectural": { name: "Architectural Shingles", cost: 120 },
    "premium": { name: "Premium Designer Shingles", cost: 200 },
    "metal": { name: "Metal Roofing", cost: 350 },
  };

  const generateEstimate = useCallback(() => {
    setLoading(true);

    // Calculate waste factor
    const wasteFactors = { simple: 0.10, moderate: 0.15, complex: 0.20 };
    const wasteFactor = wasteFactors[complexity];

    // Calculate materials
    const shingleCost = materialCosts[shingleType]?.cost || 120;
    const squaresWithWaste = Math.ceil(roofSquares * (1 + wasteFactor));

    const materials: MaterialItem[] = [
      {
        name: materialCosts[shingleType]?.name || "Architectural Shingles",
        quantity: squaresWithWaste * 3,
        unit: "bundles",
        unitCost: Math.round(shingleCost / 3),
        totalCost: squaresWithWaste * shingleCost,
      },
      {
        name: "Synthetic Underlayment",
        quantity: squaresWithWaste,
        unit: "rolls",
        unitCost: 45,
        totalCost: squaresWithWaste * 45,
      },
      {
        name: "Ice & Water Shield",
        quantity: Math.ceil(roofSquares * 0.3),
        unit: "rolls",
        unitCost: 85,
        totalCost: Math.ceil(roofSquares * 0.3) * 85,
      },
      {
        name: "Ridge Cap Shingles",
        quantity: Math.ceil(roofSquares * 0.2),
        unit: "bundles",
        unitCost: 55,
        totalCost: Math.ceil(roofSquares * 0.2) * 55,
      },
      {
        name: "Drip Edge",
        quantity: Math.ceil(roofSquares * 4),
        unit: "pieces",
        unitCost: 8,
        totalCost: Math.ceil(roofSquares * 4) * 8,
      },
      {
        name: "Starter Strip",
        quantity: Math.ceil(roofSquares * 0.5),
        unit: "bundles",
        unitCost: 35,
        totalCost: Math.ceil(roofSquares * 0.5) * 35,
      },
      {
        name: "Roofing Nails",
        quantity: Math.ceil(roofSquares / 5),
        unit: "boxes",
        unitCost: 45,
        totalCost: Math.ceil(roofSquares / 5) * 45,
      },
      {
        name: "Pipe Boots & Flashing",
        quantity: 4,
        unit: "pieces",
        unitCost: 25,
        totalCost: 100,
      },
    ];

    const materialTotal = materials.reduce((sum, m) => sum + m.totalCost, 0);

    // Calculate labor
    const labor: LaborItem[] = [
      {
        description: "Shingle Installation",
        quantity: roofSquares,
        unit: "squares",
        rate: pricing.costPerSquare,
        totalCost: roofSquares * pricing.costPerSquare,
      },
    ];

    if (includeTearOff) {
      labor.push({
        description: `Tear-Off (${layers} layer${layers > 1 ? "s" : ""})`,
        quantity: roofSquares,
        unit: "squares",
        rate: pricing.tearOffCostPerSquare * layers,
        totalCost: roofSquares * pricing.tearOffCostPerSquare * layers,
      });
      labor.push({
        description: "Debris Disposal",
        quantity: roofSquares,
        unit: "squares",
        rate: pricing.disposalCostPerSquare,
        totalCost: roofSquares * pricing.disposalCostPerSquare,
      });
    }

    // Add complexity surcharge
    if (complexity === "moderate") {
      labor.push({
        description: "Moderate Complexity Adjustment",
        quantity: 1,
        unit: "job",
        rate: roofSquares * 25,
        totalCost: roofSquares * 25,
      });
    } else if (complexity === "complex") {
      labor.push({
        description: "Complex Roof Adjustment",
        quantity: 1,
        unit: "job",
        rate: roofSquares * 50,
        totalCost: roofSquares * 50,
      });
    }

    // Steep pitch adjustment
    if (pitch > 8) {
      labor.push({
        description: "Steep Pitch Surcharge",
        quantity: 1,
        unit: "job",
        rate: roofSquares * 30,
        totalCost: roofSquares * 30,
      });
    }

    const laborTotal = labor.reduce((sum, l) => sum + l.totalCost, 0);
    const subtotal = materialTotal + laborTotal;
    const overhead = subtotal * (pricing.overheadPercent / 100);
    const profit = (subtotal + overhead) * (pricing.profitPercent / 100);
    const totalCost = subtotal + overhead + profit;

    const newEstimate: Estimate = {
      id: `EST-${Date.now().toString().slice(-6)}`,
      customerName: customerName || "Homeowner",
      address: address || "Property Address",
      phone,
      email,
      roofSquares,
      pitch,
      complexity,
      materials,
      labor,
      subtotal,
      wasteFactor: wasteFactor * 100,
      overhead,
      profit,
      totalCost,
      createdAt: new Date().toISOString(),
    };

    setEstimate(newEstimate);
    setActiveTab("preview");
    setLoading(false);
  }, [customerName, address, phone, email, roofSquares, pitch, complexity, includeTearOff, layers, pricing, shingleType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  const printEstimate = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Estimate Generator</h1>
          <p className="text-zinc-400 text-sm mt-1">Create professional roofing estimates and proposals</p>
        </div>
        <div className="flex gap-2">
          {estimate && (
            <>
              <button onClick={printEstimate} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center gap-2">
                🖨️ Print
              </button>
              <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors flex items-center gap-2">
                📧 Email
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center gap-2">
                💾 Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg w-fit">
        {[
          { id: "create", label: "Create Estimate", icon: "✏️" },
          { id: "preview", label: "Preview", icon: "👁️" },
          { id: "proposal", label: "Proposal", icon: "📄" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {activeTab === "create" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Customer Information</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Property Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Dallas TX"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Email</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Roof Details */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Roof Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Roof Squares</span>
                  <span className="text-white">{roofSquares} sq</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={roofSquares}
                  onChange={(e) => setRoofSquares(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Roof Pitch</span>
                  <span className="text-white">{pitch}/12</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="18"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Complexity</label>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as typeof complexity)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="complex">Complex</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Shingle Type</label>
                <select
                  value={shingleType}
                  onChange={(e) => setShingleType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="3tab">3-Tab Shingles</option>
                  <option value="architectural">Architectural Shingles</option>
                  <option value="premium">Premium Designer</option>
                  <option value="metal">Metal Roofing</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="tearoff"
                  checked={includeTearOff}
                  onChange={(e) => setIncludeTearOff(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="tearoff" className="text-sm">Include Tear-Off</label>
              </div>
              {includeTearOff && (
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Existing Layers</label>
                  <select
                    value={layers}
                    onChange={(e) => setLayers(parseInt(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={1}>1 Layer</option>
                    <option value={2}>2 Layers</option>
                    <option value={3}>3 Layers</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Pricing Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Installation Cost/Sq</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    value={pricing.costPerSquare}
                    onChange={(e) => setPricing({ ...pricing, costPerSquare: parseInt(e.target.value) })}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Tear-Off Cost/Sq</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    value={pricing.tearOffCostPerSquare}
                    onChange={(e) => setPricing({ ...pricing, tearOffCostPerSquare: parseInt(e.target.value) })}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Disposal Cost/Sq</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    value={pricing.disposalCostPerSquare}
                    onChange={(e) => setPricing({ ...pricing, disposalCostPerSquare: parseInt(e.target.value) })}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Overhead</span>
                  <span className="text-white">{pricing.overheadPercent}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={pricing.overheadPercent}
                  onChange={(e) => setPricing({ ...pricing, overheadPercent: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 flex justify-between mb-2">
                  <span>Profit Margin</span>
                  <span className="text-white">{pricing.profitPercent}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={pricing.profitPercent}
                  onChange={(e) => setPricing({ ...pricing, profitPercent: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateEstimate}
              disabled={loading}
              className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>✨ Generate Estimate</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && estimate && (
        <div ref={printRef} className="bg-zinc-800 rounded-xl p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 pb-6 border-b border-zinc-700">
            <div>
              <h2 className="text-xl font-bold">Roofing Estimate</h2>
              <p className="text-zinc-400">Estimate #{estimate.id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-400">Date: {new Date(estimate.createdAt).toLocaleDateString()}</p>
              <p className="text-sm text-zinc-400">Valid for 30 days</p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">CUSTOMER</h3>
              <p className="font-medium">{estimate.customerName}</p>
              <p className="text-sm text-zinc-400">{estimate.address}</p>
              {estimate.phone && <p className="text-sm text-zinc-400">{estimate.phone}</p>}
              {estimate.email && <p className="text-sm text-zinc-400">{estimate.email}</p>}
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">PROJECT DETAILS</h3>
              <div className="text-sm space-y-1">
                <p>Roof Size: <span className="font-medium">{estimate.roofSquares} squares</span></p>
                <p>Pitch: <span className="font-medium">{estimate.pitch}/12</span></p>
                <p>Complexity: <span className="font-medium capitalize">{estimate.complexity}</span></p>
                <p>Waste Factor: <span className="font-medium">{estimate.wasteFactor}%</span></p>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">MATERIALS</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Unit</th>
                  <th className="text-right py-2">Unit Cost</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {estimate.materials.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-700/50">
                    <td className="py-2">{item.name}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right text-zinc-500">{item.unit}</td>
                    <td className="text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="text-right font-medium">{formatCurrency(item.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Labor */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">LABOR</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Rate</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {estimate.labor.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-700/50">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right">{item.quantity} {item.unit}</td>
                    <td className="text-right">{formatCurrency(item.rate)}</td>
                    <td className="text-right font-medium">{formatCurrency(item.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Subtotal</span>
                  <span>{formatCurrency(estimate.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Overhead ({pricing.overheadPercent}%)</span>
                  <span>{formatCurrency(estimate.overhead)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Profit ({pricing.profitPercent}%)</span>
                  <span>{formatCurrency(estimate.profit)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-700">
                  <span>Total</span>
                  <span className="text-green-500">{formatCurrency(estimate.totalCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Tab */}
      {activeTab === "proposal" && estimate && (
        <div className="bg-white rounded-xl p-8 text-black print:shadow-none">
          {/* Letterhead */}
          <div className="text-center mb-8 pb-6 border-b-2 border-gray-200">
            <h1 className="text-3xl font-bold text-blue-600">Your Roofing Company</h1>
            <p className="text-gray-600">Professional Roofing Services</p>
            <p className="text-sm text-gray-500">License #12345 • Insured • Bonded</p>
          </div>

          {/* Proposal Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Roofing Proposal</h2>
            <p className="text-gray-600">Prepared for: <span className="font-medium text-black">{estimate.customerName}</span></p>
            <p className="text-gray-600">Property: <span className="font-medium text-black">{estimate.address}</span></p>
            <p className="text-sm text-gray-500">Date: {new Date(estimate.createdAt).toLocaleDateString()}</p>
          </div>

          {/* Scope of Work */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Scope of Work</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <p>• Complete removal and disposal of existing roofing materials</p>
              <p>• Inspection and repair of roof decking as needed</p>
              <p>• Installation of ice and water shield at eaves and valleys</p>
              <p>• Installation of synthetic underlayment</p>
              <p>• Installation of new drip edge and flashing</p>
              <p>• Installation of {materialCosts[shingleType]?.name || "architectural shingles"}</p>
              <p>• Installation of ridge cap and ventilation</p>
              <p>• Complete cleanup of work area and haul-away of debris</p>
            </div>
          </div>

          {/* Materials */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Materials</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              {estimate.materials.map((item, i) => (
                <li key={i}>• {item.name}: {item.quantity} {item.unit}</li>
              ))}
            </ul>
          </div>

          {/* Price */}
          <div className="mb-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Investment</h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">{formatCurrency(estimate.totalCost)}</div>
            <p className="text-sm text-gray-600">This price includes all materials, labor, permits, and cleanup.</p>
          </div>

          {/* Terms */}
          <div className="mb-8 text-sm text-gray-600">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Terms & Conditions</h3>
            <p>• 50% deposit required to schedule installation</p>
            <p>• Balance due upon completion</p>
            <p>• This proposal is valid for 30 days</p>
            <p>• Manufacturer warranty: 25 years on materials</p>
            <p>• Workmanship warranty: 5 years</p>
          </div>

          {/* Signature */}
          <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600 mb-4">Customer Acceptance:</p>
              <div className="border-b border-gray-400 h-8 mb-2"></div>
              <p className="text-xs text-gray-500">Signature / Date</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-4">Company Representative:</p>
              <div className="border-b border-gray-400 h-8 mb-2"></div>
              <p className="text-xs text-gray-500">Signature / Date</p>
            </div>
          </div>
        </div>
      )}

      {/* No Estimate State */}
      {(activeTab === "preview" || activeTab === "proposal") && !estimate && (
        <div className="bg-zinc-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold mb-2">No Estimate Generated</h3>
          <p className="text-zinc-400 text-sm mb-4">Create an estimate first to preview or generate a proposal.</p>
          <button
            onClick={() => setActiveTab("create")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Create Estimate
          </button>
        </div>
      )}
    </div>
  );
}
