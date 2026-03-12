import Link from "next/link";
import { login } from "../actions";

export default function LoginPage({
	searchParams
}: {
	searchParams: { error?: string; message?: string; next?: string };
}) {
	return (
		<div>
			<h1 className="text-2xl font-bold text-white">Log in</h1>
			<p className="mt-2 text-sm text-slate-400">Welcome back to StormClose AI.</p>

			{searchParams.error ? (
				<p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
					{searchParams.error}
				</p>
			) : null}

			{searchParams.message ? (
				<p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
					{searchParams.message}
				</p>
			) : null}

			<form action={login} className="mt-6 space-y-4">
				<input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
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
					<input id="password" name="password" type="password" required className="input" />
				</div>
				<div className="text-right">
					<Link
						href="/forgot-password"
						className="text-sm font-medium text-storm-glow hover:text-storm-purple"
					>
						Forgot password?
					</Link>
				</div>
				<button type="submit" className="button-primary w-full">
					Log in
				</button>
			</form>

			<p className="mt-4 text-sm text-slate-400">
				No account yet?{" "}
				<Link href="/signup" className="font-semibold text-storm-glow hover:text-storm-purple">
					Sign up
				</Link>
			</p>
		</div>
	);
}
