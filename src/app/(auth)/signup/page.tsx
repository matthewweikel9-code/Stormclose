import Link from "next/link";
import { signup } from "../actions";

export default function SignupPage({
	searchParams
}: {
	searchParams: { error?: string };
}) {
	return (
		<div>
			<h1 className="text-2xl font-bold text-white">Create your account</h1>
			<p className="mt-2 text-sm text-slate-400">Get AI-powered storm ops, supplements, and CRM sync. Start with a 7-day free trial.</p>

			{searchParams.error ? (
				<p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
					{searchParams.error}
				</p>
			) : null}

			<form action={signup} className="mt-6 space-y-4">
				<div>
					<label htmlFor="email" className="text-sm font-medium text-slate-300">
						Email
					</label>
					<input id="email" name="email" type="email" required className="input" />
				</div>
				<div>
					<label htmlFor="password" className="text-sm font-medium text-slate-300">
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						minLength={6}
						required
						className="input"
					/>
				</div>
				<div className="flex items-start gap-3">
					<input id="terms" name="terms" type="checkbox" required className="mt-1 rounded border-slate-600 bg-slate-800 text-storm-purple focus:ring-storm-purple" />
					<label htmlFor="terms" className="text-xs text-slate-400">
						I agree to the{" "}
						<Link href="/terms" className="text-storm-glow hover:text-storm-purple underline">Terms of Service</Link>
						{" "}and{" "}
						<Link href="/privacy" className="text-storm-glow hover:text-storm-purple underline">Privacy Policy</Link>
					</label>
				</div>
				<button type="submit" className="button-primary w-full">
					Sign up
				</button>
			</form>

			<p className="mt-4 text-sm text-slate-400">
				Already have an account?{" "}
				<Link href="/login" className="font-semibold text-storm-glow hover:text-storm-purple">
					Log in
				</Link>
			</p>
		</div>
	);
}
