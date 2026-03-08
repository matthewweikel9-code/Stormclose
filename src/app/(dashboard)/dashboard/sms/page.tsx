"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";

interface Message {
	id: string;
	content: string;
	sender: "user" | "ai" | "customer";
	timestamp: string;
	status?: "sent" | "delivered" | "read";
}

interface Conversation {
	id: string;
	contact: {
		name: string;
		phone: string;
		isLead: boolean;
	};
	messages: Message[];
	aiEnabled: boolean;
	lastActivity: string;
	status: "active" | "qualified" | "appointment_set" | "not_interested";
}

const mockConversations: Conversation[] = [
	{
		id: "1",
		contact: {
			name: "Maria Garcia",
			phone: "+1 (214) 555-0198",
			isLead: true
		},
		messages: [
			{ id: "1", content: "Hi, I saw your ad about free roof inspections. Is that still available?", sender: "customer", timestamp: "2026-03-08T14:30:00Z" },
			{ id: "2", content: "Hi Maria! Yes, absolutely! We offer free, no-obligation roof inspections. We had some significant hail in your area recently. Have you noticed any damage to your roof or gutters?", sender: "ai", timestamp: "2026-03-08T14:30:15Z", status: "read" },
			{ id: "3", content: "Actually yes, my neighbor said she saw some dents on my AC unit", sender: "customer", timestamp: "2026-03-08T14:32:00Z" },
			{ id: "4", content: "That's a telltale sign of hail damage! AC units and roofs usually get hit at the same time. Our inspector can check both and document everything for your insurance claim if needed. Would tomorrow morning or afternoon work better for a quick 15-minute inspection?", sender: "ai", timestamp: "2026-03-08T14:32:10Z", status: "delivered" }
		],
		aiEnabled: true,
		lastActivity: "2026-03-08T14:32:10Z",
		status: "active"
	},
	{
		id: "2",
		contact: {
			name: "Robert Wilson",
			phone: "+1 (972) 555-0234",
			isLead: true
		},
		messages: [
			{ id: "1", content: "Do you guys do gutters too?", sender: "customer", timestamp: "2026-03-08T13:15:00Z" },
			{ id: "2", content: "Yes! We do gutters, downspouts, and gutter guards. Are you looking for repair or replacement?", sender: "ai", timestamp: "2026-03-08T13:15:08Z", status: "read" },
			{ id: "3", content: "Just repair. One section is pulling away", sender: "customer", timestamp: "2026-03-08T13:18:00Z" },
			{ id: "4", content: "Got it! We can definitely help with that. Most gutter repairs are pretty straightforward. While we're there, we can also do a quick roof check - with the recent storms, it's a good idea. When would be a good time for one of our techs to stop by?", sender: "ai", timestamp: "2026-03-08T13:18:12Z", status: "read" },
			{ id: "5", content: "How about Saturday morning?", sender: "customer", timestamp: "2026-03-08T13:20:00Z" }
		],
		aiEnabled: true,
		lastActivity: "2026-03-08T13:20:00Z",
		status: "appointment_set"
	}
];

export default function SMSResponderPage() {
	const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
	const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(mockConversations[0]);
	const [newMessage, setNewMessage] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [simulatedMessage, setSimulatedMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [aiSettings, setAiSettings] = useState({
		autoRespond: true,
		responseDelay: 5,
		afterHoursEnabled: true,
		qualifyLeads: true
	});

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [selectedConversation?.messages]);

	// Generate AI response using the API
	const generateAIResponse = async (conversation: Conversation) => {
		setIsGenerating(true);
		try {
			// Convert messages to conversation history format
			const conversationHistory = conversation.messages.map(msg => ({
				role: msg.sender === "customer" ? "homeowner" as const : "assistant" as const,
				content: msg.content
			}));

			const response = await fetch("/api/sms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: conversation.messages[conversation.messages.length - 1].content,
					conversationHistory: conversationHistory.slice(0, -1), // Exclude last message as it's passed separately
					context: {
						businessName: "StormAI Roofing",
						services: ["roofing", "storm damage repair", "insurance claims", "gutters", "free inspections"]
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to generate response");
			}

			const data = await response.json();
			
			// Add AI response to conversation
			const aiMessage: Message = {
				id: Date.now().toString(),
				content: data.response,
				sender: "ai",
				timestamp: new Date().toISOString(),
				status: "sent"
			};

			const updatedConversation = {
				...conversation,
				messages: [...conversation.messages, aiMessage],
				lastActivity: new Date().toISOString()
			};

			setSelectedConversation(updatedConversation);
			setConversations(prev => 
				prev.map(c => c.id === conversation.id ? updatedConversation : c)
			);
		} catch (error) {
			console.error("Error generating AI response:", error);
		} finally {
			setIsGenerating(false);
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "appointment_set":
				return { color: "bg-emerald-500/10 text-emerald-400", label: "Appointment Set" };
			case "qualified":
				return { color: "bg-[#6D5CFF]/10 text-[#A78BFA]", label: "Qualified" };
			case "not_interested":
				return { color: "bg-slate-500/10 text-slate-400", label: "Not Interested" };
			default:
				return { color: "bg-amber-500/10 text-amber-400", label: "Active" };
		}
	};

	const handleSendMessage = () => {
		if (!newMessage.trim() || !selectedConversation) return;

		const newMsg: Message = {
			id: Date.now().toString(),
			content: newMessage,
			sender: "user",
			timestamp: new Date().toISOString(),
			status: "sent"
		};

		const updatedConversation = {
			...selectedConversation,
			messages: [...selectedConversation.messages, newMsg],
			lastActivity: new Date().toISOString()
		};

		setSelectedConversation(updatedConversation);
		setConversations(prev => 
			prev.map(c => c.id === selectedConversation.id ? updatedConversation : c)
		);
		setNewMessage("");
	};

	// Simulate an incoming customer message (for testing AI responses)
	const handleSimulateCustomerMessage = () => {
		if (!simulatedMessage.trim() || !selectedConversation) return;

		const customerMsg: Message = {
			id: Date.now().toString(),
			content: simulatedMessage,
			sender: "customer",
			timestamp: new Date().toISOString()
		};

		const updatedConversation = {
			...selectedConversation,
			messages: [...selectedConversation.messages, customerMsg],
			lastActivity: new Date().toISOString()
		};

		setSelectedConversation(updatedConversation);
		setConversations(prev => 
			prev.map(c => c.id === selectedConversation.id ? updatedConversation : c)
		);
		setSimulatedMessage("");

		// If AI is enabled, generate a response after a short delay
		if (selectedConversation.aiEnabled && aiSettings.autoRespond) {
			setTimeout(() => {
				generateAIResponse(updatedConversation);
			}, aiSettings.responseDelay * 1000);
		}
	};

	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<PageHeader
				kicker="Enterprise Feature"
				title="SMS/WhatsApp AI Responder"
				description="24/7 AI-powered responses that qualify leads and book appointments."
			/>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-4">
				<Card className="p-4 text-center">
					<p className="text-3xl font-bold text-white">{conversations.length}</p>
					<p className="text-xs text-slate-400">Active Conversations</p>
				</Card>
				<Card className="p-4 text-center">
					<p className="text-3xl font-bold text-emerald-400">12</p>
					<p className="text-xs text-slate-400">Appointments Booked</p>
				</Card>
				<Card className="p-4 text-center">
					<p className="text-3xl font-bold text-[#A78BFA]">45s</p>
					<p className="text-xs text-slate-400">Avg Response Time</p>
				</Card>
				<Card className="p-4 text-center">
					<p className="text-3xl font-bold text-amber-400">78%</p>
					<p className="text-xs text-slate-400">Lead Qualification Rate</p>
				</Card>
			</div>

			<div className="grid gap-6 lg:grid-cols-4">
				{/* Conversation List */}
				<div className="lg:col-span-1 space-y-2">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-semibold text-white">Conversations</h3>
						<span className="text-xs text-slate-500">{conversations.length} active</span>
					</div>
					{conversations.map((conv) => {
						const badge = getStatusBadge(conv.status);
						const lastMessage = conv.messages[conv.messages.length - 1];
						return (
							<motion.div
								key={conv.id}
								whileHover={{ scale: 1.02 }}
								onClick={() => setSelectedConversation(conv)}
								className={`cursor-pointer rounded-xl p-3 transition-all ${
									selectedConversation?.id === conv.id
										? "bg-[#6D5CFF]/20 border border-[#6D5CFF]"
										: "bg-slate-800/50 border border-slate-700 hover:border-slate-600"
								}`}
							>
								<div className="flex items-start justify-between mb-1">
									<p className="font-medium text-white text-sm">{conv.contact.name}</p>
									{conv.aiEnabled && (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6D5CFF]/20 text-[#A78BFA]">AI</span>
									)}
								</div>
								<p className="text-xs text-slate-500 truncate">{lastMessage?.content}</p>
								<div className="flex items-center justify-between mt-2">
									<span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
										{badge.label}
									</span>
									<span className="text-[10px] text-slate-600">{formatTime(conv.lastActivity)}</span>
								</div>
							</motion.div>
						);
					})}
				</div>

				{/* Chat Area */}
				<div className="lg:col-span-2">
					<Card className="flex flex-col h-[500px]">
						{selectedConversation ? (
							<>
								{/* Chat Header */}
								<div className="flex items-center justify-between p-4 border-b border-slate-700">
									<div>
										<p className="font-semibold text-white">{selectedConversation.contact.name}</p>
										<p className="text-xs text-slate-400">{selectedConversation.contact.phone}</p>
									</div>
									<div className="flex items-center gap-2">
										<span className={`text-xs px-2 py-1 rounded-full ${selectedConversation.aiEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
											{selectedConversation.aiEnabled ? "AI Active" : "AI Paused"}
										</span>
										<button
											onClick={() => setSelectedConversation({
												...selectedConversation,
												aiEnabled: !selectedConversation.aiEnabled
											})}
											className="text-xs text-slate-400 hover:text-white"
										>
											{selectedConversation.aiEnabled ? "Pause" : "Enable"}
										</button>
									</div>
								</div>

								{/* Messages */}
								<div className="flex-1 overflow-y-auto p-4 space-y-3">
									{selectedConversation.messages.map((msg) => (
										<div
											key={msg.id}
											className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}
										>
											<div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
												msg.sender === "customer"
													? "bg-slate-700 text-white"
													: msg.sender === "ai"
													? "bg-[#6D5CFF]/80 text-white"
													: "bg-emerald-600 text-white"
											}`}>
												<p className="text-sm">{msg.content}</p>
												<div className="flex items-center justify-end gap-1 mt-1">
													<span className="text-[10px] opacity-60">{formatTime(msg.timestamp)}</span>
													{msg.sender !== "customer" && (
														<span className="text-[10px] opacity-60">
															{msg.sender === "ai" ? "🤖" : "👤"}
														</span>
													)}
												</div>
											</div>
										</div>
									))}
									{isGenerating && (
										<div className="flex justify-end">
											<div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#6D5CFF]/40 text-white">
												<div className="flex items-center gap-2">
													<div className="flex gap-1">
														<span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
														<span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
														<span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
													</div>
													<span className="text-xs opacity-60">AI typing...</span>
												</div>
											</div>
										</div>
									)}
									<div ref={messagesEndRef} />
								</div>

								{/* Input */}
								<div className="border-t border-slate-700 p-3">
									<div className="flex gap-2 mb-2">
										<input
											type="text"
											value={newMessage}
											onChange={(e) => setNewMessage(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
											placeholder="Type a message (overrides AI)..."
											className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
										/>
										<Button onClick={handleSendMessage} variant="primary" className="px-4">
											Send
										</Button>
									</div>
									{selectedConversation.aiEnabled && selectedConversation.messages.length > 0 && 
									 selectedConversation.messages[selectedConversation.messages.length - 1].sender === "customer" && (
										<Button 
											onClick={() => generateAIResponse(selectedConversation)}
											variant="secondary" 
											className="w-full text-sm"
											disabled={isGenerating}
										>
											{isGenerating ? "🤖 AI is typing..." : "🤖 Generate AI Response"}
										</Button>
									)}
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-slate-500">
								<p>Select a conversation</p>
							</div>
						)}
					</Card>
				</div>

				{/* AI Settings */}
				<div className="lg:col-span-1 space-y-4">
					<Card className="p-4">
						<h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
							<svg className="h-4 w-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							AI Settings
						</h3>
						
						<div className="space-y-4">
							<label className="flex items-center justify-between">
								<span className="text-sm text-slate-300">Auto-respond</span>
								<button
									onClick={() => setAiSettings({ ...aiSettings, autoRespond: !aiSettings.autoRespond })}
									className={`w-10 h-5 rounded-full transition-colors ${aiSettings.autoRespond ? "bg-[#6D5CFF]" : "bg-slate-600"}`}
								>
									<span className={`block w-4 h-4 rounded-full bg-white transition-transform ${aiSettings.autoRespond ? "translate-x-5" : "translate-x-0.5"}`} />
								</button>
							</label>

							<label className="flex items-center justify-between">
								<span className="text-sm text-slate-300">After-hours AI</span>
								<button
									onClick={() => setAiSettings({ ...aiSettings, afterHoursEnabled: !aiSettings.afterHoursEnabled })}
									className={`w-10 h-5 rounded-full transition-colors ${aiSettings.afterHoursEnabled ? "bg-[#6D5CFF]" : "bg-slate-600"}`}
								>
									<span className={`block w-4 h-4 rounded-full bg-white transition-transform ${aiSettings.afterHoursEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
								</button>
							</label>

							<label className="flex items-center justify-between">
								<span className="text-sm text-slate-300">Auto-qualify leads</span>
								<button
									onClick={() => setAiSettings({ ...aiSettings, qualifyLeads: !aiSettings.qualifyLeads })}
									className={`w-10 h-5 rounded-full transition-colors ${aiSettings.qualifyLeads ? "bg-[#6D5CFF]" : "bg-slate-600"}`}
								>
									<span className={`block w-4 h-4 rounded-full bg-white transition-transform ${aiSettings.qualifyLeads ? "translate-x-5" : "translate-x-0.5"}`} />
								</button>
							</label>

							<div>
								<label className="text-sm text-slate-300 block mb-2">Response delay</label>
								<select
									value={aiSettings.responseDelay}
									onChange={(e) => setAiSettings({ ...aiSettings, responseDelay: Number(e.target.value) })}
									className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
								>
									<option value={0}>Instant</option>
									<option value={5}>5 seconds</option>
									<option value={15}>15 seconds</option>
									<option value={30}>30 seconds</option>
								</select>
							</div>
						</div>
					</Card>

					<Card className="p-4">
						<h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
						<div className="space-y-2">
							<Button variant="secondary" className="w-full text-sm justify-start">
								📋 View All Leads
							</Button>
							<Button variant="secondary" className="w-full text-sm justify-start">
								📅 Sync Calendar
							</Button>
							<Button variant="secondary" className="w-full text-sm justify-start">
								⚙️ Edit AI Prompts
							</Button>
						</div>
					</Card>

					{/* Simulate Customer Message (for testing) */}
					<Card className="p-4 border-amber-500/30">
						<h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
							🧪 Test AI Responses
						</h3>
						<p className="text-xs text-slate-400 mb-3">
							Simulate an incoming customer message to see how AI responds:
						</p>
						<div className="space-y-2">
							<input
								type="text"
								value={simulatedMessage}
								onChange={(e) => setSimulatedMessage(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSimulateCustomerMessage()}
								placeholder="Type customer message..."
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
							/>
							<Button 
								onClick={handleSimulateCustomerMessage} 
								variant="secondary" 
								className="w-full text-sm"
								disabled={!simulatedMessage.trim() || isGenerating}
							>
								{isGenerating ? "AI Generating..." : "📱 Simulate Incoming SMS"}
							</Button>
						</div>
					</Card>

					<Card className="p-4 bg-gradient-to-br from-[#6D5CFF]/10 to-transparent border-[#6D5CFF]/20">
						<p className="text-xs text-slate-400">
							💡 <span className="text-white">Pro tip:</span> AI responses are designed to feel natural and build rapport before qualifying. Average 3-4 messages before appointment request.
						</p>
					</Card>
				</div>
			</div>
		</div>
	);
}
