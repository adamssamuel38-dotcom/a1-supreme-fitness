# A1 Supreme Fitness — independent member app

This repository replaces the Sites-hosted runtime with a Cloudflare Worker and Supabase. It includes the original public calculator, athlete page, favorite foods and three restaurant preferences, free meal/workout plan, member portal, private progress/media, and server-verified PayPal membership.

## Cloudflare deployment

Connect this repository to **Workers & Pages → Create → Import a repository**. Use:

- Worker name: `a1-supreme-fitness`
- Production branch: `main`
- Root directory: repository root
- Build command: `npm ci && npm run check && npm run build`
- Deploy command: `npx wrangler deploy`

The checked-in configuration includes the public Supabase project URL and publishable key. These are intentionally public; private data remains protected by row ownership and the backend. No payment, email or AI secret belongs in GitHub.

After a successful deployment, add `a1supremefit.net` through Cloudflare's domain settings and follow its DNS instructions. Do not replace existing mail DNS records. The domain must point to this independent deployment, not the old Sites deployment.

## Required activation settings

The code deployment alone does **not** finish production activation.

1. Supabase Authentication → URL Configuration: set Site URL to `https://a1supremefit.net`; allow `https://a1supremefit.net/login` and `https://a1supremefit.net/login?mode=reset`. Add the deployed Workers URL equivalents for preview testing if required.
2. Supabase Authentication → Email / SMTP: configure the verified Resend domain, sender `accounts@a1supremefit.net`, SMTP host `smtp.resend.com`, port `465`, user `resend`, password a sending-only Resend API key. Keep email confirmation enabled. Verify signup and password recovery delivery before accepting customers.
3. Supabase Edge Functions → Secrets: add `PAYPAL_CLIENT_SECRET` for the existing **A1SF Membership** live PayPal application. The public client/plan IDs remain in `payment-policy.ts`. Do not substitute a secret from a different PayPal application.
4. Set `APP_ORIGINS` to a comma-separated list of exact allowed website origins (no trailing slash). Defaults are `https://a1supremefit.net,https://www.a1supremefit.net`. Add the actual deployed Workers origin before testing checkout there.
5. Add `OPENAI_API_KEY` securely to Supabase Edge Function secrets to activate AI support. `OPENAI_MODEL` is optional. No key is stored in the repository.

The `member-api` function was deployed through the connected Supabase project. Its source is under `supabase/functions/member-api`. Future changes to that directory also need a Supabase function deployment; Cloudflare builds only deploy the web app/Worker.

## Verification

- `npm run check`
- `npm run build`
- `npx wrangler deploy --dry-run`
- `node tests/personalized-plans.cjs`
- `node tests/independent-security.cjs`
- GET `/api/health` reports backend, payment-secret and AI-secret readiness without exposing secrets. Readiness is not proof of a successful payment.

Before launch, verify with two separate member accounts that profiles and media never cross accounts, signup confirmation and password recovery arrive, and a completed PayPal payment unlocks only its owner. No real payment has been made by the development agent.

## Access and payment design

Session tokens use Secure, HttpOnly, SameSite=Lax cookies on the Worker. Authenticated identity is validated with Supabase Auth. The backend ignores client-supplied user IDs; it derives ownership from the verified token. Browser mutations require same-origin requests. Member tables use RLS; privileged member operations are server-only and explicitly scope every lookup to the verified user.

PayPal checkout uses the fixed $14.99 USD monthly plan and a unique idempotent request ID bound to one Supabase user. Approval alone is not payment: the backend verifies a completed transaction, currency, amount, subscription binding and paid-through date before unlocking access. An ambiguous old checkout fails closed rather than risking a duplicate subscription.

Free plan requests are stored in the private `promo_leads` table with explicit consent. Owner review is available in the Supabase dashboard; this version does not expose a public owner dashboard or send marketing automatically.

Existing Sites member records and subscriptions are **not automatically transferred by matching email**. Any existing paid account must be migrated through verified ownership before purchasing again. Do not invite existing subscribers to repurchase as a migration shortcut.

This is a responsive web app, not an App Store or Google Play release. FitBudd is a separate project and is not integrated.
