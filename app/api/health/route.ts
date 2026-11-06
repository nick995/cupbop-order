import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Health check for uptime monitoring and deploy verification.
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[health] supabase check failed", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
