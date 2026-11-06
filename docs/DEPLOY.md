# Deploying Cupbop to cupbop.mingyudev.com

```
browser ─HTTPS─▶ cupbop.mingyudev.com ─▶ Vercel (Next.js pages + /api/orders)
                                            ├─▶ Supabase Postgres (orders table)
                                            └─▶ Resend (new-order email to the store)
```

Everything runs on Vercel. Nothing touches the Squash EC2 instance.
Cost: $0 (Vercel Hobby, Supabase Free, Resend Free).

## 1. Supabase

1. In the Supabase dashboard, pause or delete the project you're retiring so a free slot opens.
2. **New project** → name `cupbop`, region `us-east-2` (or closest), save the DB password in your password manager.
3. **SQL Editor → New query** → paste all of `db/schema.sql` → **Run**.
4. **Table Editor** → confirm `orders` exists and RLS is **enabled**.
5. **Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret, server only)

> Free projects pause after ~7 days without activity. The daily cron in
> `vercel.json` calls `/api/health`, which queries the DB to keep it awake.
> If the project ever pauses anyway, orders return an error until you click **Restore**.

## 2. Resend (store email)

1. Sign in at resend.com → **Domains → Add domain** → `cupbop.mingyudev.com`.
2. Resend shows DNS records (an MX + TXT on `send.cupbop`, and a DKIM TXT on
   `resend._domainkey.cupbop`). Add them **exactly as shown** at the DNS host for
   `mingyudev.com` (step 4). They're on their own names, so they don't conflict
   with the `cupbop` CNAME or any existing `mingyudev.com` mail records.
3. Wait for **Verified**, then **API Keys → Create** (permission: Sending access) → `RESEND_API_KEY`.
4. Values:
   - `ORDER_FROM_EMAIL` = `Cupbop Orders <orders@cupbop.mingyudev.com>`
   - `STORE_NOTIFICATION_EMAIL` = the inbox that should receive orders

Leave all `TWILIO_*` vars unset — SMS stays off.

## 3. Vercel

1. Merge the deploy PR into `main`.
2. vercel.com → **Add New → Project** → import `nick995/cupbop-order`.
   Framework: Next.js (auto). Root directory: `./`. Leave build settings default.
3. **Environment Variables** (Production), add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `RESEND_API_KEY` | from step 2 |
   | `ORDER_FROM_EMAIL` | from step 2 |
   | `STORE_NOTIFICATION_EMAIL` | from step 2 |

4. **Deploy**. Every later push to `main` auto-deploys; branches get preview URLs.
5. **Settings → Domains → Add** `cupbop.mingyudev.com`. Vercel shows the CNAME target to use.

## 4. DNS (at the current host for mingyudev.com)

| Name | Type | Value | TTL |
|---|---|---|---|
| `cupbop` | CNAME | the target Vercel shows (e.g. `cname.vercel-dns.com`) | 300 |
| Resend records | as shown in Resend | as shown | 300 |

Don't touch `squash`, `www.squash` or `api.squash`.
Vercel issues the HTTPS certificate automatically once the CNAME resolves.

## 5. Verify

1. `https://cupbop.mingyudev.com` loads the intro, then the menu.
2. `https://cupbop.mingyudev.com/api/health` returns `{"ok":true}`.
3. Place a test **Pickup** order → confirmation page shows.
4. Supabase **Table Editor → orders** shows the row with status `New`.
5. The store inbox receives the order email (check spam the first time).
6. Delete the test row.

If an order fails: Vercel → Project → **Logs**, filter for `[orders]`.

## Rollback

Vercel → Project → **Deployments** → pick the last good deployment → **⋯ → Promote to Production**.
Then revert the bad commit on `main`.
