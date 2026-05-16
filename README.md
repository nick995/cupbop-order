# Cupbop Park City — Ordering Website

Mobile-first ordering and catering request site for **Cupbop Park City** (single store, not the corporate chain).

Built with **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Framer Motion + Supabase**.

## Quick start

```bash
npm install        # already done if you're seeing this
npm run dev        # start dev server at http://localhost:3000
```

Open http://localhost:3000 — you'll see the truck intro animation, then it routes to `/menu`.

## Flow

1. `/` — Truck intro animation (~3s, with Skip button) → routes to `/menu`
2. `/menu` — Browse items, add to cart
3. `/checkout` — Customer info form, pickup details, payment method (no online payment)
4. `/order-confirmation` — Success page

## Adding a truck image

Drop a PNG truck image at:

```
public/images/cupbop-truck.png
```

(The intro page will use it automatically. If the file is missing, the page still works — just no truck graphic.)

## Setting up Supabase

1. Create a free Supabase project at https://supabase.com.
2. SQL Editor → paste `db/schema.sql` → Run.
3. Copy `.env.local.example` to `.env.local` and fill in the keys from **Settings → API**.

Until Supabase is configured, the checkout flow still works end-to-end — orders just aren't persisted (the API logs a warning).

## Setting up email notifications (Resend)

1. Sign up at https://resend.com (free tier is generous).
2. Verify your sending domain.
3. Add the keys to `.env.local`:
   - `RESEND_API_KEY`
   - `ORDER_FROM_EMAIL`
   - `STORE_NOTIFICATION_EMAIL`

(Email sending is wired up as a TODO in `app/api/orders/route.ts` — implement when ready.)

## Deploying to Vercel

1. Push this repo to GitHub.
2. Go to https://vercel.com → New Project → import the repo.
3. Add the environment variables from `.env.local` in the Vercel project settings.
4. Deploy. Vercel auto-detects Next.js.

## Project structure

```
app/
  page.tsx                   ← Truck intro
  menu/page.tsx              ← Menu
  checkout/page.tsx          ← Order form
  order-confirmation/page.tsx
  api/orders/route.ts        ← Save order to Supabase
  layout.tsx, globals.css

components/
  CupbopDeliveryIntro.tsx    ← Animated intro
  StoreHeader.tsx

lib/
  menu.ts                    ← Hardcoded menu items (edit prices/items here)
  cart.ts                    ← Cart state (sessionStorage)
  supabase.ts                ← Supabase clients

db/schema.sql                ← Run in Supabase SQL editor
public/images/Logo.png       ← Cupbop logo
```

## Rules (see CLAUDE.md)

- **Guest checkout only** — no customer accounts.
- **No online payment** — cash or credit card at the store only.
- Admin login is only for the (future) admin dashboard.
