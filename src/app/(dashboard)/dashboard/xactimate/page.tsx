'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Download,
  Eye,
  Clock,
  Building2,
  User,
  Phone,
  Mail,
  ChevronRight,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Zap
} from 'lucide-react';

interface XactimateEstimate {
  id: string;
  claim_number: string;
  property_address: string;
  insurance_carrier: string;
  adjuster_name: string;
  adjuster_email?: string;
  original_rcv: number;
  original_acv: number;
  depreciation: number;
  deductible: number;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'supplemented';
  ai_analysis?: {
    missing_items: MissingItem[];
    suggested_supplement: number;
    confidence: number;
    summary: string;
  };
  created_at: string;
}

interface MissingItem {
  category: string;
  item: string;
  xactimate_code: string;
  estimated_value: number;
  justification: string;
  confidence: number;
}

export default function XactimateIntegrationPage() {
  const [estimates, setEstimates] = useState<XactimateEstimate[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<XactimateEstimate | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch estimates
  const fetchEstimates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/xactimate');
      if (res.ok) {
        const data = await res.json();
        setEstimates(data.estimates || []);
      }
    } catch (error) {
      console.error('Error fetching estimates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.esx', '.pdf', '.xml', 'application/pdf', 'text/xml'];
    const isValid = validTypes.some(type => 
      file.name.endsWith(type) || file.type === type
    );

    if (!isValid) {
      alert('Please upload an Xactimate file (.esx, .pdf, or .xml)');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/xactimate/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEstimates(prev => [data.estimate, ...prev]);
        setSelectedEstimate(data.estimate);

        // Auto-analyze if it's a parseable format
        if (data.estimate.status === 'uploaded') {
          analyzeEstimate(data.estimate.id);
        }
      } else {
        const error = await res.json();
        alert(error.message || 'Failed to upload estimate');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Analyze estimate with AI
  const analyzeEstimate = async (estimateId: string) => {
    setIsAnalyzing(true);

    try {
      const res = await fetch(`/api/xactimate/${estimateId}/analyze`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setEstimates(prev => prev.map(e => 
          e.id === estimateId ? { ...e, ...data.estimate } : e
        ));
        if (selectedEstimate?.id === estimateId) {
          setSelectedEstimate(data.estimate);
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate supplement
  const generateSupplement = async (estimateId: string) => {
    try {
      const res = await fetch(`/api/xactimate/${estimateId}/supplement`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        // Download the generated supplement PDF
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Supplement generation error:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzed':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Analyzed' };
      case 'analyzing':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Analyzing...' };
      case 'supplemented':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Supplemented' };
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Uploaded' };
    }
  };

  const filteredEstimates = estimates.filter(e => {
    const matchesSearch = searchQuery === '' || 
      e.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.claim_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.insurance_carrier?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-storm-z0 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-orange-400" />
            </div>
            Xactimate Integration
          </h1>
          <p className="text-gray-400 mt-1">
            Upload estimates, AI finds missing line items, generate supplements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".esx,.pdf,.xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Upload Estimate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Total Estimates</span>
          </div>
          <p className="text-2xl font-bold text-white">{estimates.length}</p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm">Analyzed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {estimates.filter(e => e.status === 'analyzed' || e.status === 'supplemented').length}
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Missing Items Found</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">
            {estimates.reduce((sum, e) => sum + (e.ai_analysis?.missing_items.length || 0), 0)}
          </p>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Potential Recovery</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {formatCurrency(estimates.reduce((sum, e) => sum + (e.ai_analysis?.suggested_supplement || 0), 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address, claim #, or carrier..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Status</option>
          <option value="uploaded">Uploaded</option>
          <option value="analyzing">Analyzing</option>
          <option value="analyzed">Analyzed</option>
          <option value="supplemented">Supplemented</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estimates List */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold text-white">Estimates</h3>
            </div>

            <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto" />
                  <p className="text-gray-400 mt-2">Loading estimates...</p>
                </div>
              ) : filteredEstimates.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-white font-medium mb-1">No estimates yet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Upload an Xactimate estimate to get started
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Upload First Estimate
                  </button>
                </div>
              ) : (
                filteredEstimates.map((estimate) => {
                  const statusBadge = getStatusBadge(estimate.status);
                  return (
                    <button
                      key={estimate.id}
                      onClick={() => setSelectedEstimate(estimate)}
                      className={`w-full p-4 text-left hover:bg-gray-700/30 transition-colors ${
                        selectedEstimate?.id === estimate.id ? 'bg-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">
                            {estimate.property_address.split(',')[0]}
                          </p>
                          <p className="text-sm text-gray-400 truncate">
                            {estimate.insurance_carrier}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                              {statusBadge.label}
                            </span>
                            {estimate.claim_number && (
                              <span className="text-xs text-gray-500">
                                #{estimate.claim_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            {formatCurrency(estimate.original_rcv)}
                          </p>
                          {estimate.ai_analysis?.suggested_supplement && estimate.ai_analysis.suggested_supplement > 0 && (
                            <p className="text-sm text-orange-400">
                              +{formatCurrency(estimate.ai_analysis.suggested_supplement)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Estimate Details */}
        <div className="lg:col-span-2">
          {selectedEstimate ? (
            <div className="space-y-4">
              {/* Estimate Header */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selectedEstimate.property_address}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {selectedEstimate.insurance_carrier}
                      </span>
                      {selectedEstimate.claim_number && (
                        <span>Claim #{selectedEstimate.claim_number}</span>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusBadge(selectedEstimate.status).bg} ${getStatusBadge(selectedEstimate.status).text}`}>
                    {getStatusBadge(selectedEstimate.status).label}
                  </span>
                </div>

                {/* Adjuster Info */}
                {selectedEstimate.adjuster_name && (
                  <div className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg mb-4">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-white font-medium">{selectedEstimate.adjuster_name}</p>
                      {selectedEstimate.adjuster_email && (
                        <p className="text-sm text-gray-400">{selectedEstimate.adjuster_email}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">RCV</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(selectedEstimate.original_rcv)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">ACV</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(selectedEstimate.original_acv)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">Depreciation</p>
                    <p className="text-lg font-bold text-red-400">
                      {formatCurrency(selectedEstimate.depreciation)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-400">Deductible</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(selectedEstimate.deductible)}
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedEstimate.ai_analysis ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-orange-400" />
                      AI Analysis
                    </h3>
                    <span className="text-sm text-gray-400">
                      {Math.round(selectedEstimate.ai_analysis.confidence * 100)}% confidence
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-gray-300 mb-4">
                    {selectedEstimate.ai_analysis.summary}
                  </p>

                  {/* Suggested Supplement */}
                  {selectedEstimate.ai_analysis.suggested_supplement > 0 && (
                    <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-400 font-medium">Suggested Supplement</p>
                          <p className="text-2xl font-bold text-white">
                            {formatCurrency(selectedEstimate.ai_analysis.suggested_supplement)}
                          </p>
                        </div>
                        <button
                          onClick={() => generateSupplement(selectedEstimate.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          Generate Supplement
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Missing Items */}
                  {selectedEstimate.ai_analysis.missing_items.length > 0 && (
                    <div>
                      <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                        Missing Line Items ({selectedEstimate.ai_analysis.missing_items.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedEstimate.ai_analysis.missing_items.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                    {item.category}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {item.xactimate_code}
                                  </span>
                                </div>
                                <p className="font-medium text-white mt-1">{item.item}</p>
                                <p className="text-sm text-gray-400 mt-1">{item.justification}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-orange-400">
                                  {formatCurrency(item.estimated_value)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {Math.round(item.confidence * 100)}% conf
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedEstimate.status === 'uploaded' ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 text-center">
                  <Sparkles className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Ready for AI Analysis
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Our AI will scan for missing line items and suggest supplement amounts
                  </p>
                  <button
                    onClick={() => analyzeEstimate(selectedEstimate.id)}
                    disabled={isAnalyzing}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin inline mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5 inline mr-2" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                </div>
              ) : selectedEstimate.status === 'analyzing' ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 text-center">
                  <RefreshCw className="h-12 w-12 text-blue-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Analyzing Estimate...
                  </h3>
                  <p className="text-gray-400">
                    AI is scanning for missing items and calculating supplement potential
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-12 text-center">
              <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Select an Estimate
              </h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Choose an estimate from the list or upload a new Xactimate file to analyze
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
