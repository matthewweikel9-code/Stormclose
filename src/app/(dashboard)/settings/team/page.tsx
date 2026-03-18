"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Building2, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
	id: string;
	email: string;
	full_name: string;
	role: "admin" | "manager" | "sales_rep";
	status: "active" | "invited" | "disabled";
	joined_at: string;
	last_active: string | null;
	stats?: {
		leads_generated: number;
		doors_knocked: number;
		appointments_set: number;
	};
}

const ROLE_BADGE: Record<string, "purple" | "info" | "default"> = {
	admin: "purple",
	manager: "info",
	sales_rep: "default",
};

function SkeletonRows({ count = 3 }: { count?: number }) {
	return (
		<div className="space-y-3 p-4">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<div className="skeleton h-10 w-10 rounded-xl" />
					<div className="flex-1 space-y-2">
						<div className="skeleton h-4 w-3/4 rounded" />
						<div className="skeleton h-2 w-1/2 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function TeamSettingsPage() {
	const [members, setMembers] = useState<TeamMember[]>([]);
	const [hasTeam, setHasTeam] = useState(false);
	const [loading, setLoading] = useState(true);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"manager" | "sales_rep">("sales_rep");
	const [inviting, setInviting] = useState(false);
	const [creating, setCreating] = useState(false);
	const [teamName, setTeamName] = useState("");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	useEffect(() => { loadTeam(); }, []);

	const loadTeam = async () => {
		try {
			const res = await fetch("/api/team/members");
			if (res.ok) {
				const data = await res.json();
				setMembers(data.members || []);
				setHasTeam(data.hasTeam ?? (data.members?.length > 0));
			}
		} catch (error) {
			console.error("Error loading team:", error);
		} finally { setLoading(false); }
	};

	const createTeam = async () => {
		if (!teamName.trim()) return;
		setCreating(true);
		setMessage(null);
		try {
			const res = await fetch("/api/teams", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: teamName.trim() }),
			});
			if (res.ok) {
				setMessage({ type: "success", text: "Company created! You can now invite employees." });
				setTeamName("");
				loadTeam();
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to create team" });
			}
		} catch {
			setMessage({ type: "error", text: "Failed to create company" });
		} finally { setCreating(false); }
	};

	const inviteMember = async () => {
		if (!inviteEmail.trim()) return;
		setInviting(true);
		setMessage(null);
		try {
			const res = await fetch("/api/team/members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
			});
			if (res.ok) {
				setMessage({ type: "success", text: `Invitation sent to ${inviteEmail}` });
				setInviteEmail("");
				loadTeam();
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to invite member" });
			}
		} catch {
			setMessage({ type: "error", text: "Failed to send invitation" });
		} finally { setInviting(false); }
	};

	const removeMember = async (memberId: string) => {
		if (!confirm("Are you sure you want to remove this employee?")) return;
		try {
			const res = await fetch(`/api/team/members?id=${memberId}`, { method: "DELETE" });
			if (res.ok) {
				setMembers(members.filter((m) => m.id !== memberId));
				setMessage({ type: "success", text: "Employee removed" });
			}
		} catch {
			setMessage({ type: "error", text: "Failed to remove member" });
		}
	};

	if (loading) {
		return (
			<div className="max-w-3xl space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-7 w-52 rounded-lg" /><div className="skeleton h-10 w-36 rounded-xl" /></div>
				<div className="storm-card"><SkeletonRows count={4} /></div>
			</div>
		);
	}

	return (
		<div className="max-w-3xl space-y-5">
			<div>
				<h1 className="text-lg font-bold text-white">Company Management</h1>
				<p className="text-2xs text-storm-subtle mt-0.5">Invite employees — they inherit your company&apos;s plan (Enterprise, Pro, etc.)</p>
			</div>

			{message && (
				<div className={`rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
					{message.text}
				</div>
			)}

			{/* Create Team */}
			{!hasTeam && (
				<section className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="p-5 space-y-4">
						<div className="flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-storm-purple/15">
								<Building2 className="h-4 w-4 text-storm-glow" />
							</div>
							<div>
								<h2 className="text-sm font-semibold text-white">Create Your Company</h2>
								<p className="text-2xs text-storm-subtle">Create a company to invite employees. They&apos;ll get the same tier you pay for.</p>
							</div>
						</div>
						<div className="flex gap-2">
							<input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTeam()} placeholder="e.g. Acme Roofing" className="dashboard-input flex-1" />
							<button onClick={createTeam} disabled={creating || !teamName.trim()} className="button-primary flex items-center gap-2 text-sm whitespace-nowrap">
								{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
								Create Company
							</button>
						</div>
					</div>
				</section>
			)}

			{/* Invite Member */}
			{hasTeam && (
				<section className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="p-5 space-y-4">
						<div className="flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
								<UserPlus className="h-4 w-4 text-blue-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold text-white">Invite Employee</h2>
								<p className="text-2xs text-storm-subtle">Send an invite to add someone to your company</p>
							</div>
						</div>
						<div className="flex gap-2">
							<input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && inviteMember()} placeholder="teammate@email.com" className="dashboard-input flex-1" />
							<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="dashboard-select">
								<option value="sales_rep">Sales Rep</option>
								<option value="manager">Manager</option>
							</select>
							<button onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} className="button-primary flex items-center gap-2 text-sm whitespace-nowrap">
								{inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
								Send Invite
							</button>
						</div>
					</div>
				</section>
			)}

			{/* Team Members */}
			{hasTeam && (
				<section className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="flex items-center justify-between p-4 pb-2">
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-storm-glow" />
							<h2 className="text-sm font-semibold text-white">Employees</h2>
							{members.length > 0 && <Badge variant="default">{members.length}</Badge>}
						</div>
					</div>
					{members.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-14 px-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
								<Users className="h-7 w-7 text-storm-subtle" />
							</div>
							<p className="text-sm font-medium text-white">No employees yet</p>
							<p className="text-xs text-storm-subtle mt-1">Invite employees — they&apos;ll get your company&apos;s plan tier</p>
						</div>
					) : (
						<div className="stagger-children px-4 pb-4">
							{members.map((member) => (
								<div key={member.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-storm-z2/30 transition-colors">
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 text-sm font-bold text-storm-glow flex-shrink-0">
										{(member.full_name || member.email).charAt(0).toUpperCase()}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-sm font-medium text-white truncate">{member.full_name || member.email}</span>
											<Badge variant={ROLE_BADGE[member.role] ?? "default"}>
												{member.role === "sales_rep" ? "Sales Rep" : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
											</Badge>
											<Badge variant={member.status === "active" ? "success" : member.status === "invited" ? "warning" : "default"}>
												{member.status.charAt(0).toUpperCase() + member.status.slice(1)}
											</Badge>
										</div>
										<p className="text-2xs text-storm-subtle mt-0.5 truncate">{member.email}</p>
									</div>
									{member.role !== "admin" && (
										<button onClick={() => void removeMember(member.id)} className="rounded-lg p-2 text-storm-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0" title="Remove employee">
											<Trash2 className="h-4 w-4" />
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</section>
			)}
		</div>
	);
}
