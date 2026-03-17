"use client";

import { useState, useEffect } from "react";

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

	useEffect(() => {
		loadTeam();
	}, []);

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
		} finally {
			setLoading(false);
		}
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
				setMessage({ type: "success", text: "Team created! You can now invite members." });
				setTeamName("");
				loadTeam();
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to create team" });
			}
		} catch (error) {
			setMessage({ type: "error", text: "Failed to create team" });
		} finally {
			setCreating(false);
		}
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
		} catch (error) {
			setMessage({ type: "error", text: "Failed to send invitation" });
		} finally {
			setInviting(false);
		}
	};

	const removeMember = async (memberId: string) => {
		if (!confirm("Are you sure you want to remove this team member?")) return;
		try {
			const res = await fetch(`/api/team/members?id=${memberId}`, { method: "DELETE" });
			if (res.ok) {
				setMembers(members.filter((m) => m.id !== memberId));
				setMessage({ type: "success", text: "Team member removed" });
			}
		} catch (error) {
			setMessage({ type: "error", text: "Failed to remove member" });
		}
	};

	const getRoleBadge = (role: string) => {
		switch (role) {
			case "admin":
				return "bg-purple-500/20 text-purple-400 border-purple-500/50";
			case "manager":
				return "bg-blue-500/20 text-blue-400 border-blue-500/50";
			default:
				return "bg-zinc-700 text-zinc-300 border-zinc-600";
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "active":
				return "bg-green-500/20 text-green-400";
			case "invited":
				return "bg-yellow-500/20 text-yellow-400";
			default:
				return "bg-zinc-700 text-zinc-400";
		}
	};

	if (loading) {
		return (
			<div className="p-6 max-w-3xl mx-auto">
				<div className="animate-pulse space-y-4">
					<div className="h-8 bg-zinc-800 rounded w-48" />
					<div className="h-64 bg-zinc-800 rounded-xl" />
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-3xl mx-auto">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Team Management</h1>
				<p className="text-zinc-400 text-sm mt-1">Invite and manage your team members</p>
			</div>

			{message && (
				<div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-red-500/20 text-red-400 border border-red-500/50"}`}>
					{message.text}
				</div>
			)}

			{/* Create Team - shown when user has no team */}
			{!hasTeam && (
				<div className="bg-zinc-800 rounded-xl p-6 mb-6">
					<h2 className="text-lg font-semibold mb-2">Create Your Team</h2>
					<p className="text-zinc-400 text-sm mb-4">Create a team to invite members and collaborate on storm leads.</p>
					<div className="flex gap-3">
						<input
							type="text"
							value={teamName}
							onChange={(e) => setTeamName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && createTeam()}
							placeholder="e.g. Acme Roofing"
							className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
						/>
						<button
							onClick={createTeam}
							disabled={creating || !teamName.trim()}
							className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
						>
							{creating ? (
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							) : (
								"Create Team"
							)}
						</button>
					</div>
				</div>
			)}

			{/* Invite Member - shown when user has a team */}
			{hasTeam && (
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
				<div className="flex gap-3">
					<input
						type="email"
						value={inviteEmail}
						onChange={(e) => setInviteEmail(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && inviteMember()}
						placeholder="teammate@email.com"
						className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
					/>
					<select
						value={inviteRole}
						onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
						className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
					>
						<option value="sales_rep">Sales Rep</option>
						<option value="manager">Manager</option>
					</select>
					<button
						onClick={inviteMember}
						disabled={inviting || !inviteEmail.trim()}
						className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
					>
						{inviting ? (
							<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
						) : (
							"Send Invite"
						)}
					</button>
				</div>
			</div>
			)}

			{/* Team Members */}
			{hasTeam && (
			<div className="bg-zinc-800 rounded-xl p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Team Members ({members.length})</h2>
				</div>

				{members.length === 0 ? (
					<div className="text-center py-12 text-zinc-500">
						<div className="text-4xl mb-3">👥</div>
						<p className="font-medium">No team members yet</p>
						<p className="text-sm mt-1">Invite your team to collaborate on storm leads and routes</p>
					</div>
				) : (
					<div className="space-y-3">
						{members.map((member) => (
							<div key={member.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-700">
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
										{(member.full_name || member.email).charAt(0).toUpperCase()}
									</div>
									<div>
										<div className="font-medium">{member.full_name || member.email}</div>
										<div className="text-sm text-zinc-500">{member.email}</div>
									</div>
								</div>
								<div className="flex items-center gap-3">
									<span className={`px-2 py-1 rounded text-xs font-medium border ${getRoleBadge(member.role)}`}>
										{member.role === "sales_rep" ? "Sales Rep" : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
									</span>
									<span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(member.status)}`}>
										{member.status.charAt(0).toUpperCase() + member.status.slice(1)}
									</span>
									{member.role !== "admin" && (
										<button
											onClick={() => removeMember(member.id)}
											className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
											title="Remove member"
										>
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			)}
		</div>
	);
}
