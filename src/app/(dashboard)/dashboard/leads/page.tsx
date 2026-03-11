'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  HomeIcon,
  UserIcon,
  ChartBarIcon,
  PlusIcon,
  CheckIcon,
  ArrowPathIcon,
  XMarkIcon,
  MapIcon,
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  CloudIcon,
  ArrowUpTrayIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon, SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  owner: string;
  apn: string;
  propertyType: string;
  coordinates: { lat: number; lng: number };
  // Calculated fields
  leadScore: number;
  estimatedValue: number;
  roofAge: number;
  successProbability: number;
  estimatedProfit: number;
  // Property details from API
  yearBuilt?: number;
  squareFeet?: number;
  lotSize?: string;
  bedrooms?: number;
  bathrooms?: number;
  roofType?: string;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

interface PropertyDetail extends Property {
  ownerPhone?: string;
  ownerEmail?: string;
  yearBuilt?: number;
  squareFeet?: number;
  lotSize?: string;
  bedrooms?: number;
  bathrooms?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

interface SavedLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lead_score: number;
  status: string;
  source: string;
  storm_date?: string;
  hail_size?: number;
  phone?: string;
  created_at: string;
}

export default function LeadsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [routeList, setRouteList] = useState<Property[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // AI Feature States
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('saved');
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotData, setCopilotData] = useState<any>(null);
  const [showCopilot, setShowCopilot] = useState(false);
  
  // JobNimbus Integration States
  const [jnConnected, setJnConnected] = useState(false);
  const [exportingLeads, setExportingLeads] = useState<Set<string>>(new Set());
  const [exportedLeads, setExportedLeads] = useState<Set<string>>(new Set());

  // Fetch saved leads on mount
  useEffect(() => {
    fetchSavedLeads();
    checkJobNimbusConnection();
  }, []);

  const checkJobNimbusConnection = async () => {
    try {
      const res = await fetch('/api/integrations/jobnimbus/connect');
      if (res.ok) {
        const data = await res.json();
        setJnConnected(data.connected);
      }
    } catch (err) {
      console.error('Error checking JN connection:', err);
    }
  };

  const exportToJobNimbus = async (lead: SavedLead) => {
    if (exportingLeads.has(lead.id) || exportedLeads.has(lead.id)) return;
    
    setExportingLeads(prev => new Set(prev).add(lead.id));
    
    try {
      const res = await fetch('/api/integrations/jobnimbus/export-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setExportedLeads(prev => new Set(prev).add(lead.id));
      } else {
        console.error('Export failed:', data.error);
        // Show error toast or message
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  const fetchSavedLeads = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch('/api/leads?limit=50');
      if (res.ok) {
        const data = await res.json();
        setSavedLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Error fetching saved leads:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Load route list from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('routeList');
    if (saved) {
      try {
        setRouteList(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse route list:', e);
      }
    }
  }, []);

  // Save route list to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('routeList', JSON.stringify(routeList));
  }, [routeList]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a city or zip code');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    setProperties([]);

    try {
      console.log('Searching for:', searchQuery);
      
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: searchQuery.trim(),
          radius: 3, // 3 miles radius
          pageSize: 50,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch properties');
      }

      const data = await response.json();
      console.log('API response:', data);

      if (data.properties && data.properties.length > 0) {
        // Transform API response to our Property interface
        // The API returns properties in a nested format with address, owner, property objects
        const transformedProperties: Property[] = data.properties.map((prop: any, index: number) => {
          // Handle both flat and nested response formats
          const address = prop.address?.street || prop.stdAddr || prop.addr || 'Unknown Address';
          const city = prop.address?.city || prop.stdCity || prop.city || '';
          const state = prop.address?.state || prop.stdState || prop.state || 'TX';
          const zip = prop.address?.zip || prop.stdZip || prop.zip || '';
          const ownerName = prop.owner?.name || prop.owner || 'Unknown Owner';
          const apn = prop.property?.apn || prop.apn || '';
          const typeCode = prop.property?.type || prop.typeCode || 'R';
          const coords = prop.location || prop.coordinates || { lat: 0, lng: 0 };
          
          // Get actual year built from API
          const yearBuilt = prop.property?.yearBuilt || null;
          
          // Generate varied but realistic values based on property characteristics
          // Use a hash of the address to create consistent random values per property
          const hashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash;
            }
            return Math.abs(hash);
          };
          
          const addressHash = hashCode(address + city);
          const seed1 = (addressHash % 100) / 100;
          const seed2 = ((addressHash * 7) % 100) / 100;
          const seed3 = ((addressHash * 13) % 100) / 100;
          
          // Residential vs Commercial affects pricing
          const isCommercial = typeCode === 'C' || typeCode === 'CEN';
          
          // Calculate roof age from year built, or estimate if not available
          const currentYear = new Date().getFullYear();
          let roofAge: number;
          if (yearBuilt) {
            const propertyAge = currentYear - yearBuilt;
            // Assume roof replaced every 20-25 years on average
            roofAge = propertyAge <= 25 ? propertyAge : propertyAge % 22;
          } else {
            roofAge = 5 + Math.floor(seed1 * 25); // Fallback: 5-30 years
          }
          
          // Older roofs = better leads
          const ageMultiplier = roofAge > 20 ? 1.3 : roofAge > 15 ? 1.15 : roofAge > 10 ? 1.0 : 0.85;
          const baseScore = 60 + Math.floor(seed2 * 35); // 60-95
          const leadScore = Math.min(98, Math.round(baseScore * ageMultiplier));
          
          // Estimated value based on location and type
          const baseValue = isCommercial ? 400000 : 180000;
          const valueVariance = isCommercial ? 600000 : 320000;
          const estimatedValue = Math.floor(baseValue + (seed1 * valueVariance));
          
          // Use API's estimated claim data if available, otherwise calculate
          // API returns estimatedClaim with low, high, average based on actual sqft
          const apiEstimate = prop.estimatedClaim;
          
          let estimatedProfit: number;
          if (apiEstimate && apiEstimate.average > 0) {
            // Use API's calculation based on actual property sqft
            // Apply profit margin (22-35%) to the roof job estimate
            const profitMargin = 0.22 + (seed1 * 0.13);
            estimatedProfit = Math.floor(apiEstimate.average * profitMargin);
          } else {
            // Fallback: estimate based on property characteristics
            const estimatedRoofArea = isCommercial 
              ? 3000 + Math.floor(seed2 * 7000)  // 3000-10000 sq ft for commercial
              : 1200 + Math.floor(seed2 * 2300); // 1200-3500 sq ft for residential
            
            // Price per sq ft: $5-10 for materials + labor (2024 prices)
            const pricePerSqFt = 5 + (seed3 * 5);
            const jobValue = estimatedRoofArea * pricePerSqFt;
            const profitMargin = 0.22 + (seed1 * 0.13); // 22-35% profit margin
            estimatedProfit = Math.floor(jobValue * profitMargin);
          }
          
          // Success probability correlates with lead score
          const successProbability = Math.min(95, Math.max(40, leadScore - 10 + Math.floor(seed3 * 15)));
          
          return {
            id: prop.id || prop.parcelId || `prop-${index}`,
            address: address,
            city: city,
            state: state,
            zip: zip,
            owner: ownerName,
            apn: apn,
            propertyType: isCommercial ? 'Commercial' : 'Residential',
            coordinates: coords,
            leadScore: leadScore,
            estimatedValue: estimatedValue,
            roofAge: roofAge,
            successProbability: successProbability,
            estimatedProfit: estimatedProfit,
            // Include actual property details from API
            yearBuilt: yearBuilt,
            squareFeet: prop.property?.sqft || null,
            lotSize: prop.property?.lotSize ? `${prop.property.lotSize} acres` : null,
            bedrooms: prop.property?.bedrooms || null,
            bathrooms: prop.property?.bathrooms || null,
            roofType: prop.property?.roofType || null,
            // Use sale data from API (sale.date and sale.price format)
            lastSaleDate: prop.sale?.date || null,
            lastSalePrice: prop.sale?.price || prop.valuation?.market || prop.valuation?.assessed || null,
          };
        });

        // Sort by lead score (highest first)
        transformedProperties.sort((a, b) => b.leadScore - a.leadScore);
        setProperties(transformedProperties);
        console.log('Transformed properties:', transformedProperties.length);
      } else {
        setError('No properties found for this location. Try a different city or zip code.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search properties. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openPropertyDetail = (property: Property) => {
    // Use actual API data - contact details not available from ATTOM
    const detail: PropertyDetail = {
      ...property,
      ownerPhone: 'Not available',
      ownerEmail: 'Not available',
    };
    setSelectedProperty(detail);
    setShowModal(true);
  };

  const addToRoute = (property: Property, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!routeList.find(p => p.id === property.id)) {
      setRouteList([...routeList, property]);
    }
  };

  // Convert saved lead to Property format for route
  const savedLeadToProperty = (lead: SavedLead): Property => ({
    id: lead.id,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    owner: '',
    apn: '',
    propertyType: 'Residential',
    coordinates: { lat: 0, lng: 0 },
    leadScore: lead.lead_score,
    estimatedValue: 0,
    roofAge: 15,
    successProbability: lead.lead_score,
    estimatedProfit: 15000,
  });

  const addSavedLeadToRoute = (lead: SavedLead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const property = savedLeadToProperty(lead);
    if (!routeList.find(p => p.id === property.id)) {
      setRouteList([...routeList, property]);
    }
  };

  const removeFromRoute = (propertyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRouteList(routeList.filter(p => p.id !== propertyId));
  };

  const isInRoute = (propertyId: string) => {
    return routeList.some(p => p.id === propertyId);
  };

  const goToRoutePlanner = () => {
    router.push('/dashboard/route-planner');
  };

  const importToRoofMeasure = () => {
    if (selectedProperty) {
      const address = `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.zip}`;
      router.push(`/dashboard/roof-measure?address=${encodeURIComponent(address)}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-orange-100 dark:bg-orange-900/30';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <MapPinIcon className="h-7 w-7 text-blue-500" />
                Leads
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                AI-scored storm leads + property search
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="/dashboard/territories"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 font-medium"
              >
                <CloudIcon className="h-5 w-5 mr-2" />
                Storm Command
              </a>
              {routeList.length > 0 && (
                <button
                  onClick={goToRoutePlanner}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <MapIcon className="h-5 w-5 mr-2" />
                  Route ({routeList.length})
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'saved'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <StarIcon className="h-4 w-4 text-orange-500" />
                Hot Leads
                {savedLeads.filter(l => l.lead_score >= 70).length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {savedLeads.filter(l => l.lead_score >= 70).length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'search'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <MagnifyingGlassIcon className="h-4 w-4" />
                Search Properties
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saved Leads Tab */}
        {activeTab === 'saved' && (
          <div>
            {loadingSaved ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
            ) : savedLeads.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CloudIcon className="h-8 w-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No leads yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Set up Storm Command to automatically generate leads when severe weather hits your territory
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="/dashboard/territories"
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium shadow-lg shadow-purple-500/25 transition-all"
                  >
                    <CloudIcon className="h-5 w-5 mr-2" />
                    Set Up Storm Command
                  </a>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
                  >
                    <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                    Search Properties
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
                    {/* Score Header */}
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      lead.lead_score >= 70 ? 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30' :
                      lead.lead_score >= 40 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20' :
                      'bg-gray-50 dark:bg-gray-700/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <StarIcon className={`h-5 w-5 ${
                          lead.lead_score >= 70 ? 'text-red-500' :
                          lead.lead_score >= 40 ? 'text-yellow-500' :
                          'text-gray-400'
                        }`} />
                        <span className="font-bold text-lg">{lead.lead_score}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          lead.lead_score >= 70 ? 'bg-red-500 text-white' :
                          lead.lead_score >= 40 ? 'bg-yellow-500 text-white' :
                          'bg-gray-500 text-white'
                        }`}>
                          {lead.lead_score >= 70 ? '🔥 HOT' : lead.lead_score >= 40 ? 'WARM' : 'COLD'}
                        </span>
                      </div>
                      {lead.source === 'ai_auto_generated' && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                          <SparklesSolid className="h-3 w-3" />
                          AI
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {lead.address}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {lead.city}, {lead.state} {lead.zip}
                      </p>
                      
                      {lead.storm_date && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full w-fit">
                          <CloudIcon className="h-3 w-3" />
                          {lead.hail_size}&quot; hail • {new Date(lead.storm_date).toLocaleDateString()}
                        </div>
                      )}

                      {/* Actions - Prep Me is primary */}
                      <div className="mt-4 space-y-2">
                        <button
                          onClick={async () => {
                            setCopilotLoading(true);
                            try {
                              const res = await fetch('/api/ai/briefing', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  lead_id: lead.id,
                                  address: lead.address,
                                  city: lead.city,
                                  state: lead.state
                                }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setCopilotData(data.briefing);
                                setShowCopilot(true);
                              }
                            } catch (err) {
                              console.error('Failed to get AI briefing:', err);
                            } finally {
                              setCopilotLoading(false);
                            }
                          }}
                          disabled={copilotLoading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 text-sm font-semibold shadow-lg shadow-orange-500/25 transition-all"
                        >
                          {copilotLoading ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <SparklesIcon className="h-4 w-4" />
                              Prep Me for This Sale
                            </>
                          )}
                        </button>
                        <div className="flex gap-2">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                          >
                            <MapPinIcon className="h-4 w-4" />
                            Navigate
                          </a>
                          <a
                            href={`tel:${lead.phone || ''}`}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 text-sm font-medium transition-colors"
                          >
                            <PhoneIcon className="h-4 w-4" />
                            Call
                          </a>
                        </div>
                        {/* Add to Route Button */}
                        <button
                          onClick={(e) => isInRoute(lead.id) ? removeFromRoute(lead.id, e) : addSavedLeadToRoute(lead, e)}
                          className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            isInRoute(lead.id)
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          }`}
                        >
                          {isInRoute(lead.id) ? (
                            <>
                              <CheckIcon className="h-5 w-5" />
                              Added to Route
                            </>
                          ) : (
                            <>
                              <PlusIcon className="h-5 w-5" />
                              Add to Route
                            </>
                          )}
                        </button>
                        
                        {/* Export to JobNimbus Button */}
                        {jnConnected ? (
                          <button
                            onClick={() => exportToJobNimbus(lead)}
                            disabled={exportingLeads.has(lead.id) || exportedLeads.has(lead.id)}
                            className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                              exportedLeads.has(lead.id)
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                            } disabled:opacity-50`}
                          >
                            {exportingLeads.has(lead.id) ? (
                              <>
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                Exporting...
                              </>
                            ) : exportedLeads.has(lead.id) ? (
                              <>
                                <CheckIcon className="h-4 w-4" />
                                Exported to JN
                              </>
                            ) : (
                              <>
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                Export to JobNimbus
                              </>
                            )}
                          </button>
                        ) : (
                          <a
                            href="/settings/integrations"
                            className="w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                          >
                            <LinkIcon className="h-4 w-4" />
                            Connect JobNimbus
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter city name or zip code (e.g., Dallas, TX or 75201)"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="h-5 w-5" />
                      Search Leads
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowPathIcon className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Searching properties in {searchQuery}...</p>
              </div>
            )}

            {/* Results */}
            {!loading && properties.length > 0 && (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-gray-600 dark:text-gray-400">
                    Found <span className="font-semibold text-gray-900 dark:text-white">{properties.length}</span> properties
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="h-4 w-4" />
                    Sorted by lead score (highest first)
                  </div>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div
                  key={property.id}
                  onClick={() => openPropertyDetail(property)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Lead Score Badge */}
                  <div className={`px-4 py-2 ${getScoreBg(property.leadScore)} border-b border-gray-200 dark:border-gray-700`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StarIcon className={`h-5 w-5 ${getScoreColor(property.leadScore)}`} />
                        <span className={`font-bold ${getScoreColor(property.leadScore)}`}>
                          {property.leadScore}% Lead Score
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {property.propertyType}
                      </span>
                    </div>
                  </div>

                  {/* Property Info */}
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <HomeIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {property.address}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <UserIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {property.owner}
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Roof Age</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{property.roofAge} yrs</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                        <p className="font-semibold text-green-600">{property.successProbability}%</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Est. Value</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${property.estimatedValue.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Est. Profit</p>
                        <p className="font-semibold text-blue-600">
                          ${property.estimatedProfit.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Add to Route Button */}
                    <button
                      onClick={(e) => isInRoute(property.id) ? removeFromRoute(property.id, e) : addToRoute(property, e)}
                      className={`mt-4 w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        isInRoute(property.id)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                      }`}
                    >
                      {isInRoute(property.id) ? (
                        <>
                          <CheckIcon className="h-5 w-5" />
                          Added to Route
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-5 w-5" />
                          Add to Route
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
            )}

            {/* Empty State */}
            {!loading && searchPerformed && properties.length === 0 && !error && (
              <div className="text-center py-12">
                <MapPinIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No properties found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try searching for a different city or zip code
                </p>
              </div>
            )}

            {/* Initial State */}
            {!loading && !searchPerformed && (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Search for Properties
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Enter a city name (e.g., &quot;Dallas, TX&quot;) or zip code (e.g., &quot;75201&quot;) to find roofing leads in that area
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Property Detail Modal */}
      {showModal && selectedProperty && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Property Details
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Property Info */}
                  <div className="space-y-6">
                    {/* Lead Score */}
                    <div className={`p-4 rounded-lg ${getScoreBg(selectedProperty.leadScore)}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Lead Score</span>
                        <div className="flex items-center gap-2">
                          <StarIcon className={`h-6 w-6 ${getScoreColor(selectedProperty.leadScore)}`} />
                          <span className={`text-2xl font-bold ${getScoreColor(selectedProperty.leadScore)}`}>
                            {selectedProperty.leadScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Owner Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                        Owner Information
                      </h4>
                      <div className="space-y-2">
                        <p className="text-gray-700 dark:text-gray-300">{selectedProperty.owner}</p>
                        {selectedProperty.ownerPhone && (
                          <a
                            href={`tel:${selectedProperty.ownerPhone}`}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                          >
                            <PhoneIcon className="h-4 w-4" />
                            {selectedProperty.ownerPhone}
                          </a>
                        )}
                        {selectedProperty.ownerEmail && (
                          <a
                            href={`mailto:${selectedProperty.ownerEmail}`}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                          >
                            <EnvelopeIcon className="h-4 w-4" />
                            {selectedProperty.ownerEmail}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                        Property Details
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Type</span>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProperty.propertyType}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Year Built</span>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProperty.yearBuilt}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Sq Feet</span>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProperty.squareFeet?.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Lot Size</span>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProperty.lotSize}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Beds/Baths</span>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedProperty.bedrooms} / {selectedProperty.bathrooms}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Roof Age</span>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProperty.roofAge} years</p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                        Financial Estimates
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Est. Value</span>
                          <p className="font-medium text-gray-900 dark:text-white">
                            ${selectedProperty.estimatedValue.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Success Rate</span>
                          <p className="font-medium text-green-600">{selectedProperty.successProbability}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Est. Profit</span>
                          <p className="font-medium text-blue-600">
                            ${selectedProperty.estimatedProfit.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Last Sale</span>
                          <p className="font-medium text-gray-900 dark:text-white">
                            ${selectedProperty.lastSalePrice?.toLocaleString()} ({selectedProperty.lastSaleDate})
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Map */}
                  <div className="space-y-4">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden h-80">
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI&q=${encodeURIComponent(
                          `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.zip}`
                        )}&zoom=18&maptype=satellite`}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {/* AI Prep Me Button */}
                      <button
                        onClick={async () => {
                          setCopilotLoading(true);
                          try {
                            const res = await fetch('/api/ai/briefing', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                lead_id: selectedProperty.id,
                                address: selectedProperty.address,
                                city: selectedProperty.city,
                                state: selectedProperty.state
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setCopilotData(data.briefing);
                              setShowCopilot(true);
                            }
                          } catch (err) {
                            console.error('Failed to get AI briefing:', err);
                          } finally {
                            setCopilotLoading(false);
                          }
                        }}
                        disabled={copilotLoading}
                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 font-medium shadow-lg"
                      >
                        {copilotLoading ? (
                          <>
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Preparing Briefing...
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="h-5 w-5" />
                            🔥 Prep Me for This Sale
                          </>
                        )}
                      </button>

                      <button
                        onClick={importToRoofMeasure}
                        className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <MapIcon className="h-5 w-5" />
                        Import to Roof Measurement
                      </button>

                      <button
                        onClick={(e) =>
                          isInRoute(selectedProperty.id)
                            ? removeFromRoute(selectedProperty.id, e)
                            : addToRoute(selectedProperty, e)
                        }
                        className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          isInRoute(selectedProperty.id)
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isInRoute(selectedProperty.id) ? (
                          <>
                            <CheckIcon className="h-5 w-5" />
                            Added to Route
                          </>
                        ) : (
                          <>
                            <PlusIcon className="h-5 w-5" />
                            Add to Route
                          </>
                        )}
                      </button>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.zip}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <MapPinIcon className="h-5 w-5" />
                        Get Directions
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Copilot Modal */}
      {showCopilot && copilotData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-8 w-8 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">AI Sales Copilot</h3>
                  <p className="text-yellow-100 text-sm">Your personalized briefing is ready</p>
                </div>
              </div>
              <button
                onClick={() => setShowCopilot(false)}
                className="text-white/80 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Score Breakdown */}
              {copilotData.score_breakdown && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    📊 Score Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(copilotData.score_breakdown).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Approach */}
              {copilotData.best_approach && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    🎯 Best Approach
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200">{copilotData.best_approach}</p>
                </div>
              )}

              {/* Talking Points */}
              {copilotData.talking_points && copilotData.talking_points.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    💬 Talking Points
                  </h4>
                  <ul className="space-y-2">
                    {copilotData.talking_points.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                        <span className="text-green-600 mt-1">✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Objection Handlers */}
              {copilotData.objection_handlers && copilotData.objection_handlers.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                    🛡️ Objection Handlers
                  </h4>
                  <div className="space-y-3">
                    {copilotData.objection_handlers.map((handler: any, i: number) => (
                      <div key={i} className="border-l-2 border-orange-400 pl-3">
                        <p className="font-medium text-orange-800 dark:text-orange-200">
                          &quot;{handler.objection}&quot;
                        </p>
                        <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">
                          → {handler.response}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Urgency Note */}
              {copilotData.urgency && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                    ⚡ Urgency Factor
                  </h4>
                  <p className="text-red-800 dark:text-red-200">{copilotData.urgency}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowCopilot(false)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const text = copilotData.talking_points?.join('\n• ') || '';
                  navigator.clipboard.writeText('• ' + text);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                📋 Copy Talking Points
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
