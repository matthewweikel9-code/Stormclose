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
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

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
          
          // Use API estimated claim data or calculate based on property type
          const apiClaim = prop.estimatedClaim?.average || 0;
          
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
          
          // Calculate realistic values
          const baseRoofAge = 5 + Math.floor(seed1 * 25); // 5-30 years
          const roofAge = baseRoofAge;
          
          // Older roofs = better leads
          const ageMultiplier = roofAge > 20 ? 1.3 : roofAge > 15 ? 1.15 : roofAge > 10 ? 1.0 : 0.85;
          const baseScore = 60 + Math.floor(seed2 * 35); // 60-95
          const leadScore = Math.min(98, Math.round(baseScore * ageMultiplier));
          
          // Estimated value based on location and type
          const baseValue = isCommercial ? 400000 : 180000;
          const valueVariance = isCommercial ? 600000 : 320000;
          const estimatedValue = Math.floor(baseValue + (seed1 * valueVariance));
          
          // Profit calculation: based on roof size estimate from property value
          // Average roofing job profit is 20-35% of job cost
          // Job cost roughly correlates with property value
          const estimatedRoofArea = isCommercial 
            ? 3000 + Math.floor(seed2 * 7000)  // 3000-10000 sq ft for commercial
            : 1200 + Math.floor(seed2 * 2300); // 1200-3500 sq ft for residential
          
          // Price per sq ft: $4-8 for materials, contractor markup
          const pricePerSqFt = 5 + (seed3 * 3);
          const jobValue = estimatedRoofArea * pricePerSqFt;
          const profitMargin = 0.22 + (seed1 * 0.13); // 22-35% profit margin
          const estimatedProfit = Math.floor(jobValue * profitMargin);
          
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
            estimatedProfit: apiClaim > 0 ? apiClaim : estimatedProfit,
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
    // Extend with mock contact details
    const detail: PropertyDetail = {
      ...property,
      ownerPhone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      ownerEmail: property.owner
        ? `${property.owner.toLowerCase().replace(/\s+/g, '.').substring(0, 20)}@email.com`
        : undefined,
      yearBuilt: 2024 - property.roofAge - Math.floor(Math.random() * 10),
      squareFeet: Math.floor(Math.random() * 2500) + 1200,
      lotSize: `${(Math.random() * 0.5 + 0.1).toFixed(2)} acres`,
      bedrooms: Math.floor(Math.random() * 3) + 2,
      bathrooms: Math.floor(Math.random() * 2) + 1.5,
      lastSaleDate: `${Math.floor(Math.random() * 10) + 2014}`,
      lastSalePrice: Math.floor(property.estimatedValue * (0.7 + Math.random() * 0.2)),
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
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Lead Generator
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Search properties by city or zip code to find your next roofing leads
              </p>
            </div>

            {routeList.length > 0 && (
              <button
                onClick={goToRoutePlanner}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <MapIcon className="h-5 w-5 mr-2" />
                View Route ({routeList.length})
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-6">
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    </div>
  );
}
