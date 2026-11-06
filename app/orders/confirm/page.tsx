import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyConfirmToken } from "@/lib/orderActions";

export const metadata: Metadata = {
  title: "Confirm order — Cupbop Park City",
  robots: { index: false, follow: false },
};

// Store-staff page reached from the "Confirm order" button in order emails.
// Opening it changes nothing (email scanners prefetch links); the button POSTs
// to /api/orders/confirm.
export default async function ConfirmOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : "";
  const token = typeof params.t === "string" ? params.t : "";
  const failed = params.error === "1";

  let body: React.ReactNode;

  if (!verifyConfirmToken(id, token)) {
    body = <Message title="Invalid link" text="This confirm link is invalid. Use the button in the latest order email." />;
  } else {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("customer_name, customer_phone, order_type, pickup_date, pickup_time, delivery_address, subtotal, status")
      .eq("id", id)
      .maybeSingle();

    if (!order) {
      body = <Message title="Order not found" text="This order no longer exists." />;
    } else {
      const confirmed = order.status !== "New";
      body = (
        <section className="w-full rounded-2xl border-2 border-black bg-white p-5 text-left shadow-[0_4px_0_#000]">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-black">
            {order.order_type} order
          </p>
          <dl className="space-y-1 text-sm text-gray-800">
            <Row label="Customer" value={order.customer_name} />
            <Row label="Phone" value={order.customer_phone} />
            <Row
              label={order.order_type === "Catering" ? "Delivery" : "Pickup"}
              value={`${order.pickup_date} at ${String(order.pickup_time).slice(0, 5)}`}
            />
            {order.delivery_address && <Row label="Address" value={order.delivery_address} />}
            <Row label="Subtotal" value={`$${Number(order.subtotal).toFixed(2)}`} />
            <Row label="Status" value={order.status} />
          </dl>

          {failed && (
            <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
              Could not confirm the order. Please try again.
            </p>
          )}

          {confirmed ? (
            <p className="mt-5 rounded-lg bg-green-100 px-3 py-2 text-center text-sm font-bold text-green-800">
              ✓ This order is {order.status.toLowerCase()}. Reminder emails have stopped.
            </p>
          ) : (
            <form action="/api/orders/confirm" method="post" className="mt-5">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="t" value={token} />
              <button
                type="submit"
                className="w-full rounded-full border-2 border-black bg-[#FFD200] py-3 text-base font-extrabold text-black shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none"
              >
                Confirm order
              </button>
            </form>
          )}
        </section>
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fffdf5]">
      <StoreHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pb-12 pt-6 sm:px-6">
        <h1 className="mb-6 text-3xl font-extrabold text-black">Confirm order</h1>
        {body}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <section className="w-full rounded-2xl border-2 border-black bg-white p-5 text-center shadow-[0_4px_0_#000]">
      <p className="mb-1 text-lg font-extrabold">{title}</p>
      <p className="text-sm text-gray-700">{text}</p>
    </section>
  );
}
