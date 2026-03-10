'use client';

import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
  MapPinIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MicrophoneIcon,
  StopIcon,
  CheckCircleIcon,
  FireIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';

interface ScoreBreakdown {
  score: number;
  reason: string;
}

interface ObjectionHandler {
  objection: string;
  response: string;
}

interface Briefing {
  summary: string;
  talking_points: string[];
  objection_handlers: ObjectionHandler[];
  neighborhood_context: string;
  score_breakdown: {
    storm_proximity: ScoreBreakdown;
    roof_age: ScoreBreakdown;
    property_value: ScoreBreakdown;
    hail_history: ScoreBreakdown;
  };
  urgency_level: 'high' | 'medium' | 'low';
  best_approach: string;
  generated_at?: string;
}

interface AICopilotProps {
  leadId: string;
  leadScore: number;
  address: string;
  onClose?: () => void;
}

export default function AICopilot({ leadId, leadScore, address, onClose }: AICopilotProps) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('talking_points');
  const [isRecording, setIsRecording] = useState(false);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (leadId) {
      fetchBriefing();
    }
  }, [leadId]);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai/briefing?leadId=${leadId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch briefing');
      }
      const data = await res.json();
      setBriefing(data.briefing);
      setCached(data.cached);
    } catch (err) {
      setError('Failed to load AI briefing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-green-400 bg-green-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 20) return 'bg-green-500';
    if (score >= 15) return 'bg-yellow-500';
    if (score >= 10) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <SparklesSolid className="w-6 h-6 text-purple-400 animate-pulse" />
          <h3 className="text-lg font-semibold">AI Sales Copilot</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Generating property briefing...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-red-500/30">
        <div className="text-center">
          <ShieldExclamationIcon className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchBriefing}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2 mx-auto"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-gray-800 rounded-xl border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesSolid className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="font-semibold">AI Sales Copilot</h3>
              <p className="text-xs text-gray-400">{address}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cached && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                Cached
              </span>
            )}
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(briefing.urgency_level)}`}
            >
              {briefing.urgency_level.toUpperCase()} PRIORITY
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <p className="text-lg font-medium text-white">
          "{briefing.summary}"
        </p>
      </div>

      {/* Best Approach */}
      <div className="p-4 border-b border-gray-700 bg-blue-900/20">
        <div className="flex items-start gap-3">
          <FireIcon className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Recommended Approach</p>
            <p className="text-sm text-gray-200">{briefing.best_approach}</p>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="divide-y divide-gray-700">
        {/* Talking Points */}
        <div>
          <button
            onClick={() => toggleSection('talking_points')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LightBulbIcon className="w-5 h-5 text-yellow-400" />
              <span className="font-medium">Talking Points</span>
              <span className="text-xs text-gray-500">{briefing.talking_points.length} points</span>
            </div>
            {expandedSection === 'talking_points' ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'talking_points' && (
            <div className="px-4 pb-4 space-y-2">
              {briefing.talking_points.map((point, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{point}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Objection Handlers */}
        <div>
          <button
            onClick={() => toggleSection('objections')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
              <span className="font-medium">Objection Handlers</span>
              <span className="text-xs text-gray-500">{briefing.objection_handlers.length} responses</span>
            </div>
            {expandedSection === 'objections' ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'objections' && (
            <div className="px-4 pb-4 space-y-3">
              {briefing.objection_handlers.map((handler, i) => (
                <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm text-red-400 font-medium mb-1">
                    "{handler.objection}"
                  </p>
                  <p className="text-sm text-gray-300">
                    → {handler.response}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Neighborhood Context */}
        <div>
          <button
            onClick={() => toggleSection('neighborhood')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MapPinIcon className="w-5 h-5 text-blue-400" />
              <span className="font-medium">Neighborhood Intel</span>
            </div>
            {expandedSection === 'neighborhood' ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'neighborhood' && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-300">{briefing.neighborhood_context}</p>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <div>
          <button
            onClick={() => toggleSection('score')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ChartBarIcon className="w-5 h-5 text-purple-400" />
              <span className="font-medium">Score Breakdown</span>
              <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
                {leadScore}/100
              </span>
            </div>
            {expandedSection === 'score' ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedSection === 'score' && (
            <div className="px-4 pb-4 space-y-3">
              {Object.entries(briefing.score_breakdown).map(([key, data]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-400 capitalize">
                    {key.replace('_', ' ')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getScoreColor(data.score)}`}
                          style={{ width: `${(data.score / 25) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8">{data.score}/25</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{data.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Voice Note Button */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          {isRecording ? (
            <>
              <StopIcon className="w-5 h-5" />
              Stop Recording
            </>
          ) : (
            <>
              <MicrophoneIcon className="w-5 h-5" />
              Record Voice Note
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Voice notes are transcribed and added to lead activity
        </p>
      </div>

      {/* Refresh Button */}
      <div className="px-4 pb-4">
        <button
          onClick={fetchBriefing}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh Briefing
        </button>
      </div>
    </div>
  );
}
