# Clinic patient contacts — setup (D1 + Twilio)

Code is ready; create these resources before enabling the feature in production.

For a full list of local env placeholders, see [`docs/dev-vars.example`](./dev-vars.example). Copy it to `.dev.vars` for local development (do not commit `.dev.vars`).

## 1. Cloudflare D1

1. Cloudflare Dashboard → **Workers & Pages** → **D1** → **Create**.
2. Name: `pcc-clinic-patients` (or match `wrangler.json`).
3. Prefer an **EU** location if offered.
4. Copy the **database ID** into `wrangler.json` → `d1_databases[0].database_id` (replace the placeholder).
5. Apply migrations:

```bash
npx wrangler d1 migrations apply pcc-clinic-patients --local
npx wrangler d1 migrations apply pcc-clinic-patients --remote
```

Migrations include patient contacts (`0001`), clinic settings such as the public password-gate toggle (`0002`), and admin portal extras (`0003`: SMS template slug, booking↔patient links, staff activity log).

### Recovery

- Use D1 **Time Travel** / point-in-time restore where your Cloudflare plan supports it.
- Periodically export: `npx wrangler d1 export pcc-clinic-patients --remote --output=./backups/patients-$(date +%F).sql` and store the file securely offline.

## 2. Twilio (outbound SMS only)

1. Create a Twilio account and obtain a number that can send SMS (UK preferred).
2. Set Workers secrets (do not commit):

```bash
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
```

`TWILIO_FROM_NUMBER` should be E.164 (e.g. `+447…`) or a Messaging Service SID if you use one as `From`.

3. Trial accounts can only text verified numbers — fine for fictional test patients.

Delivery-status webhooks are **not** used in v1; staff see Twilio’s immediate accept/reject result only.

## 3. Already required for staff login

Staff tools live at `/admin` (legacy `/clinic` URLs redirect there).

- `CLINIC_STAFF_EMAILS`
- `CLINIC_STAFF_COOKIE_SECRET` (required — dedicated secret; never reuse `SITE_PASSWORD`)
- `PUBLIC_SITE_URL` (canonical `https://…` origin for magic links and Stripe redirects in production)
- Google Workspace booking email config (magic-link delivery)

## 4. Testing

Use **fictional** patient records only until you are ready for real contacts.
