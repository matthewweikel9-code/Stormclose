'use client';

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Brain,
  Send,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Cloud,
  Building2,
  Shield,
  FileText,
  Crosshair,
  User,
  Bot,
  Trash2,
  Home,
  Wind,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ElementType;
  color: string;
  needsInput?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Storm report',
    prompt: 'What storms have hit my area in the last 24 hours? Give me a summary with hail sizes and locations.',
    icon: Cloud,
    color: 'text-blue-400 bg-blue-500/15',
  },
  {
    label: 'Property lookup',
    prompt: 'Look up the property at ',
    icon: Home,
    color: 'text-emerald-400 bg-emerald-500/15',
    needsInput: true,
  },
  {
    label: 'Weather forecast',
    prompt: 'What does the weather look like for my territory this week? Any severe weather expected?',
    icon: Wind,
    color: 'text-amber-400 bg-amber-500/15',
  },
  {
    label: 'Objection help',
    prompt: 'A homeowner just told me "I already have a roofer." How should I respond?',
    icon: Shield,
    color: 'text-purple-400 bg-purple-500/15',
  },
  {
    label: 'Roof analysis',
    prompt: 'Analyze the roof at ',
    icon: Building2,
    color: 'text-orange-400 bg-orange-500/15',
    needsInput: true,
  },
  {
    label: 'Supplement draft',
    prompt: 'Help me write a supplement for missing line items. The insurance carrier approved shingles but denied drip edge, ice and water shield, and starter strip.',
    icon: FileText,
    color: 'text-cyan-400 bg-cyan-500/15',
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'found' | 'denied' | 'idle'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-detect location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationStatus('detecting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus('found');
        },
        () => setLocationStatus('denied'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const handleSubmit = async (e?: FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const text = overridePrompt || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            lat: userLocation?.lat,
            lng: userLocation?.lng,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.response || 'I apologize, I could not generate a response.',
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.needsInput) {
      setInput(action.prompt);
      inputRef.current?.focus();
    } else {
      handleSubmit(undefined, action.prompt);
    }
  };

  const clearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow shadow-lg shadow-storm-purple/20">
              <Brain className="h-5 w-5 text-white" />
            </span>
            AI Sales Assistant
          </h1>
          <p className="mt-1 text-sm text-storm-muted">
            Context-aware sales copilot — storms, properties, objections, supplements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Crosshair className={`w-3.5 h-3.5 ${
              locationStatus === 'found' ? 'text-emerald-400' :
              locationStatus === 'detecting' ? 'text-amber-400 animate-pulse' :
              'text-storm-subtle'
            }`} />
            <span className="text-2xs text-storm-subtle">
              {locationStatus === 'found' ? 'Location active' :
               locationStatus === 'detecting' ? 'Detecting...' :
               'No location'}
            </span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="button-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto storm-card rounded-xl border border-storm-border"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 rounded-2xl flex items-center justify-center mb-6">
              <Brain className="w-8 h-8 text-storm-glow" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">What can I help with?</h2>
            <p className="text-storm-subtle text-sm mb-8 text-center max-w-md">
              I can look up properties, check storm data, handle objections, analyze roofs, and draft supplements — all in one conversation.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    className="storm-card-interactive p-4 text-left group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-medium text-white">{action.label}</p>
                    <p className="text-2xs text-storm-subtle mt-0.5 line-clamp-2">
                      {action.needsInput ? 'Type an address...' : action.prompt.slice(0, 60) + '...'}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center gap-2">
              <Badge variant="purple">
                <Sparkles className="w-3 h-3" />
                Powered by GPT-4o
              </Badge>
              <Badge variant="default">
                <Zap className="w-3 h-3" />
                6 integrated tools
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-storm-purple/20 border border-storm-purple/30 text-white'
                      : 'bg-storm-z1 border border-storm-border text-storm-muted'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>

                  {message.toolsUsed && message.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-storm-border/50">
                      {message.toolsUsed.map((tool) => (
                        <Badge key={tool} variant="default" className="text-[10px]">
                          <Zap className="w-2.5 h-2.5" />
                          {tool.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-storm-border/30">
                      <button
                        onClick={() => handleCopy(message.id, message.content)}
                        className="text-storm-subtle hover:text-white text-2xs flex items-center gap-1 transition-colors"
                      >
                        {copiedId === message.id ? (
                          <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Copy</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-storm-z2 border border-storm-border flex items-center justify-center mt-1">
                    <User className="w-4 h-4 text-storm-muted" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-storm-z1 border border-storm-border rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-storm-glow animate-spin" />
                    <span className="text-sm text-storm-subtle">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <div className="storm-card rounded-xl border border-storm-border focus-within:border-storm-purple/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about storms, properties, objections, supplements..."
              className="w-full bg-transparent text-white placeholder-storm-subtle text-sm px-4 pt-3 pb-2 resize-none focus:outline-none min-h-[44px] max-h-[200px]"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-2xs text-storm-subtle">Shift+Enter for new line</span>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="button-primary px-3 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
