'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Users, 
  Navigation, 
  Battery, 
  Clock, 
  Activity,
  RefreshCw,
  Target,
  Phone,
  ChevronRight,
  Zap,
  Circle
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  battery_level: number;
  is_active: boolean;
  last_activity: string;
  updated_at: string;
  // Today's stats
  doors_knocked: number;
  appointments_set: number;
  contacts_made: number;
}

interface WeatherInfo {
  temperature: number;
  conditions: string;
  icon: string;
  precipitation_chance: number;
}

export default function LiveFieldMapPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number; lng: number} | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const mapRef = useRef<HTMLDivElement>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fetch team locations
  const fetchTeamLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/team/locations');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching team locations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Start tracking my location
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy, heading, speed } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });

        // Send location to server
        try {
          await fetch('/api/team/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy,
              heading: heading || 0,
              speed: speed || 0,
              battery_level: await getBatteryLevel(),
            }),
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, []);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);

    // Update server that tracking stopped
    fetch('/api/team/locations', {
      method: 'DELETE',
    }).catch(console.error);
  }, []);

  // Get battery level (if supported)
  const getBatteryLevel = async (): Promise<number | null> => {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
    } catch {
      // Battery API not supported
    }
    return null;
  };

  // Poll for team locations every 10 seconds
  useEffect(() => {
    fetchTeamLocations();
    const interval = setInterval(fetchTeamLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchTeamLocations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const getActivityColor = (activity: string) => {
    switch (activity) {
      case 'knocking':
        return 'text-green-400 bg-green-500/20';
      case 'driving':
        return 'text-blue-400 bg-blue-500/20';
      case 'idle':
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getTimeSince = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-storm-z0 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MapPin className="h-6 w-6 text-blue-400" />
            </div>
            Live Field Map
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time GPS tracking of your field team
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Last Update */}
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Updated {getTimeSince(lastUpdate.toISOString())}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTeamLocations}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-5 w-5 text-gray-400" />
          </button>

          {/* Tracking Toggle */}
          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isTracking
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {isTracking ? (
              <>
                <Circle className="h-4 w-4 fill-red-400 animate-pulse" />
                Stop Tracking
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                Start Tracking
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Team List - Left Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Active Count */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {teamMembers.filter(m => m.is_active).length}
                </p>
                <p className="text-sm text-gray-400">Active in Field</p>
              </div>
            </div>
          </div>

          {/* Team Members List */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold text-white">Team Members</h3>
            </div>
            <div className="divide-y divide-gray-700/50 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto" />
                  <p className="text-gray-400 mt-2">Loading team...</p>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-8 w-8 text-gray-500 mx-auto" />
                  <p className="text-gray-400 mt-2">No team members tracking</p>
                  <p className="text-gray-500 text-sm">Start tracking to appear on the map</p>
                </div>
              ) : (
                teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`w-full p-4 text-left hover:bg-gray-700/30 transition-colors ${
                      selectedMember?.id === member.id ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with status */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${
                          member.is_active ? 'bg-green-400' : 'bg-gray-500'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {member.name || member.email?.split('@')[0]}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActivityColor(member.last_activity)}`}>
                            {member.last_activity || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getTimeSince(member.updated_at)}
                          </span>
                        </div>
                        {/* Today's Stats */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {member.doors_knocked || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {member.contacts_made || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {member.appointments_set || 0}
                          </span>
                        </div>
                      </div>

                      {/* Battery */}
                      {member.battery_level && (
                        <div className={`flex items-center gap-1 ${getBatteryColor(member.battery_level)}`}>
                          <Battery className="h-4 w-4" />
                          <span className="text-xs">{member.battery_level}%</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Map Area - Main Content */}
        <div className="lg:col-span-3">
          <div 
            ref={mapRef}
            className="bg-gray-800/50 rounded-xl border border-gray-700/50 h-[600px] relative overflow-hidden"
          >
            {/* Map Placeholder - In production, integrate with Mapbox/Google Maps */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800">
              {/* Grid overlay for visual effect */}
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'linear-gradient(#6D5CFF 1px, transparent 1px), linear-gradient(90deg, #6D5CFF 1px, transparent 1px)',
                  backgroundSize: '50px 50px'
                }}
              />

              {/* Map Markers */}
              <div className="absolute inset-0 p-8">
                {teamMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                    style={{
                      // Spread markers across the map area
                      left: `${20 + (index * 15) % 60}%`,
                      top: `${20 + (index * 20) % 60}%`,
                    }}
                    onClick={() => setSelectedMember(member)}
                  >
                    {/* Pulse animation for active */}
                    {member.is_active && (
                      <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
                    )}
                    
                    {/* Marker */}
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                      member.is_active 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                      {member.name?.charAt(0) || '?'}
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        <p className="font-medium">{member.name || member.email}</p>
                        <p className="text-xs text-gray-400">{member.last_activity || 'Idle'}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* My Location Marker */}
                {myLocation && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: '50%', top: '50%' }}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                      <div className="relative w-6 h-6 rounded-full bg-blue-500 border-4 border-white shadow-lg" />
                    </div>
                  </div>
                )}
              </div>

              {/* Map Integration Notice */}
              <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur px-4 py-2 rounded-lg">
                <p className="text-sm text-gray-400">
                  🗺️ Map powered by GPS coordinates • {teamMembers.length} team members
                </p>
              </div>

              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button className="p-2 bg-gray-900/90 hover:bg-gray-800 rounded-lg text-white transition-colors">
                  +
                </button>
                <button className="p-2 bg-gray-900/90 hover:bg-gray-800 rounded-lg text-white transition-colors">
                  −
                </button>
              </div>
            </div>
          </div>

          {/* Selected Member Details */}
          {selectedMember && (
            <div className="mt-4 bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {selectedMember.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {selectedMember.name || selectedMember.email}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Last seen: {getTimeSince(selectedMember.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Today's Performance */}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{selectedMember.doors_knocked || 0}</p>
                    <p className="text-xs text-gray-400">Doors</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{selectedMember.contacts_made || 0}</p>
                    <p className="text-xs text-gray-400">Contacts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">{selectedMember.appointments_set || 0}</p>
                    <p className="text-xs text-gray-400">Appts</p>
                  </div>

                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-400" />
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
