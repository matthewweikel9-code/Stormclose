"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface RequestDemoModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function RequestDemoModal({ isOpen, onClose }: RequestDemoModalProps) {
	const [form, setForm] = useState({
		companyName: "",
		contactName: "",
		email: "",
		phone: "",
		message: "",
	});
	const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
	const [errorMsg, setErrorMsg] = useState("");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleEscape);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [isOpen, onClose]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setStatus("submitting");
		setErrorMsg("");
		try {
			const res = await fetch("/api/demo-request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const data = await res.json();
			if (!res.ok) {
				setStatus("error");
				setErrorMsg(data.error ?? "Something went wrong");
				return;
			}
			setStatus("success");
			setForm({ companyName: "", contactName: "", email: "", phone: "", message: "" });
			setTimeout(() => {
				onClose();
				setStatus("idle");
			}, 2000);
		} catch {
			setStatus("error");
			setErrorMsg("Failed to send request");
		}
	}

	if (!mounted) return null;

	const modalContent = (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					key="request-demo-modal"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
				>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 bg-black/70 backdrop-blur-sm"
					/>

					{/* Modal card */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.2 }}
						onClick={(e) => e.stopPropagation()}
						className="relative z-10 w-full max-w-md"
					>
						<div className="rounded-2xl border border-slate-700 bg-storm-z1 p-6 shadow-2xl">
							<div className="mb-6 flex items-center justify-between">
								<h2 className="text-xl font-bold text-white">Request a Demo</h2>
								<button
									type="button"
									onClick={onClose}
									className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
									aria-label="Close"
								>
									<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							{status === "success" ? (
								<div className="py-8 text-center">
									<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-storm-purple/20">
										<svg className="h-8 w-8 text-storm-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									</div>
									<p className="text-lg font-medium text-white">Thanks! We&apos;ll be in touch soon.</p>
								</div>
							) : (
								<form onSubmit={handleSubmit} className="space-y-4">
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-300">Company Name</label>
										<input
											type="text"
											required
											value={form.companyName}
											onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
											className="w-full rounded-lg border border-slate-700 bg-storm-z0 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-storm-purple/50"
											placeholder="Acme Roofing"
										/>
									</div>
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-300">Contact Name</label>
										<input
											type="text"
											required
											value={form.contactName}
											onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
											className="w-full rounded-lg border border-slate-700 bg-storm-z0 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-storm-purple/50"
											placeholder="John Smith"
										/>
									</div>
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
										<input
											type="email"
											required
											value={form.email}
											onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
											className="w-full rounded-lg border border-slate-700 bg-storm-z0 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-storm-purple/50"
											placeholder="john@acmeroofing.com"
										/>
									</div>
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-300">Phone</label>
										<input
											type="tel"
											value={form.phone}
											onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
											className="w-full rounded-lg border border-slate-700 bg-storm-z0 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-storm-purple/50"
											placeholder="(555) 123-4567"
										/>
									</div>
									<div>
										<label className="mb-1.5 block text-sm font-medium text-slate-300">Message</label>
										<textarea
											value={form.message}
											onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
											rows={3}
											className="w-full resize-none rounded-lg border border-slate-700 bg-storm-z0 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-storm-purple/50"
											placeholder="Tell us about your needs..."
										/>
									</div>
									{errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
									<button
										type="submit"
										disabled={status === "submitting"}
										className="w-full rounded-xl bg-storm-purple py-3 font-semibold text-white transition-all hover:bg-storm-purple-hover disabled:opacity-50"
									>
										{status === "submitting" ? "Sending..." : "Submit Request"}
									</button>
								</form>
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);

	return createPortal(modalContent, document.body);
}
