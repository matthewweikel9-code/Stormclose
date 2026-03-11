'use client';

import { useState, useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Cloud,
  Home,
  Ruler,
  Map,
  ChevronRight,
  Check,
  Calendar,
  Building,
  AlertTriangle,
  DollarSign,
  Loader2,
  Eye,
  X,
  Share2,
  Mail,
  Copy,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: ReportField[];
}

interface ReportField {
  id: string;
  name: string;
  description: string;
  included: boolean;
  required?: boolean;
}

interface PropertyReportData {
  address: string;
  owner: string;
  propertyValue: number;
  yearBuilt: number;
  roofAge: number;
  roofType: string;
  roofSquares: number;
  lotSize: number;
  stormHistory: StormEvent[];
  damageScore: number;
  lastInspection?: string;
}

interface StormReportData {
  stormDate: string;
  stormType: string;
  maxHailSize: number;
  maxWindSpeed: number;
  affectedProperties: number;
  damageEstimate: number;
  impactRadius: number;
  coordinates: { lat: number; lng: number };
}

interface MeasurementReportData {
  address: string;
  totalSquares: number;
  roofPitch: string;
  segments: { name: string; sqft: number }[];
  materials: { item: string; quantity: number; unit: string }[];
  wasteFactor: number;
  measurementDate: string;
}

interface RouteReportData {
  routeName: string;
  totalStops: number;
  totalDistance: number;
  estimatedTime: number;
  stops: { address: string; priority: string; notes: string }[];
  optimized: boolean;
}

interface StormEvent {
  date: string;
  type: string;
  severity: string;
}

interface GeneratedReport {
  id: string;
  type: string;
  name: string;
  generatedAt: string;
  data: unknown;
}

// =============================================================================
// REPORT TYPES CONFIG
// =============================================================================

const REPORT_TYPES: ReportType[] = [
  {
    id: 'property',
    name: 'Property Report',
    description: 'Complete property analysis with owner info, roof data, and storm history',
    icon: Home,
    color: 'blue',
    fields: [
      { id: 'owner', name: 'Owner Information', description: 'Name, contact, mailing address', included: true, required: true },
      { id: 'property', name: 'Property Details', description: 'Value, year built, lot size', included: true },
      { id: 'roof', name: 'Roof Intelligence', description: 'Type, age, condition, squares', included: true },
      { id: 'storm', name: 'Storm History', description: 'Past storms affecting property', included: true },
      { id: 'damage', name: 'Damage Assessment', description: 'AI damage probability score', included: true },
      { id: 'photos', name: 'Property Photos', description: 'Satellite and street view images', included: false },
      { id: 'neighborhood', name: 'Neighborhood Data', description: 'Area statistics and comparisons', included: false },
    ],
  },
  {
    id: 'storm',
    name: 'Storm Damage Report',
    description: 'Detailed storm analysis with impact zones and affected properties',
    icon: Cloud,
    color: 'purple',
    fields: [
      { id: 'overview', name: 'Storm Overview', description: 'Date, type, severity details', included: true, required: true },
      { id: 'impact', name: 'Impact Analysis', description: 'Hail size, wind speed, radius', included: true },
      { id: 'properties', name: 'Affected Properties', description: 'List of impacted addresses', included: true },
      { id: 'damage', name: 'Damage Estimates', description: 'Total estimated damage value', included: true },
      { id: 'map', name: 'Impact Map', description: 'Visual storm path and damage zones', included: false },
      { id: 'timeline', name: 'Storm Timeline', description: 'Hourly progression of storm', included: false },
    ],
  },
  {
    id: 'measurement',
    name: 'Roof Measurement Report',
    description: 'Accurate roof measurements with material calculations',
    icon: Ruler,
    color: 'green',
    fields: [
      { id: 'measurements', name: 'Measurements', description: 'Total squares, pitch, segments', included: true, required: true },
      { id: 'materials', name: 'Material List', description: 'Shingles, underlayment, accessories', included: true },
      { id: 'diagram', name: 'Roof Diagram', description: 'Visual roof outline and segments', included: true },
      { id: 'satellite', name: 'Satellite Image', description: 'Property satellite view', included: false },
      { id: 'calculations', name: 'Calculation Details', description: 'Waste factor, pitch multiplier', included: false },
    ],
  },
  {
    id: 'route',
    name: 'Sales Route Report',
    description: 'Optimized route with stop details and navigation info',
    icon: Map,
    color: 'orange',
    fields: [
      { id: 'stops', name: 'Stop List', description: 'All addresses with priority levels', included: true, required: true },
      { id: 'route', name: 'Route Details', description: 'Distance, time, optimization', included: true },
      { id: 'map', name: 'Route Map', description: 'Visual route with directions', included: false },
      { id: 'notes', name: 'Stop Notes', description: 'Notes for each property', included: true },
      { id: 'schedule', name: 'Time Schedule', description: 'Estimated arrival times', included: false },
    ],
  },
];

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_PROPERTY_DATA: PropertyReportData = {
  address: '123 Storm Lane, Dallas, TX 75201',
  owner: 'John Smith',
  propertyValue: 425000,
  yearBuilt: 1998,
  roofAge: 12,
  roofType: '3-Tab Shingle',
  roofSquares: 28,
  lotSize: 8500,
  stormHistory: [
    { date: '2024-04-15', type: 'Hail', severity: 'Major' },
    { date: '2023-06-22', type: 'Wind', severity: 'Moderate' },
    { date: '2022-03-08', type: 'Hail', severity: 'Minor' },
  ],
  damageScore: 78,
  lastInspection: '2024-01-15',
};

const MOCK_STORM_DATA: StormReportData = {
  stormDate: '2024-04-15',
  stormType: 'Severe Hail Storm',
  maxHailSize: 2.5,
  maxWindSpeed: 65,
  affectedProperties: 1247,
  damageEstimate: 18500000,
  impactRadius: 8.5,
  coordinates: { lat: 32.7767, lng: -96.797 },
};

const MOCK_MEASUREMENT_DATA: MeasurementReportData = {
  address: '123 Storm Lane, Dallas, TX 75201',
  totalSquares: 28.5,
  roofPitch: '6/12',
  segments: [
    { name: 'Main Roof', sqft: 1850 },
    { name: 'Garage', sqft: 450 },
    { name: 'Porch Overhang', sqft: 150 },
  ],
  materials: [
    { item: 'Architectural Shingles', quantity: 86, unit: 'bundles' },
    { item: 'Synthetic Underlayment', quantity: 3, unit: 'rolls' },
    { item: 'Ridge Caps', quantity: 4, unit: 'bundles' },
    { item: 'Drip Edge', quantity: 200, unit: 'linear ft' },
    { item: 'Ice & Water Shield', quantity: 2, unit: 'rolls' },
  ],
  wasteFactor: 12,
  measurementDate: '2024-05-20',
};

const MOCK_ROUTE_DATA: RouteReportData = {
  routeName: 'North Dallas Morning Route',
  totalStops: 12,
  totalDistance: 18.5,
  estimatedTime: 4.5,
  stops: [
    { address: '123 Oak St, Dallas, TX', priority: 'High', notes: 'Recent hail damage reported' },
    { address: '456 Maple Ave, Dallas, TX', priority: 'High', notes: '15-year old roof, good candidate' },
    { address: '789 Pine Rd, Dallas, TX', priority: 'Medium', notes: 'Neighbor had roof replaced' },
    { address: '321 Cedar Ln, Dallas, TX', priority: 'Medium', notes: 'Insurance claim filed' },
    { address: '654 Elm Dr, Dallas, TX', priority: 'Low', notes: 'Follow-up visit' },
  ],
  optimized: true,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [reportFields, setReportFields] = useState<ReportField[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'print'>('pdf');
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Select report type
  const handleSelectType = (type: ReportType) => {
    setSelectedType(type);
    setReportFields([...type.fields]);
    setGeneratedReport(null);
    setShowPreview(false);
  };

  // Toggle field inclusion
  const toggleField = (fieldId: string) => {
    setReportFields(prev =>
      prev.map(f =>
        f.id === fieldId && !f.required ? { ...f, included: !f.included } : f
      )
    );
  };

  // Generate report
  const handleGenerate = async () => {
    if (!selectedType) return;

    setGenerating(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const report: GeneratedReport = {
      id: Date.now().toString(),
      type: selectedType.id,
      name: `${selectedType.name} - ${new Date().toLocaleDateString()}`,
      generatedAt: new Date().toISOString(),
      data: getMockData(selectedType.id),
    };

    setGeneratedReport(report);
    setRecentReports(prev => [report, ...prev.slice(0, 4)]);
    setGenerating(false);
    setShowPreview(true);
  };

  // Get mock data based on type
  const getMockData = (type: string) => {
    switch (type) {
      case 'property':
        return MOCK_PROPERTY_DATA;
      case 'storm':
        return MOCK_STORM_DATA;
      case 'measurement':
        return MOCK_MEASUREMENT_DATA;
      case 'route':
        return MOCK_ROUTE_DATA;
      default:
        return null;
    }
  };

  // Export handlers
  const handleExport = async (format: 'pdf' | 'csv' | 'print') => {
    setExportFormat(format);

    if (format === 'print') {
      window.print();
      return;
    }

    if (format === 'pdf') {
      // In production, this would call a PDF generation API
      alert('PDF export would generate a downloadable PDF file');
      return;
    }

    if (format === 'csv') {
      // Generate CSV
      const csvContent = generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedType?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Generate CSV content
  const generateCSV = () => {
    if (!generatedReport || !selectedType) return '';

    const data = generatedReport.data as Record<string, unknown>;
    const rows: string[] = [];

    // Header
    rows.push(`${selectedType.name}`);
    rows.push(`Generated: ${new Date(generatedReport.generatedAt).toLocaleString()}`);
    rows.push('');

    // Data rows
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        rows.push(`${key}:`);
        value.forEach(item => {
          if (typeof item === 'object') {
            rows.push(Object.values(item as Record<string, unknown>).join(','));
          } else {
            rows.push(String(item));
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        rows.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        rows.push(`${key},${value}`);
      }
    });

    return rows.join('\n');
  };

  // Share handlers
  const handleShare = (method: 'email' | 'copy') => {
    if (method === 'email') {
      const subject = encodeURIComponent(`${selectedType?.name} - StormAI Report`);
      const body = encodeURIComponent(`Please find attached the ${selectedType?.name} generated on ${new Date().toLocaleDateString()}`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Report link copied to clipboard');
    }
  };

  // Get color classes
  const getColorClass = (color: string, type: 'bg' | 'text' | 'border') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
      green: { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
      orange: { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
    };
    return colors[color]?.[type] || '';
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Export Reports</h1>
        <p className="text-gray-400">
          Generate professional reports for properties, storms, measurements, and routes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Type Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Report Type
            </h2>

            <div className="space-y-3">
              {REPORT_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedType?.id === type.id;

                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className={`w-full p-4 rounded-lg border transition-all text-left ${
                      isSelected
                        ? `border-2 ${getColorClass(type.color, 'border')} bg-gray-800/50`
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getColorClass(type.color, 'bg')} bg-opacity-20`}>
                        <Icon className={`w-5 h-5 ${getColorClass(type.color, 'text')}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{type.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-green-400" />}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Reports */}
          {recentReports.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Recent Reports
              </h2>

              <div className="space-y-2">
                {recentReports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setGeneratedReport(report);
                      setShowPreview(true);
                      const type = REPORT_TYPES.find(t => t.id === report.type);
                      if (type) setSelectedType(type);
                    }}
                    className="w-full p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="font-medium text-white text-sm">{report.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(report.generatedAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Report Configuration & Preview */}
        <div className="lg:col-span-2">
          {!selectedType ? (
            <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Select a Report Type</h3>
              <p className="text-gray-400">
                Choose a report type from the left to configure and generate your report
              </p>
            </div>
          ) : !showPreview ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              {/* Report Header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${getColorClass(selectedType.color, 'bg')} bg-opacity-20`}>
                    <selectedType.icon className={`w-6 h-6 ${getColorClass(selectedType.color, 'text')}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedType.name}</h2>
                    <p className="text-gray-400 text-sm">{selectedType.description}</p>
                  </div>
                </div>
              </div>

              {/* Field Selection */}
              <div className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Include in Report</h3>

                <div className="space-y-3">
                  {reportFields.map(field => (
                    <label
                      key={field.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        field.included
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                      } ${field.required ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={field.included}
                        onChange={() => toggleField(field.id)}
                        disabled={field.required}
                        className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{field.name}</span>
                          {field.required && (
                            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{field.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Export Format */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-4">Export Format</h3>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 p-4 rounded-lg border transition-colors ${
                        exportFormat === 'pdf'
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <FileText className={`w-6 h-6 mx-auto mb-2 ${
                        exportFormat === 'pdf' ? 'text-red-400' : 'text-gray-400'
                      }`} />
                      <div className="text-sm font-medium text-white">PDF</div>
                      <div className="text-xs text-gray-500">Professional format</div>
                    </button>

                    <button
                      onClick={() => setExportFormat('csv')}
                      className={`flex-1 p-4 rounded-lg border transition-colors ${
                        exportFormat === 'csv'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <FileSpreadsheet className={`w-6 h-6 mx-auto mb-2 ${
                        exportFormat === 'csv' ? 'text-green-400' : 'text-gray-400'
                      }`} />
                      <div className="text-sm font-medium text-white">CSV</div>
                      <div className="text-xs text-gray-500">Spreadsheet data</div>
                    </button>

                    <button
                      onClick={() => setExportFormat('print')}
                      className={`flex-1 p-4 rounded-lg border transition-colors ${
                        exportFormat === 'print'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Printer className={`w-6 h-6 mx-auto mb-2 ${
                        exportFormat === 'print' ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                      <div className="text-sm font-medium text-white">Print</div>
                      <div className="text-xs text-gray-500">Direct print</div>
                    </button>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Generate Report
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Report Preview */
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              {/* Preview Header */}
              <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getColorClass(selectedType.color, 'bg')} bg-opacity-20`}>
                    <selectedType.icon className={`w-5 h-5 ${getColorClass(selectedType.color, 'text')}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{generatedReport?.name}</h2>
                    <p className="text-sm text-gray-400">
                      Generated {new Date(generatedReport?.generatedAt || '').toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Report Content */}
              <div ref={reportRef} className="p-6 print:p-0">
                {selectedType.id === 'property' && (
                  <PropertyReportPreview data={generatedReport?.data as PropertyReportData} />
                )}
                {selectedType.id === 'storm' && (
                  <StormReportPreview data={generatedReport?.data as StormReportData} />
                )}
                {selectedType.id === 'measurement' && (
                  <MeasurementReportPreview data={generatedReport?.data as MeasurementReportData} />
                )}
                {selectedType.id === 'route' && (
                  <RouteReportPreview data={generatedReport?.data as RouteReportData} />
                )}
              </div>

              {/* Export Actions */}
              <div className="p-6 border-t border-gray-800">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>

                  <button
                    onClick={() => handleExport('csv')}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export CSV
                  </button>

                  <button
                    onClick={() => handleExport('print')}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print Report
                  </button>
                </div>

                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => handleShare('email')}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Email Report
                  </button>

                  <button
                    onClick={() => handleShare('copy')}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// REPORT PREVIEW COMPONENTS
// =============================================================================

function PropertyReportPreview({ data }: { data: PropertyReportData }) {
  return (
    <div className="space-y-6">
      {/* Property Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-blue-200 mb-1">Property Report</div>
            <h3 className="text-2xl font-bold">{data.address}</h3>
            <div className="text-blue-200 mt-2">Owner: {data.owner}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-200">Damage Score</div>
            <div className="text-4xl font-bold">{data.damageScore}</div>
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <DollarSign className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-sm text-gray-400">Property Value</div>
          <div className="text-xl font-bold text-white">${data.propertyValue.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Building className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-sm text-gray-400">Year Built</div>
          <div className="text-xl font-bold text-white">{data.yearBuilt}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Home className="w-5 h-5 text-purple-400 mb-2" />
          <div className="text-sm text-gray-400">Roof Age</div>
          <div className="text-xl font-bold text-white">{data.roofAge} years</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Ruler className="w-5 h-5 text-orange-400 mb-2" />
          <div className="text-sm text-gray-400">Roof Size</div>
          <div className="text-xl font-bold text-white">{data.roofSquares} sq</div>
        </div>
      </div>

      {/* Roof Details */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Roof Intelligence</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400">Roof Type</div>
            <div className="text-white">{data.roofType}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Lot Size</div>
            <div className="text-white">{data.lotSize.toLocaleString()} sq ft</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Last Inspection</div>
            <div className="text-white">{data.lastInspection || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Storm History */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Storm History</h4>
        <div className="space-y-2">
          {data.stormHistory.map((storm, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-4 h-4 ${
                  storm.severity === 'Major' ? 'text-red-400' :
                  storm.severity === 'Moderate' ? 'text-yellow-400' : 'text-green-400'
                }`} />
                <div>
                  <div className="text-white">{storm.type}</div>
                  <div className="text-sm text-gray-400">{storm.date}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                storm.severity === 'Major' ? 'bg-red-500/20 text-red-400' :
                storm.severity === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
              }`}>
                {storm.severity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StormReportPreview({ data }: { data: StormReportData }) {
  return (
    <div className="space-y-6">
      {/* Storm Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-purple-200 mb-1">Storm Damage Report</div>
            <h3 className="text-2xl font-bold">{data.stormType}</h3>
            <div className="text-purple-200 mt-2">{data.stormDate}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-200">Total Damage</div>
            <div className="text-3xl font-bold">${(data.damageEstimate / 1000000).toFixed(1)}M</div>
          </div>
        </div>
      </div>

      {/* Storm Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <Cloud className="w-5 h-5 text-cyan-400 mb-2" />
          <div className="text-sm text-gray-400">Max Hail Size</div>
          <div className="text-xl font-bold text-white">{data.maxHailSize}"</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mb-2" />
          <div className="text-sm text-gray-400">Max Wind Speed</div>
          <div className="text-xl font-bold text-white">{data.maxWindSpeed} mph</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Home className="w-5 h-5 text-red-400 mb-2" />
          <div className="text-sm text-gray-400">Properties Affected</div>
          <div className="text-xl font-bold text-white">{data.affectedProperties.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Map className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-sm text-gray-400">Impact Radius</div>
          <div className="text-xl font-bold text-white">{data.impactRadius} mi</div>
        </div>
      </div>

      {/* Impact Zone */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Impact Zone</h4>
        <div className="h-48 bg-gray-700/50 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Map className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <div>Storm impact map would render here</div>
            <div className="text-sm">Center: {data.coordinates.lat.toFixed(4)}, {data.coordinates.lng.toFixed(4)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeasurementReportPreview({ data }: { data: MeasurementReportData }) {
  return (
    <div className="space-y-6">
      {/* Measurement Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-green-200 mb-1">Roof Measurement Report</div>
            <h3 className="text-2xl font-bold">{data.address}</h3>
            <div className="text-green-200 mt-2">Measured: {data.measurementDate}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-green-200">Total Squares</div>
            <div className="text-4xl font-bold">{data.totalSquares}</div>
          </div>
        </div>
      </div>

      {/* Roof Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Roof Pitch</div>
          <div className="text-xl font-bold text-white">{data.roofPitch}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Waste Factor</div>
          <div className="text-xl font-bold text-white">{data.wasteFactor}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Segments</div>
          <div className="text-xl font-bold text-white">{data.segments.length}</div>
        </div>
      </div>

      {/* Roof Segments */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Roof Segments</h4>
        <div className="space-y-2">
          {data.segments.map((segment, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <span className="text-white">{segment.name}</span>
              <span className="text-gray-400">{segment.sqft.toLocaleString()} sq ft</span>
            </div>
          ))}
        </div>
      </div>

      {/* Material List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Material Requirements</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm">
                <th className="pb-2">Material</th>
                <th className="pb-2 text-right">Quantity</th>
                <th className="pb-2 text-right">Unit</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {data.materials.map((material, idx) => (
                <tr key={idx} className="border-t border-gray-700">
                  <td className="py-2">{material.item}</td>
                  <td className="py-2 text-right">{material.quantity}</td>
                  <td className="py-2 text-right text-gray-400">{material.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RouteReportPreview({ data }: { data: RouteReportData }) {
  return (
    <div className="space-y-6">
      {/* Route Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-orange-200 mb-1">Sales Route Report</div>
            <h3 className="text-2xl font-bold">{data.routeName}</h3>
            <div className="flex items-center gap-2 mt-2">
              {data.optimized && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                  Optimized
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-orange-200">Total Stops</div>
            <div className="text-4xl font-bold">{data.totalStops}</div>
          </div>
        </div>
      </div>

      {/* Route Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <Map className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-sm text-gray-400">Total Distance</div>
          <div className="text-xl font-bold text-white">{data.totalDistance} mi</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Calendar className="w-5 h-5 text-purple-400 mb-2" />
          <div className="text-sm text-gray-400">Estimated Time</div>
          <div className="text-xl font-bold text-white">{data.estimatedTime} hrs</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <Home className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-sm text-gray-400">Stops</div>
          <div className="text-xl font-bold text-white">{data.stops.length}</div>
        </div>
      </div>

      {/* Stop List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3">Route Stops</h4>
        <div className="space-y-2">
          {data.stops.map((stop, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{stop.address}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    stop.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                    stop.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {stop.priority}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">{stop.notes}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
