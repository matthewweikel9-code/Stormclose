"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNextPath(path: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  return path;
}

function isRedirectException(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(
        `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`
      );
    }

    revalidatePath("/", "layout");
    redirect(nextPath);
  } catch (error) {
    if (isRedirectException(error)) {
      throw error;
    }

    redirect(
      `/login?error=${encodeURIComponent("Login is temporarily unavailable. Please try again.")}&next=${encodeURIComponent(nextPath)}`
    );
  }
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/callback?next=/dashboard`
      }
    });

    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }

    // If email confirmation is disabled in Supabase, a session is returned immediately.
    if (data.session) {
      revalidatePath("/", "layout");
      redirect("/dashboard");
    }

    // Optional local/dev bypass to speed up QA when email confirmation is enabled.
    const shouldAutoConfirmInDev =
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_AUTO_CONFIRM_SIGNUPS === "true" &&
      Boolean(data.user?.id);

    if (shouldAutoConfirmInDev && data.user?.id) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) {
          revalidatePath("/", "layout");
          redirect("/dashboard");
        }
      } catch {
        // Fall through to email verification message.
      }
    }

    revalidatePath("/", "layout");
    redirect("/login?message=Check your email to confirm your account.");
  } catch (error) {
    if (isRedirectException(error)) {
      throw error;
    }

    redirect(`/signup?error=${encodeURIComponent("Sign up is temporarily unavailable. Please try again.")}`);
  }
}

export async function forgotPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  try {
    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/callback?next=/reset-password`
    });

    if (error) {
      redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/forgot-password?message=Check your email for a reset link.");
  } catch (error) {
    if (isRedirectException(error)) {
      throw error;
    }

    redirect(
      `/forgot-password?error=${encodeURIComponent("Password reset is temporarily unavailable. Please try again.")}`
    );
  }
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/login?message=Password updated. Please log in.");
  } catch (error) {
    if (isRedirectException(error)) {
      throw error;
    }

    redirect(
      `/reset-password?error=${encodeURIComponent("Password update is temporarily unavailable. Please try again.")}`
    );
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}