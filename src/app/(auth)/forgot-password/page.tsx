import Link from "next/link";
import { forgotPassword } from "../actions";

export default function ForgotPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-400">
        Enter your email and we will send a password reset link.
      </p>

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

      <form action={forgotPassword} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-slate-300">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <button type="submit" className="button-primary w-full">
          Send reset link
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Back to{" "}
        <Link href="/login" className="font-semibold text-[#A78BFA] hover:text-[#6D5CFF]">
          Log in
        </Link>
      </p>
    </div>
  );
}
