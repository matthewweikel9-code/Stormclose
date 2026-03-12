"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";

const US_STATES = [
	"Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
	"Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
	"Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
	"Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
	"New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
	"Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
	"Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
	"Wisconsin", "Wyoming"
];

const CARRIERS = [
	"State Farm", "Allstate", "Liberty Mutual", "USAA", "Farmers", "Progressive",
	"Nationwide", "Travelers", "American Family", "GEICO", "Other"
];

const OBJECTION_TYPES = [
	"O&P Denial",
	"Depreciation Dispute",
	"Line Item Dispute",
	"Scope of Work",
	"Pre-existing Damage Claim",
	"Coverage Denial",
	"Low Estimate",
	"Other"
];

interface Message {
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export default function NegotiationCoachPage() {
	const [state, setState] = useState("");
	const [carrier, setCarrier] = useState("");
	const [objectionType, setObjectionType] = useState("");
	const [lineItem, setLineItem] = useState("");
	const [situation, setSituation] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		
		if (!situation.trim() || !state) {
			setError("Please enter your situation and select a state");
			return;
		}

		const userMessage: Message = {
			role: "user",
			content: situation,
			timestamp: new Date(),
		};

		setMessages(prev => [...prev, userMessage]);
		setSituation("");
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/negotiation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					situation: userMessage.content,
					state,
					carrier: carrier || undefined,
					objectionType: objectionType || undefined,
					lineItem: lineItem || undefined,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to get coaching");
			}

			const assistantMessage: Message = {
				role: "assistant",
				content: data.coaching,
				timestamp: new Date(),
			};

			setMessages(prev => [...prev, assistantMessage]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to get coaching response");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<PageHeader
				kicker="Pro+ Feature"
				title="AI Negotiation Coach"
				description="Real-time coaching during adjuster calls. Get state-specific arguments and rebuttals on demand."
			/>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Settings Panel */}
				<Card className="p-6 lg:col-span-1">
					<h3 className="text-lg font-semibold text-white mb-4">
						Call Context
					</h3>
					
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								State <span className="text-red-400">*</span>
							</label>
							<select
								value={state}
								onChange={(e) => setState(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm focus:border-storm-purple focus:outline-none"
							>
								<option value="">Select state...</option>
								{US_STATES.map((s) => (
									<option key={s} value={s}>{s}</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Insurance Carrier
							</label>
							<select
								value={carrier}
								onChange={(e) => setCarrier(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm focus:border-storm-purple focus:outline-none"
							>
								<option value="">Select carrier...</option>
								{CARRIERS.map((c) => (
									<option key={c} value={c}>{c}</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Objection Type
							</label>
							<select
								value={objectionType}
								onChange={(e) => setObjectionType(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm focus:border-storm-purple focus:outline-none"
							>
								<option value="">Select type...</option>
								{OBJECTION_TYPES.map((o) => (
									<option key={o} value={o}>{o}</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Specific Line Item (if applicable)
							</label>
							<input
								type="text"
								value={lineItem}
								onChange={(e) => setLineItem(e.target.value)}
								placeholder="e.g., Ice & Water Shield"
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-storm-purple focus:outline-none"
							/>
						</div>
					</div>

					{/* Quick Actions */}
					<div className="mt-6 pt-6 border-t border-slate-700">
						<p className="text-sm font-medium text-slate-400 mb-3">Quick Questions</p>
						<div className="space-y-2">
							{[
								"How do I justify O&P?",
								"Adjuster says pre-existing damage",
								"They won't cover ice & water",
								"Depreciation seems too high"
							].map((question) => (
								<button
									key={question}
									onClick={() => {
										setSituation(question);
									}}
									className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
								>
									{question}
								</button>
							))}
						</div>
					</div>
				</Card>

				{/* Chat Panel */}
				<Card className="p-6 lg:col-span-2 flex flex-col h-[600px]">
					<h3 className="text-lg font-semibold text-white mb-4">
						Live Coaching
					</h3>

					{/* Messages */}
					<div className="flex-1 overflow-y-auto space-y-4 mb-4">
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-slate-500">
								<svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
								</svg>
								<p className="text-center">
									Set your context and describe what the<br />adjuster is saying for instant coaching
								</p>
							</div>
						) : (
							messages.map((message, index) => (
								<motion.div
									key={index}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[85%] rounded-lg px-4 py-3 ${
											message.role === "user"
												? "bg-storm-purple text-white"
												: "bg-slate-800 text-slate-300"
										}`}
									>
										<pre className="text-sm whitespace-pre-wrap font-sans">
											{message.content}
										</pre>
									</div>
								</motion.div>
							))
						)}
						{isLoading && (
							<div className="flex justify-start">
								<div className="bg-slate-800 rounded-lg px-4 py-3">
									<div className="flex items-center gap-2">
										<div className="animate-pulse flex gap-1">
											<div className="w-2 h-2 bg-storm-purple rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
											<div className="w-2 h-2 bg-storm-purple rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
											<div className="w-2 h-2 bg-storm-purple rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
										</div>
										<span className="text-sm text-slate-400">Coaching...</span>
									</div>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Error */}
					{error && (
						<div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
							{error}
						</div>
					)}

					{/* Input */}
					<form onSubmit={handleSubmit} className="flex gap-3">
						<input
							type="text"
							value={situation}
							onChange={(e) => setSituation(e.target.value)}
							placeholder="What is the adjuster saying? What do you need help with?"
							className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
							disabled={isLoading}
						/>
						<Button
							type="submit"
							variant="primary"
							disabled={isLoading || !situation.trim() || !state}
							glow
						>
							{isLoading ? "..." : "Get Help"}
						</Button>
					</form>
				</Card>
			</div>
		</div>
	);
}
