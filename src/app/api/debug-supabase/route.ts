import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testUserId = searchParams.get("userId");

  // Check environment variables
  const envCheck = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    SUPABASE_URL_VALUE: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
    SERVICE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + "...",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY?.startsWith("sk_") ? "VALID (sk_)" : "INVALID",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ? "VALID (whsec_)" : "INVALID"
  };

  // Create admin client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  // Test 1: Can we read from users table?
  const { data: allUsers, error: readError } = await supabaseAdmin
    .from("users")
    .select("id, email, subscription_status, stripe_customer_id")
    .limit(5);

  // Test 2: Try to update a specific user if provided
  let updateTest = null;
  if (testUserId) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ subscription_status: "active" })
      .eq("id", testUserId)
      .select();

    updateTest = {
      userId: testUserId,
      success: !error,
      error: error?.message ?? null,
      data
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envCheck,
    readTest: {
      success: !readError,
      error: readError?.message ?? null,
      userCount: allUsers?.length ?? 0,
      users: allUsers?.map(u => ({
        id: u.id,
        email: u.email,
        status: u.subscription_status,
        customerId: u.stripe_customer_id?.substring(0, 10) + "..."
      }))
    },
    updateTest
  });
}
