import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-[#0B0F1A]">
			{/* Background effects */}
			<div className="fixed inset-0 overflow-hidden">
				<div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#6D5CFF]/10 blur-[120px]" />
				<div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#A78BFA]/10 blur-[150px]" />
			</div>

			{/* Header */}
			<header className="relative z-10 border-b border-[#1F2937] bg-[#0B0F1A]/80 backdrop-blur-xl">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
					<Link href="/">
						<Logo />
					</Link>
				</div>
			</header>

			{/* Content */}
			<main className="relative flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
				<div className="auth-card">{children}</div>
			</main>
		</div>
	);
}
