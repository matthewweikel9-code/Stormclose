import Link from "next/link";
import { updatePassword } from "../actions";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Set a new password</h1>
      <p className="mt-2 text-sm text-slate-400">Choose a new secure password for your account.</p>

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

      <form action={updatePassword} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-slate-300">
            New password
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
          Update password
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Back to{" "}
        <Link href="/login" className="font-semibold text-storm-glow hover:text-storm-purple">
          Log in
        </Link>
      </p>
    </div>
  );
}
