import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptStormProviderCredentials } from "@/lib/storm-providers/security";

export type StormProvider = "hailtrace" | "hailrecon";

/**
 * POST /api/integrations/storm-providers/connect
 * Save/update storm provider (HailTrace, Hail Recon) API key for the user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey, settings } = body as {
      provider?: StormProvider;
      apiKey?: string;
      settings?: { defaultRadius?: number };
    };

    if (!provider || !["hailtrace", "hailrecon"].includes(provider)) {
      return NextResponse.json(
        { error: "provider must be 'hailtrace' or 'hailrecon'" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    let encryptedCredentials: string;
    try {
      encryptedCredentials = encryptStormProviderCredentials(apiKey);
    } catch (encryptionError) {
      console.error("Storm provider credential encryption failed:", encryptionError);
      return NextResponse.json(
        {
          error:
            "Encryption not configured. Set STORM_PROVIDER_ENCRYPTION_KEY (or INTEGRATION_ENCRYPTION_KEY).",
        },
        { status: 500 }
      );
    }

    const { error: upsertError } = await (supabase as any)
      .from("storm_provider_integrations")
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_credentials: encryptedCredentials,
          settings_json: settings || { defaultRadius: 100 },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("Failed to save storm provider connection:", upsertError);
      return NextResponse.json(
        { error: upsertError.message || "Failed to save connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${provider} connected successfully`,
    });
  } catch (error) {
    console.error("Storm provider connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect storm provider" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/storm-providers/connect
 * List user's storm provider integrations (without credentials)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: integrations } = await (supabase as any)
      .from("storm_provider_integrations")
      .select("id, provider, settings_json, created_at, updated_at")
      .eq("user_id", user.id);

    return NextResponse.json({
      integrations: integrations || [],
    });
  } catch (error) {
    console.error("Storm provider status check error:", error);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/storm-providers/connect
 * Disconnect a storm provider (query: ?provider=hailtrace|hailrecon)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as StormProvider | null;
    if (!provider || !["hailtrace", "hailrecon"].includes(provider)) {
      return NextResponse.json(
        { error: "provider query param must be 'hailtrace' or 'hailrecon'" },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any)
      .from("storm_provider_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      console.error("Failed to disconnect storm provider:", error);
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${provider} disconnected`,
    });
  } catch (error) {
    console.error("Storm provider disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect storm provider" },
      { status: 500 }
    );
  }
}
