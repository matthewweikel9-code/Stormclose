'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  Plus,
  Search,
  FileText,
  Camera,
  Calculator,
  ClipboardList,
  MapPin,
  Clock,
  ChevronRight,
  Loader2,
  Home,
  DollarSign,
  Ruler,
  FileCheck,
  Download,
  Eye,
  Building2,
  Crosshair,
  ArrowRight,
  Filter,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Phase8DocumentsPage } from '@/components/documents/Phase8DocumentsPage';

type DealTab = 'all' | 'active' | 'estimates' | 'reports';

interface DealFolder {
  id: string;
  address: string;
  city: string;
  state: string;
  status: 'new' | 'inspected' | 'estimated' | 'submitted' | 'approved' | 'closed';
  createdAt: string;
  estimateValue?: number;
  hasEstimate: boolean;
  hasReport: boolean;
  hasPhotos: boolean;
  lastActivity: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'purple' }> = {
  new: { label: 'New', variant: 'default' },
  inspected: { label: 'Inspected', variant: 'purple' },
  estimated: { label: 'Estimated', variant: 'warning' },
  submitted: { label: 'Submitted', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  closed: { label: 'Closed Won', variant: 'success' },
};

function LegacyDealDeskPage() {
  const [activeTab, setActiveTab] = useState<DealTab>('all');
  const [deals, setDeals] = useState<DealFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      // Fetch leads as deal folders
      const res = await fetch('/api/leads?limit=50');
      if (res.ok) {
        const data = await res.json();
        const mapped: DealFolder[] = (data.leads || []).map((lead: any) => ({
          id: lead.id,
          address: lead.address || 'Unknown',
          city: lead.city || '',
          state: lead.state || '',
          status: lead.status || 'new',
          createdAt: lead.created_at || new Date().toISOString(),
          estimateValue: lead.estimate_value || undefined,
          hasEstimate: !!lead.estimate_value,
          hasReport: false,
          hasPhotos: false,
          lastActivity: lead.updated_at || lead.created_at || new Date().toISOString(),
        }));
        setDeals(mapped);
      }
    } catch (err) {
      console.error('Error fetching deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupAddress.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/property/lookup?address=${encodeURIComponent(lookupAddress)}`);
      if (res.ok) {
        const data = await res.json();
        setLookupResult(data);
      }
    } catch (err) {
      console.error('Property lookup error:', err);
    } finally {
      setLookupLoading(false);
    }
  };

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = !searchQuery ||
      deal.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.city.toLowerCase().includes(searchQuery.toLowerCase());

    switch (activeTab) {
      case 'active':
        return matchesSearch && !['closed', 'new'].includes(deal.status);
      case 'estimates':
        return matchesSearch && deal.hasEstimate;
      case 'reports':
        return matchesSearch && deal.hasReport;
      default:
        return matchesSearch;
    }
  });

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const tabs = [
    { id: 'all' as DealTab, label: 'All Deals', count: deals.length },
    { id: 'active' as DealTab, label: 'Active', count: deals.filter(d => !['closed', 'new'].includes(d.status)).length },
    { id: 'estimates' as DealTab, label: 'Estimates', count: deals.filter(d => d.hasEstimate).length },
    { id: 'reports' as DealTab, label: 'Reports', count: deals.filter(d => d.hasReport).length },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow shadow-lg shadow-storm-purple/20">
              <FolderOpen className="h-5 w-5 text-white" />
            </span>
            Deal Desk
          </h1>
          <p className="mt-1 text-sm text-storm-muted">
            Manage property deals, estimates, and inspection reports
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewDeal(!showNewDeal)}
            className="button-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Property Lookup (New Deal) */}
      {showNewDeal && (
        <div className="storm-card-glow p-5 animate-fade-in-up">
          <h2 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <Home className="w-4 h-4 text-storm-glow" />
            Property Lookup
          </h2>
          <form onSubmit={handlePropertyLookup} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-subtle" />
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => setLookupAddress(e.target.value)}
                placeholder="Enter property address..."
                className="w-full bg-storm-z1 border border-storm-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-storm-subtle focus:outline-none focus:border-storm-purple/50"
              />
            </div>
            <button
              type="submit"
              disabled={lookupLoading || !lookupAddress.trim()}
              className="button-primary px-5 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Lookup
            </button>
          </form>

          {lookupResult && (
            <div className="mt-4 bg-storm-z1/50 rounded-xl p-4 border border-storm-border/50">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white text-sm">{lookupResult.address || lookupAddress}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {lookupResult.yearBuilt && (
                      <div>
                        <p className="text-2xs text-storm-subtle">Year Built</p>
                        <p className="text-sm font-medium text-white">{lookupResult.yearBuilt}</p>
                      </div>
                    )}
                    {lookupResult.squareFeet && (
                      <div>
                        <p className="text-2xs text-storm-subtle">Sq Ft</p>
                        <p className="text-sm font-medium text-white">{lookupResult.squareFeet.toLocaleString()}</p>
                      </div>
                    )}
                    {lookupResult.roofType && (
                      <div>
                        <p className="text-2xs text-storm-subtle">Roof Type</p>
                        <p className="text-sm font-medium text-white">{lookupResult.roofType}</p>
                      </div>
                    )}
                    {lookupResult.estimatedValue && (
                      <div>
                        <p className="text-2xs text-storm-subtle">Est. Value</p>
                        <p className="text-sm font-medium text-emerald-400">${lookupResult.estimatedValue.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button className="button-primary text-xs flex items-center gap-1.5">
                  <Plus className="w-3 h-3" />
                  Create Deal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              <span className={`text-2xs px-1.5 py-0.5 rounded-md ${
                activeTab === tab.id ? 'bg-storm-purple/20 text-storm-glow' : 'bg-storm-z2 text-storm-subtle'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-storm-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals..."
            className="w-full bg-storm-z1 border border-storm-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-storm-subtle focus:outline-none focus:border-storm-purple/50"
          />
        </div>
      </div>

      {/* Deal Folders Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-storm-glow animate-spin" />
          <span className="ml-3 text-storm-muted text-sm">Loading deals...</span>
        </div>
      ) : filteredDeals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredDeals.map((deal) => {
            const statusConfig = STATUS_CONFIG[deal.status] || STATUS_CONFIG.new;
            return (
              <div
                key={deal.id}
                className="storm-card-interactive p-5 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-storm-purple/10 flex items-center justify-center">
                      <Home className="w-4 h-4 text-storm-glow" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white text-sm truncate max-w-[180px]">{deal.address}</h3>
                      <p className="text-2xs text-storm-subtle">{deal.city}, {deal.state}</p>
                    </div>
                  </div>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </div>

                {deal.estimateValue && (
                  <div className="flex items-center gap-1.5 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">{formatCurrency(deal.estimateValue)}</span>
                    <span className="text-2xs text-storm-subtle ml-1">estimate</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-2xs text-storm-subtle mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(deal.lastActivity)}
                  </span>
                </div>

                {/* Document indicators */}
                <div className="flex items-center gap-2 pt-3 border-t border-storm-border/50">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs ${
                    deal.hasEstimate ? 'bg-emerald-500/10 text-emerald-400' : 'bg-storm-z2 text-storm-subtle'
                  }`}>
                    <Calculator className="w-3 h-3" />
                    Estimate
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs ${
                    deal.hasReport ? 'bg-blue-500/10 text-blue-400' : 'bg-storm-z2 text-storm-subtle'
                  }`}>
                    <FileText className="w-3 h-3" />
                    Report
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs ${
                    deal.hasPhotos ? 'bg-amber-500/10 text-amber-400' : 'bg-storm-z2 text-storm-subtle'
                  }`}>
                    <Camera className="w-3 h-3" />
                    Photos
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/dashboard/documents?property=${encodeURIComponent(deal.address)}`}
                    className="flex-1 button-primary text-xs flex items-center justify-center gap-1.5 py-2"
                  >
                    <Eye className="w-3 h-3" />
                    Open Deal
                  </Link>
                  <a
                    href={`https://maps.google.com?q=${encodeURIComponent(deal.address + ', ' + deal.city + ', ' + deal.state)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors"
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
            <FolderOpen className="w-8 h-8 text-storm-subtle" />
          </div>
          <h3 className="text-white font-medium text-sm mb-1.5">
            {searchQuery ? 'No matching deals' : 'No deals yet'}
          </h3>
          <p className="text-storm-subtle text-xs mb-4">
            {searchQuery ? 'Try a different search term' : 'Look up a property to create your first deal'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowNewDeal(true)}
              className="button-primary inline-flex items-center gap-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Deal
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return <Phase8DocumentsPage />;
}
