# Google OAuth Setup (Supabase + Next.js + Vercel)

This project uses Supabase Auth with client-side OAuth:

- `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
- Redirect target in app: `/login?next=...` (or `/login`)
- Post-auth route: `next` query param if present, otherwise `/today`

## 1. Supabase Auth Provider Setup

1. Open Supabase Dashboard -> `Authentication` -> `Providers` -> `Google`.
2. Enable Google provider.
3. Paste Google OAuth client credentials:
   - `Client ID`
   - `Client Secret`
4. Save.

## 2. Supabase URL Settings

Open Supabase Dashboard -> `Authentication` -> `URL Configuration`.

Set:

- `Site URL`
  - Local: `http://localhost:3000`
  - Production: your Vercel production URL (for example `https://your-app.vercel.app`)
- `Redirect URLs` (add all used app origins):
  - `http://localhost:3000/login`
  - `https://your-app.vercel.app/login`
  - `https://your-custom-domain.com/login` (if used)

## 3. Google Cloud Console Setup

In Google Cloud Console:

1. Create/select project.
2. Configure OAuth consent screen.
3. Create OAuth 2.0 Client ID (Web application).
4. Add **Authorized redirect URI**:
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

Use the generated Client ID/Secret in Supabase provider settings.

## 4. Environment Variables

Set these in local `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

Set the same variables in Vercel Project Settings -> `Environment Variables` for:

- Production
- Preview
- Development (optional, if you use Vercel dev environments)

Do not put service role keys in client code.

## 5. Local Flow Check

1. Run `npm run dev`.
2. Open `/login`.
3. Click `Continue with Google`.
4. Complete Google auth.
5. Confirm redirect back to app and active session in browser.
6. Confirm routing:
   - `/login?next=/some-path` -> `/some-path`
   - without `next` -> `/today`

## 6. Vercel Flow Check

1. Deploy to Vercel.
2. Confirm Vercel domain is listed in Supabase `Site URL` / `Redirect URLs`.
3. Repeat Google login flow from deployed URL.
4. Verify redirect + session behavior matches local.
