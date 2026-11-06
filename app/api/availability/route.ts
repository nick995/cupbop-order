import { NextResponse } from "next/server";
import { storeToday } from "@/lib/orderActions";
import { earliestOrderDate, getStoreSettings } from "@/lib/storeSettings";

// Public: which dates checkout may offer. Uses the store's timezone for "today".
export async function GET() {
  const settings = await getStoreSettings();
  const today = storeToday();
  return NextResponse.json(
    {
      today,
      earliestDate: earliestOrderDate(settings, today),
      leadDays: settings.leadDays,
      blackoutDates: settings.blackoutDates.filter((d) => d >= today),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
