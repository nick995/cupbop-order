# Deploying Cupbop to cupbop.mingyudev.com

```
browser ─HTTPS─▶ cupbop.mingyudev.com ─▶ Vercel (Next.js pages + /api/orders)
                                            ├─▶ Supabase Postgres (orders table)
                                            └─▶ Resend (order + reminder emails to the store)
GitHub Actions (hourly) ─▶ /api/cron/reminders ─▶ re-email unconfirmed orders
```

Everything runs on Vercel. Nothing touches the Squash EC2 instance.
Cost: $0 (Vercel Hobby, Supabase Free, Resend Free, GitHub Actions free minutes).

## How store notifications work

- Every new order emails everyone in `STORE_NOTIFICATION_EMAIL`
  (`mjung@cupbop.com`, `lryan@cupbop.com`) with a **Confirm order** button.
- The button opens `/orders/confirm`, which shows the order and a **Confirm order**
  button. Clicking it sets the status to `Confirmed`.
- While an order is still `New`, it's re-emailed as a reminder:
  every **24 hours** while the order is more than 48 hours away, every **12 hours**
  once it's within 48 hours (store time, America/Denver). Reminders stop when
  the order is confirmed or its pickup/delivery time passes.
- Changing `status` in the Supabase Table Editor to anything other than `New`
  also stops reminders.
- Cadence lives in `lib/orderActions.ts`.

## Admin dashboard (`/admin`)

`https://cupbop.mingyudev.com/admin` lists all orders (upcoming / past / all,
filter by status) and lets staff set the status: Confirm, Ready, Completed, Cancel.
Any status other than `New` stops reminders.

Sign-in is email + password via Supabase Auth, limited to `ADMIN_EMAILS`.
To add a person:

1. Supabase → **Authentication → Users → Add user → Create new user** →
   their email + a password, tick **Auto Confirm User**.
2. Add their email to `ADMIN_EMAILS` in Vercel (comma-separated) → Redeploy.

To remove someone: take them out of `ADMIN_EMAILS` (locks them out on the next
request) and delete the user in Supabase.

One-time: Supabase → **Authentication → Sign In / Providers** → turn **off**
"Allow new users to sign up", so only accounts you create exist.

## 1. Supabase

1. In the Supabase dashboard, pause or delete the project you're retiring so a free slot opens.
2. **New project** → name `cupbop`, region `us-east-2` (or closest), save the DB password in your password manager.
3. **SQL Editor → New query** → paste all of `db/schema.sql` → **Run**.
4. **Table Editor** → confirm `orders` exists and RLS is **enabled**.
5. **Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret, server only — never `NEXT_PUBLIC_`)

   The `anon` key isn't needed: the browser never talks to Supabase directly.

> Free projects pause after ~7 days without activity. The hourly reminders
> job queries the DB, which keeps it awake. If the project ever pauses anyway,
> orders return an error until you click **Restore**.

## 2. Resend (store email)

1. Sign in at resend.com → **Domains → Add domain** → `cupbop.mingyudev.com`.
2. Resend shows DNS records (an MX + TXT on `send.cupbop`, and a DKIM TXT on
   `resend._domainkey.cupbop`). Add them **exactly as shown** at the DNS host for
   `mingyudev.com` (step 5). They're on their own names, so they don't conflict
   with the `cupbop` CNAME or any existing `mingyudev.com` mail records.
3. Wait for **Verified**, then **API Keys → Create** (permission: Sending access) → `RESEND_API_KEY`.
4. Values:
   - `ORDER_FROM_EMAIL` = `Cupbop Orders <orders@cupbop.mingyudev.com>`
   - `STORE_NOTIFICATION_EMAIL` = `mjung@cupbop.com,lryan@cupbop.com`

   The domain must be **Verified** before Resend will deliver to `@cupbop.com`.
   (Resend's `onboarding@resend.dev` test sender only delivers to your own Resend login email.)

Leave all `TWILIO_*` vars unset — SMS stays off.

## 3. Vercel

1. Merge the deploy PR into `main`.
2. vercel.com → **Add New → Project** → import `nick995/cupbop-order`.
   Framework: Next.js (auto). Root directory: `./`. Leave build settings default.
3. **Environment Variables** (Production), add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `RESEND_API_KEY` | from step 2 |
   | `ORDER_FROM_EMAIL` | from step 2 |
   | `STORE_NOTIFICATION_EMAIL` | `mjung@cupbop.com,lryan@cupbop.com` |
   | `ORDER_ACTION_SECRET` | run `openssl rand -hex 32` |
   | `CRON_SECRET` | run `openssl rand -hex 32` (a different value) |
   | `SITE_URL` | `https://cupbop.mingyudev.com` |
   | `ADMIN_EMAILS` | `mingyu995@gmail.com,mjung@cupbop.com,lryan@cupbop.com` |

4. **Deploy**. Every later push to `main` auto-deploys; branches get preview URLs.
5. **Settings → Domains → Add** `cupbop.mingyudev.com`. Vercel shows the CNAME target to use.

## 4. GitHub (hourly reminders)

Repo **Settings → Secrets and variables → Actions**:

1. **Secrets → New repository secret**: `CRON_SECRET` = the same value as in Vercel.
2. **Variables → New repository variable**: `SITE_URL` = `https://cupbop.mingyudev.com`.

The workflow `.github/workflows/order-reminders.yml` runs hourly from `main`.
To test it: **Actions → Order reminders → Run workflow**; the log should end with
`{"checked":…,"sent":…,"failed":0}`.

## 5. DNS (at the current host for mingyudev.com)

| Name | Type | Value | TTL |
|---|---|---|---|
| `cupbop` | CNAME | the target Vercel shows (e.g. `cname.vercel-dns.com`) | 300 |
| Resend records | as shown in Resend | as shown | 300 |

Don't touch `squash`, `www.squash` or `api.squash`.
Vercel issues the HTTPS certificate automatically once the CNAME resolves.

## 6. Verify

1. `https://cupbop.mingyudev.com` loads the intro, then the menu.
2. `https://cupbop.mingyudev.com/api/health` returns `{"ok":true}`.
3. Place a test **Pickup** order → confirmation page shows.
4. Supabase **Table Editor → orders** shows the row with status `New`.
5. Both store inboxes receive the order email (check spam the first time).
6. Click **Confirm order** in the email → confirm on the page → status shows `Confirmed`.
7. Delete the test row.

If an order fails: Vercel → Project → **Logs**, filter for `[orders]`.

## Rollback

Vercel → Project → **Deployments** → pick the last good deployment → **⋯ → Promote to Production**.
Then revert the bad commit on `main`.
