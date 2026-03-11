"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface RoofPoint {
  x: number;
  y: number;
}

interface RoofSegment {
  id: string;
  name: string;
  points: RoofPoint[];
  type: "main" | "hip" | "valley" | "ridge" | "gable";
  pitch: number;
  area: number;
  color: string;
}

interface RoofMeasurement {
  id: string;
  address: string;
  imageUrl?: string;
  segments: RoofSegment[];
  totalArea: number;
  totalSquares: number;
  pitch: number;
  complexity: "simple" | "moderate" | "complex";
  materials: {
    shingles: number;
    underlayment: number;
    iceWater: number;
    ridgeCap: number;
    flashing: number;
    starterStrip: number;
    waste: number;
  };
  createdAt: string;
}

export default function RoofMeasurementToolPage() {
  const [activeTab, setActiveTab] = useState<"draw" | "measurements" | "diagram">("draw");
  const [address, setAddress] = useState("");
  const [segments, setSegments] = useState<RoofSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<RoofPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<"polygon" | "line" | "select">("polygon");
  const [pitch, setPitch] = useState(6);
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex">("moderate");
  const [measurements, setMeasurements] = useState<RoofMeasurement | null>(null);
  const [loading, setLoading] = useState(false);
  const [satelliteImage, setSatelliteImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load satellite image from Mapbox Static API
  const loadSatelliteImage = async () => {
    if (!address.trim()) return;
    setLoading(true);
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!mapboxToken) {
        console.error("Mapbox token not configured");
        setLoading(false);
        return;
      }
      // Geocode the address using Mapbox
      const geocodeRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=us&types=address&limit=1`
      );
      const geocodeData = await geocodeRes.json();
      if (geocodeData.features && geocodeData.features.length > 0) {
        const [lng, lat] = geocodeData.features[0].center;
        // Fetch satellite imagery from Mapbox Static Images API
        const imageUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},19,0/600x500@2x?access_token=${mapboxToken}`;
        setSatelliteImage(imageUrl);
      } else {
        console.error("Could not geocode address");
      }
    } catch (error) {
      console.error("Error loading satellite image:", error);
    } finally {
      setLoading(false);
    }
  };

  // Draw on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw completed segments
    segments.forEach((segment) => {
      if (segment.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(segment.points[0].x, segment.points[0].y);
      segment.points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = segment.color + "40";
      ctx.fill();
      ctx.strokeStyle = segment.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      segment.points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = segment.color;
        ctx.fill();
      });
    });

    // Draw current segment
    if (currentSegment.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentSegment[0].x, currentSegment[0].y);
      currentSegment.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      currentSegment.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      });
    }
  }, [segments, currentSegment]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== "polygon") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentSegment.length >= 3) {
      const firstPoint = currentSegment[0];
      const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
      if (distance < 15) {
        completeSegment();
        return;
      }
    }
    setCurrentSegment([...currentSegment, { x, y }]);
    setIsDrawing(true);
  };

  const completeSegment = () => {
    if (currentSegment.length < 3) return;
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
    const area = calculatePolygonArea(currentSegment);
    const newSegment: RoofSegment = {
      id: `segment-${Date.now()}`,
      name: `Section ${segments.length + 1}`,
      points: currentSegment,
      type: "main",
      pitch,
      area,
      color: colors[segments.length % colors.length],
    };
    setSegments([...segments, newSegment]);
    setCurrentSegment([]);
    setIsDrawing(false);
  };

  const calculatePolygonArea = (points: RoofPoint[]): number => {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    const pixelsPerFoot = 5;
    const sqft = area / (pixelsPerFoot * pixelsPerFoot);
    const pitchMultiplier = Math.sqrt(1 + Math.pow(pitch / 12, 2));
    return Math.round(sqft * pitchMultiplier);
  };

  const calculateMeasurements = () => {
    const totalArea = segments.reduce((sum, s) => sum + s.area, 0);
    const totalSquares = Math.ceil(totalArea / 100);
    const wasteFactors = { simple: 0.10, moderate: 0.15, complex: 0.20 };
    const wasteFactor = wasteFactors[complexity];

    const materials = {
      shingles: Math.ceil(totalSquares * (1 + wasteFactor) * 3),
      underlayment: Math.ceil(totalSquares * (1 + wasteFactor / 2)),
      iceWater: Math.ceil(totalSquares * 0.3),
      ridgeCap: Math.ceil(totalSquares * 0.8),
      flashing: Math.ceil(totalSquares * 2),
      starterStrip: Math.ceil(totalSquares * 1.5),
      waste: Math.round(wasteFactor * 100),
    };

    const measurement: RoofMeasurement = {
      id: `measurement-${Date.now()}`,
      address: address || "Unknown Address",
      segments,
      totalArea,
      totalSquares,
      pitch,
      complexity,
      materials,
      createdAt: new Date().toISOString(),
    };
    setMeasurements(measurement);
    setActiveTab("measurements");
  };

  const clearAll = () => {
    setSegments([]);
    setCurrentSegment([]);
    setIsDrawing(false);
    setMeasurements(null);
  };

  const undoLastPoint = () => {
    if (currentSegment.length > 0) {
      setCurrentSegment(currentSegment.slice(0, -1));
    } else if (segments.length > 0) {
      setSegments(segments.slice(0, -1));
    }
  };

  const deleteSegment = (id: string) => {
    setSegments(segments.filter(s => s.id !== id));
  };

  const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roof Measurement Tool</h1>
          <p className="text-zinc-400 text-sm mt-1">Measure roofs and calculate materials</p>
        </div>
        <div className="flex gap-2">
          <button onClick={calculateMeasurements} disabled={segments.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-lg font-medium transition-colors">
            Calculate Materials
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg w-fit">
        {[
          { id: "draw", label: "Draw Roof", icon: "✏️" },
          { id: "measurements", label: "Measurements", icon: "📐" },
          { id: "diagram", label: "Roof Diagram", icon: "📊" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "draw" && (
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Tools</h3>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Property Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
              <button onClick={loadSatelliteImage} disabled={loading} className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
                {loading ? "Loading..." : "Load Satellite Image"}
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Drawing Tools</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: "polygon", icon: "⬡", label: "Polygon" }, { id: "line", icon: "📏", label: "Line" }, { id: "select", icon: "👆", label: "Select" }].map((tool) => (
                  <button key={tool.id} onClick={() => setSelectedTool(tool.id as typeof selectedTool)} className={`p-2 rounded-lg text-center transition-colors ${selectedTool === tool.id ? "bg-blue-600" : "bg-zinc-700 hover:bg-zinc-600"}`}>
                    <div className="text-lg">{tool.icon}</div>
                    <div className="text-xs mt-1">{tool.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 flex justify-between mb-2"><span>Roof Pitch</span><span className="text-white">{pitch}/12</span></label>
              <input type="range" min="1" max="18" value={pitch} onChange={(e) => setPitch(parseInt(e.target.value))} className="w-full" />
            </div>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 block mb-2">Roof Complexity</label>
              <select value={complexity} onChange={(e) => setComplexity(e.target.value as typeof complexity)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="simple">Simple (10% waste)</option>
                <option value="moderate">Moderate (15% waste)</option>
                <option value="complex">Complex (20% waste)</option>
              </select>
            </div>
            <div className="space-y-2">
              <button onClick={undoLastPoint} className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">↩️ Undo</button>
              <button onClick={clearAll} className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg text-sm font-medium transition-colors">🗑️ Clear All</button>
            </div>
          </div>

          <div className="col-span-2 bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Drawing Canvas</h3>
              <span className="text-sm text-zinc-400">{isDrawing ? `Drawing: ${currentSegment.length} points` : `${segments.length} segments`}</span>
            </div>
            <div ref={containerRef} className="relative bg-zinc-900 rounded-lg overflow-hidden" style={{ height: 500 }}>
              {satelliteImage && (
                <img
                  src={satelliteImage}
                  alt="Satellite view"
                  className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none"
                />
              )}
              <canvas ref={canvasRef} width={600} height={500} onClick={handleCanvasClick} className="cursor-crosshair w-full h-full relative z-10" />
            </div>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Roof Segments</h3>
            {segments.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                <div className="text-3xl mb-2">✏️</div>
                <p>No segments drawn yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {segments.map((segment) => (
                  <div key={segment.id} className="p-3 bg-zinc-900 rounded-lg border-l-4" style={{ borderLeftColor: segment.color }}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{segment.name}</span>
                      <button onClick={() => deleteSegment(segment.id)} className="text-zinc-500 hover:text-red-500">×</button>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                      <span>{formatNumber(segment.area)} sqft</span>
                      <span>{Math.ceil(segment.area / 100)} sq</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {segments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Total Squares</span>
                  <span className="font-bold text-blue-500">{Math.ceil(segments.reduce((sum, s) => sum + s.area, 0) / 100)} sq</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "measurements" && measurements && (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Roof Summary</h3>
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Total Squares</div>
                <div className="text-2xl font-bold text-blue-500">{measurements.totalSquares} squares</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Roof Pitch</div>
                <div className="text-2xl font-bold">{measurements.pitch}/12</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-zinc-500 text-sm">Waste Factor</div>
                <div className="text-2xl font-bold text-orange-500">{measurements.materials.waste}%</div>
              </div>
            </div>
          </div>

          <div className="col-span-2 bg-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Material Calculations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-900 rounded-lg">
                <div className="font-medium">Shingles</div>
                <div className="text-3xl font-bold text-blue-500">{measurements.materials.shingles}</div>
                <div className="text-sm text-zinc-400">bundles</div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg">
                <div className="font-medium">Underlayment</div>
                <div className="text-3xl font-bold">{measurements.materials.underlayment}</div>
                <div className="text-sm text-zinc-400">rolls</div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg">
                <div className="font-medium">Ice & Water Shield</div>
                <div className="text-3xl font-bold">{measurements.materials.iceWater}</div>
                <div className="text-sm text-zinc-400">rolls</div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg">
                <div className="font-medium">Ridge Cap</div>
                <div className="text-3xl font-bold">{measurements.materials.ridgeCap}</div>
                <div className="text-sm text-zinc-400">linear feet</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "diagram" && (
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Roof Diagram</h3>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">🖨️ Print</button>
          </div>
          <div className="bg-white rounded-lg p-6 text-black" style={{ minHeight: 400 }}>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Roof Measurement Report</h2>
              <p className="text-gray-600">{address || "Property Address"}</p>
            </div>
            {segments.length > 0 && (
              <div className="border border-gray-300 rounded-lg p-4">
                <svg viewBox="0 0 200 150" className="w-full h-48">
                  {segments.map((segment) => (
                    <polygon key={segment.id} points={segment.points.map(p => `${p.x / 3},${p.y / 3}`).join(" ")} fill={segment.color + "40"} stroke={segment.color} strokeWidth="1" />
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
