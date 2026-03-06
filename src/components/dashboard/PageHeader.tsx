"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
	kicker?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
}

export function PageHeader({
	kicker,
	title,
	description,
	actions,
}: PageHeaderProps) {
	return (
		<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				{kicker && (
					<p className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#A78BFA]">
						{kicker}
					</p>
				)}
				<h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
				{description && (
					<p className="mt-2 text-slate-400">{description}</p>
				)}
			</div>
			{actions && <div className="flex items-center gap-3">{actions}</div>}
		</div>
	);
}
