import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyConfirmToken } from "@/lib/orderActions";

// POST from the form on /orders/confirm. Marks a "New" order as "Confirmed",
// which also stops reminder emails.
export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const token = String(form.get("t") ?? "");
  const back = new URL("/orders/confirm", request.url);
  back.searchParams.set("id", id);
  back.searchParams.set("t", token);

  if (!verifyConfirmToken(id, token)) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "Confirmed" })
    .eq("id", id)
    .eq("status", "New");

  if (error) {
    console.error("[confirm] update failed", id, error);
    back.searchParams.set("error", "1");
  }
  return NextResponse.redirect(back, 303);
}
