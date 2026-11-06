import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Health check, also hit daily by Vercel Cron (vercel.json) so the free
// Supabase project sees activity and doesn't auto-pause.
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
