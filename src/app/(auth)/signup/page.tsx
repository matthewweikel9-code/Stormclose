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
			<p className="mt-2 text-sm text-slate-400">Start using StormClose AI today.</p>

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
				<button type="submit" className="button-primary w-full">
					Sign up
				</button>
			</form>

			<p className="mt-4 text-sm text-slate-400">
				Already have an account?{" "}
				<Link href="/login" className="font-semibold text-[#A78BFA] hover:text-[#6D5CFF]">
					Log in
				</Link>
			</p>
		</div>
	);
}
