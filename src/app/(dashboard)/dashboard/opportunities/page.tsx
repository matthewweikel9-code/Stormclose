'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Home,
  Cloud,
  MapPin,
  Star,
  ChevronRight,
  AlertTriangle,
  Target,
  Zap,
  Crown,
  Flame,
  Eye,
  Navigation,
  Calendar,
  Clock,
  ThermometerSun,
  Droplets,
  Wind,
  Filter,
  RefreshCw,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// TYPES
// =============================================================================

interface StormOpportunity {
  id: string;
  name: string;
  date: string;
  location: string;
  coordinates: { lat: number; lng: number };
  severity: 'major' | 'moderate' | 'minor';
  hailSize: number;
  windSpeed: number;
  affectedProperties: number;
  estimatedDamage: number;
  daysAgo: number;
  opportunityScore: number;
}

interface TopProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  damageScore: number;
  opportunityValue: number;
  roofAge: number;
  roofSquares: number;
  lastStorm: string;
  owner: string;
  tags: string[];
  priority: 'hot' | 'warm' | 'cold';
}

interface HotNeighborhood {
  id: string;
  name: string;
  city: string;
  totalHomes: number;
  affectedHomes: number;
  averageDamage: number;
  averageRoofAge: number;
  opportunityValue: number;
  saturation: number; // % of homes already contacted
  competitorActivity: 'low' | 'medium' | 'high';
}

interface RoofOpportunity {
  id: string;
  address: string;
  roofSquares: number;
  estimatedValue: number;
  roofAge: number;
  roofType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  urgency: 'immediate' | 'soon' | 'planned';
}

interface DashboardStats {
  totalOpportunityValue: number;
  activeStorms: number;
  hotLeads: number;
  scheduledKnocks: number;
  weeklyChange: number;
}

interface WeatherForecast {
  date: string;
  condition: string;
  high: number;
  low: number;
  stormChance: number;
  icon: 'sun' | 'cloud' | 'rain' | 'storm';
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_STATS: DashboardStats = {
  totalOpportunityValue: 4250000,
  activeStorms: 3,
  hotLeads: 47,
  scheduledKnocks: 156,
  weeklyChange: 12.5,
};

const MOCK_STORMS: StormOpportunity[] = [
  {
    id: '1',
    name: 'North Dallas Hail Storm',
    date: '2024-05-18',
    location: 'Plano, TX',
    coordinates: { lat: 33.0198, lng: -96.6989 },
    severity: 'major',
    hailSize: 2.75,
    windSpeed: 72,
    affectedProperties: 2847,
    estimatedDamage: 42000000,
    daysAgo: 2,
    opportunityScore: 98,
  },
  {
    id: '2',
    name: 'Fort Worth Supercell',
    date: '2024-05-15',
    location: 'Fort Worth, TX',
    coordinates: { lat: 32.7555, lng: -97.3308 },
    severity: 'major',
    hailSize: 2.25,
    windSpeed: 65,
    affectedProperties: 1924,
    estimatedDamage: 28000000,
    daysAgo: 5,
    opportunityScore: 94,
  },
  {
    id: '3',
    name: 'McKinney Wind Event',
    date: '2024-05-12',
    location: 'McKinney, TX',
    coordinates: { lat: 33.1972, lng: -96.6397 },
    severity: 'moderate',
    hailSize: 1.5,
    windSpeed: 58,
    affectedProperties: 892,
    estimatedDamage: 12000000,
    daysAgo: 8,
    opportunityScore: 82,
  },
  {
    id: '4',
    name: 'Arlington Hail',
    date: '2024-05-08',
    location: 'Arlington, TX',
    coordinates: { lat: 32.7357, lng: -97.1081 },
    severity: 'minor',
    hailSize: 1.0,
    windSpeed: 45,
    affectedProperties: 456,
    estimatedDamage: 5500000,
    daysAgo: 12,
    opportunityScore: 68,
  },
];

const MOCK_TOP_PROPERTIES: TopProperty[] = [
  {
    id: '1',
    address: '4521 Stonegate Dr',
    city: 'Plano',
    state: 'TX',
    damageScore: 94,
    opportunityValue: 42500,
    roofAge: 18,
    roofSquares: 38,
    lastStorm: '2024-05-18',
    owner: 'Robert Johnson',
    tags: ['Golf ball hail', 'Old roof', 'Insurance approved'],
    priority: 'hot',
  },
  {
    id: '2',
    address: '8734 Willow Creek Blvd',
    city: 'Plano',
    state: 'TX',
    damageScore: 91,
    opportunityValue: 38000,
    roofAge: 15,
    roofSquares: 34,
    lastStorm: '2024-05-18',
    owner: 'Sarah Martinez',
    tags: ['2.5" hail', 'Claim filed'],
    priority: 'hot',
  },
  {
    id: '3',
    address: '2156 Oak Hollow Ln',
    city: 'Fort Worth',
    state: 'TX',
    damageScore: 88,
    opportunityValue: 35500,
    roofAge: 22,
    roofSquares: 32,
    lastStorm: '2024-05-15',
    owner: 'Michael Chen',
    tags: ['Visible damage', 'Urgent'],
    priority: 'hot',
  },
  {
    id: '4',
    address: '9823 Magnolia Way',
    city: 'McKinney',
    state: 'TX',
    damageScore: 82,
    opportunityValue: 28000,
    roofAge: 12,
    roofSquares: 26,
    lastStorm: '2024-05-12',
    owner: 'Jennifer Davis',
    tags: ['Wind damage', 'Responsive'],
    priority: 'warm',
  },
  {
    id: '5',
    address: '5467 Cedar Ridge Ct',
    city: 'Arlington',
    state: 'TX',
    damageScore: 78,
    opportunityValue: 24500,
    roofAge: 10,
    roofSquares: 24,
    lastStorm: '2024-05-08',
    owner: 'David Wilson',
    tags: ['Minor damage', 'Follow-up needed'],
    priority: 'warm',
  },
];

const MOCK_NEIGHBORHOODS: HotNeighborhood[] = [
  {
    id: '1',
    name: 'Stonebriar Heights',
    city: 'Plano',
    totalHomes: 847,
    affectedHomes: 623,
    averageDamage: 8500,
    averageRoofAge: 14,
    opportunityValue: 5295500,
    saturation: 8,
    competitorActivity: 'low',
  },
  {
    id: '2',
    name: 'Ridgewood Estates',
    city: 'Fort Worth',
    totalHomes: 562,
    affectedHomes: 412,
    averageDamage: 7200,
    averageRoofAge: 16,
    opportunityValue: 2966400,
    saturation: 15,
    competitorActivity: 'medium',
  },
  {
    id: '3',
    name: 'Meadow Creek',
    city: 'McKinney',
    totalHomes: 398,
    affectedHomes: 287,
    averageDamage: 5800,
    averageRoofAge: 11,
    opportunityValue: 1664600,
    saturation: 22,
    competitorActivity: 'low',
  },
  {
    id: '4',
    name: 'Lakewood Hills',
    city: 'Arlington',
    totalHomes: 523,
    affectedHomes: 189,
    averageDamage: 4200,
    averageRoofAge: 9,
    opportunityValue: 793800,
    saturation: 35,
    competitorActivity: 'high',
  },
];

const MOCK_LARGE_ROOFS: RoofOpportunity[] = [
  {
    id: '1',
    address: '12500 Preston Rd - Commercial Plaza',
    roofSquares: 185,
    estimatedValue: 245000,
    roofAge: 20,
    roofType: 'TPO Membrane',
    complexity: 'moderate',
    urgency: 'immediate',
  },
  {
    id: '2',
    address: '8700 Coit Rd - Church',
    roofSquares: 124,
    estimatedValue: 165000,
    roofAge: 18,
    roofType: 'Built-Up',
    complexity: 'complex',
    urgency: 'soon',
  },
  {
    id: '3',
    address: '5200 Legacy Dr - Office Building',
    roofSquares: 98,
    estimatedValue: 128000,
    roofAge: 15,
    roofType: 'EPDM',
    complexity: 'simple',
    urgency: 'immediate',
  },
  {
    id: '4',
    address: '3100 Main St - Restaurant',
    roofSquares: 45,
    estimatedValue: 58000,
    roofAge: 22,
    roofType: 'Modified Bitumen',
    complexity: 'moderate',
    urgency: 'planned',
  },
];

const MOCK_FORECAST: WeatherForecast[] = [
  { date: 'Today', condition: 'Partly Cloudy', high: 85, low: 68, stormChance: 10, icon: 'sun' },
  { date: 'Tue', condition: 'Sunny', high: 88, low: 70, stormChance: 5, icon: 'sun' },
  { date: 'Wed', condition: 'Thunderstorms', high: 82, low: 65, stormChance: 75, icon: 'storm' },
  { date: 'Thu', condition: 'Scattered Storms', high: 79, low: 63, stormChance: 60, icon: 'rain' },
  { date: 'Fri', condition: 'Partly Cloudy', high: 84, low: 66, stormChance: 20, icon: 'cloud' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
};

const getWeatherIcon = (icon: WeatherForecast['icon']) => {
  switch (icon) {
    case 'sun':
      return <ThermometerSun className="w-6 h-6 text-yellow-400" />;
    case 'cloud':
      return <Cloud className="w-6 h-6 text-gray-400" />;
    case 'rain':
      return <Droplets className="w-6 h-6 text-blue-400" />;
    case 'storm':
      return <Zap className="w-6 h-6 text-yellow-500" />;
  }
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OpportunityDashboard() {
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [storms, setStorms] = useState<StormOpportunity[]>(MOCK_STORMS);
  const [topProperties, setTopProperties] = useState<TopProperty[]>(MOCK_TOP_PROPERTIES);
  const [neighborhoods, setNeighborhoods] = useState<HotNeighborhood[]>(MOCK_NEIGHBORHOODS);
  const [largeRoofs, setLargeRoofs] = useState<RoofOpportunity[]>(MOCK_LARGE_ROOFS);
  const [forecast, setForecast] = useState<WeatherForecast[]>(MOCK_FORECAST);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('7d');

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-400" />
            Opportunity Dashboard
          </h1>
          <p className="text-gray-400">
            Your money map - best storm areas, top properties, and biggest opportunities
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe Selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-8 h-8 text-green-200" />
            <div className="flex items-center gap-1 text-green-200 text-sm">
              <ArrowUp className="w-4 h-4" />
              {stats.weeklyChange}%
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalOpportunityValue)}</div>
          <div className="text-green-200 text-sm">Total Opportunity Value</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Cloud className="w-8 h-8 text-purple-200" />
            <Sparkles className="w-5 h-5 text-yellow-300" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.activeStorms}</div>
          <div className="text-purple-200 text-sm">Active Storm Zones</div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Flame className="w-8 h-8 text-red-200" />
            <span className="px-2 py-0.5 bg-red-500/30 text-red-200 text-xs rounded-full">
              HOT
            </span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.hotLeads}</div>
          <div className="text-red-200 text-sm">Hot Leads Ready</div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Calendar className="w-8 h-8 text-blue-200" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.scheduledKnocks}</div>
          <div className="text-blue-200 text-sm">Scheduled Knocks</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Best Storm Areas - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Storm Opportunities */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Cloud className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Best Storm Areas</h2>
                  <p className="text-sm text-gray-400">Recent storms with highest opportunity</p>
                </div>
              </div>
              <Link 
                href="/dashboard/storm-map"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                View Map <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            <div className="p-6 space-y-4">
              {storms.map((storm, idx) => (
                <div
                  key={storm.id}
                  className={`p-4 rounded-xl border transition-all hover:border-purple-500/50 cursor-pointer ${
                    idx === 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {idx === 0 && <Crown className="w-5 h-5 text-yellow-400" />}
                      <div>
                        <div className="font-semibold text-white">{storm.name}</div>
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {storm.location} • {storm.daysAgo}d ago
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{storm.opportunityScore}</div>
                      <div className="text-xs text-gray-400">Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                      <div className="text-lg font-bold text-cyan-400">{storm.hailSize}"</div>
                      <div className="text-xs text-gray-500">Hail</div>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                      <div className="text-lg font-bold text-yellow-400">{storm.windSpeed}</div>
                      <div className="text-xs text-gray-500">MPH</div>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                      <div className="text-lg font-bold text-green-400">{storm.affectedProperties.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Properties</div>
                    </div>
                    <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                      <div className="text-lg font-bold text-white">{formatCurrency(storm.estimatedDamage)}</div>
                      <div className="text-xs text-gray-500">Damage</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Houses to Knock */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Flame className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Top Houses to Knock</h2>
                  <p className="text-sm text-gray-400">Highest probability of sale</p>
                </div>
              </div>
              <Link 
                href="/dashboard/knock-list"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Full List <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            <div className="divide-y divide-gray-800">
              {topProperties.map((property, idx) => (
                <div
                  key={property.id}
                  className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      idx === 0 ? 'bg-yellow-500 text-yellow-900' :
                      idx === 1 ? 'bg-gray-300 text-gray-700' :
                      idx === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Property Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{property.address}</span>
                        {property.priority === 'hot' && (
                          <Flame className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {property.city}, {property.state} • Owner: {property.owner}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {property.tags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Value & Score */}
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-400">
                        ${property.opportunityValue.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        Score: {property.damageScore}
                      </div>
                      <div className="text-xs text-gray-500">
                        {property.roofAge}yr roof • {property.roofSquares} sq
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Weather Alert */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-yellow-400">Storm Watch</span>
            </div>
            <p className="text-white text-sm mb-4">
              <strong>Severe weather expected Wednesday.</strong> 2-3" hail possible in Collin County. 
              Prepare your route for Thursday morning!
            </p>
            <div className="flex gap-2">
              {forecast.map((day, idx) => (
                <div
                  key={idx}
                  className={`flex-1 text-center p-2 rounded-lg ${
                    day.stormChance > 50 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-gray-800/50'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">{day.date}</div>
                  {getWeatherIcon(day.icon)}
                  {day.stormChance > 30 && (
                    <div className="text-xs text-yellow-400 mt-1">{day.stormChance}%</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Best Neighborhoods */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Best Neighborhoods</h3>
              </div>
              <Link 
                href="/dashboard/knock-list"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View All
              </Link>
            </div>

            <div className="divide-y divide-gray-800">
              {neighborhoods.slice(0, 4).map((hood, idx) => (
                <div key={hood.id} className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Star className="w-4 h-4 text-yellow-400" />}
                      <span className="font-medium text-white">{hood.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      hood.competitorActivity === 'low' ? 'bg-green-500/20 text-green-400' :
                      hood.competitorActivity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {hood.competitorActivity} comp
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {hood.city} • {hood.affectedHomes}/{hood.totalHomes} homes affected
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-green-400">
                      {formatCurrency(hood.opportunityValue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {hood.saturation}% saturated
                    </div>
                  </div>
                  {/* Saturation bar */}
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        hood.saturation < 20 ? 'bg-green-500' :
                        hood.saturation < 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${hood.saturation}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Largest Roof Opportunities */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Largest Roofs</h3>
              </div>
              <Link 
                href="/dashboard/roof-measurement"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Measure
              </Link>
            </div>

            <div className="divide-y divide-gray-800">
              {largeRoofs.map((roof) => (
                <div key={roof.id} className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm truncate pr-2">
                      {roof.address}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded whitespace-nowrap ${
                      roof.urgency === 'immediate' ? 'bg-red-500/20 text-red-400' :
                      roof.urgency === 'soon' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {roof.urgency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      {roof.roofSquares} sq • {roof.roofType}
                    </div>
                    <div className="font-bold text-green-400">
                      {formatCurrency(roof.estimatedValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/smart-route"
                className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Navigation className="w-5 h-5 text-blue-400" />
                <span className="text-white">Plan Today's Route</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
              <Link
                href="/dashboard/estimate-generator"
                className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-white">Create Estimate</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
              <Link
                href="/dashboard/reports"
                className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Eye className="w-5 h-5 text-purple-400" />
                <span className="text-white">Generate Report</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
