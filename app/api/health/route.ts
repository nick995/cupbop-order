import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// Health check for uptime monitoring and deploy verification.
// Reports which integrations are configured (true/false only, never values).
export async function GET() {
  const config = {
    email: Boolean(
      process.env.RESEND_API_KEY &&
        process.env.ORDER_FROM_EMAIL &&
        process.env.STORE_NOTIFICATION_EMAIL
    ),
    confirmLinks: Boolean(process.env.ORDER_ACTION_SECRET),
    reminders: Boolean(process.env.CRON_SECRET),
  };

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, db: true, ...config });
  } catch (err) {
    console.error("[health] supabase check failed", err);
    return NextResponse.json({ ok: false, db: false, ...config }, { status: 503 });
  }
}
