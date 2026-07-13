# Vantage — Personal Finance App

A private, full-stack personal finance tracker: net worth with history
snapshots, holdings with automatic end-of-day price updates, liabilities,
allocation targets, daily spends (kept fully separate from investments),
insurance with renewal reminders, a rule-based Buy/Sell/Hold checklist, a
financial health check, goals, cross-cutting insights, and CSV export.
Email + password or Google sign-in. Your own MongoDB, your own credentials —
nothing is shared with any third party by this code.

```
vantage-app/
  backend/   Express API + MongoDB (Mongoose), auth, cron jobs, email, price sync
  frontend/  Next.js app (App Router) that talks to the backend over HTTP
```

## 1. Prerequisites

- Node.js 18+
- A MongoDB database — local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- An SMTP account for email — optional, only for month-end/deadline reminders
- A Google Cloud OAuth client — optional, only for "Continue with Google"

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Change the values marked `REPLACE_WITH...` in `.env`. At minimum:

| Variable | What to put there |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A long random string — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | Your SMTP provider (optional) |
| `GOOGLE_CLIENT_ID/CLIENT_SECRET/CALLBACK_URL` | From Google Cloud Console (optional — see §7) |

```bash
npm run dev   # or: npm start
```

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`, register (or continue with Google, if configured), and go.

## 4. How automatic price updates work

No public Google Finance API exists, so this uses two free, keyless sources tested to actually work:

- **Stocks** → Yahoo Finance. Paste exactly what Google shows you under the name — `NSE:GOLDBEES`, `DATAPATTNS`, `TCS.NS`, whatever — it's normalized automatically.
- **Mutual funds** → [mfapi.in](https://www.mfapi.in) (AMFI's data, served reliably — AMFI's own raw file was flaky in testing). Usually leave the symbol blank; it's matched by fund name and the resolved scheme code is cached for future syncs. Or type an exact AMFI scheme code yourself.
- **Gold** → no free reliable source exists; stays manual.

Every eligible holding refreshes once a day (20:30 server time), or hit the refresh icon next to any holding for an immediate sync.

## 5. Feature map

| Feature | Where |
|---|---|
| Auto price/NAV sync | Wealth → Holdings |
| Net worth snapshots over time | Wealth → Net Worth → "Take snapshot" |
| Liabilities (loans/debts) | Wealth → Liabilities |
| CSV export (holdings, transactions, spends by month/year/all) | Wealth → Holdings/Transactions, Money |
| Edit transactions, daily spends, insurance policies | Pencil icon on each row/card |
| Delete confirmations | Every delete action now asks first |
| Daily Spends kept separate from investments | Money = spends only; Wealth = everything investment-related |
| **Insights** — portfolio gainers/losers, spend trend & month-over-month change, allocation drift, net worth trend | More → Insights |
| Hide/eye toggle | Top bar — masks amounts everywhere (including editable fields, which switch to view-only) except Overview's Daily Spends |
| Financial health check (emergency fund, savings rate, FI estimate, recommended cover, debt ratio) | More → Health Check |
| Date of birth → age & years-to-retirement | More → Health Check |
| Goals — edit, mark achieved (locks in the date & net worth reached), reopen, view completed history | More → Goals |
| Change / set password | More → Settings |
| Google sign-in, with a one-time prompt to also set a password | Login/Register pages; prompt shown automatically after first Google sign-in |
| Month-end email (spend + P/L only, no balance) | Automatic |
| Insurance/deadline reminders (60 days out) | Automatic |
| Weekly auto-logout | Enforced server-side via 7-day JWT expiry |

## 6. Security

Implemented: bcrypt password hashing (optional for Google-only accounts until they set one), JWT in an httpOnly/`secure` cookie, login lockout after repeated failures, `helmet` headers, MongoDB-injection sanitization, rate limiting (tighter on auth routes), CORS locked to `CLIENT_ORIGINS`, generic login error messages.

Not covered — add these yourself before real financial data goes on the public internet: a real secrets manager instead of `.env` files, dependency updates, database backups. No configuration makes an app "unhackable" — this is a solid, conventional baseline, not a guarantee.

## 7. Setting up Google Sign-In (optional)

1. [Google Cloud Console](https://console.cloud.google.com) → create/select a project → **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI: `<your backend URL>/api/auth/google/callback` (e.g. `https://your-backend.azurewebsites.net/api/auth/google/callback`).
4. Copy the Client ID and Client Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_CALLBACK_URL` to the same redirect URI. Set `FRONTEND_URL` to your deployed frontend's URL.
5. This is free — no billing required for this use.

Leave these as the placeholder values and the "Continue with Google" button simply won't appear — email/password still works fine either way.

## 8. Deploying these changes to your existing Azure + Vercel setup

You already have `backend` on Azure App Service and `frontend` on Vercel. To ship this update:

**Backend (Azure):**
1. Commit and push the updated `backend/` code to whatever git repo Azure is deploying from (or redeploy via `az webapp deploy` / zip deploy if you're not using git-based deploys). Azure runs `npm install` automatically on deploy for Node apps, which will pull in the new `google-auth-library` dependency.
2. In **Azure Portal → your App Service → Configuration → Application settings**, make sure these exist (add/update as needed):
   - `NODE_ENV=production` — **this is the critical one**: it's what makes the cookie fix from this update actually take effect (`sameSite: 'none'` only applies when `NODE_ENV=production`). Without it your original 401-after-login bug comes right back.
   - `CLIENT_ORIGINS=https://finance-tracker-sand-nine.vercel.app` (your real Vercel URL, no trailing slash)
   - `FRONTEND_URL=https://finance-tracker-sand-nine.vercel.app`
   - `MONGODB_URI`, `JWT_SECRET` (should already be set)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` if you're turning on Google sign-in (§7) — otherwise leave unset and that button just won't show.
3. **Restart the App Service** (Configuration changes require this to take effect).
4. In your browser, clear cookies for your Vercel domain (the old `SameSite=Lax` cookie won't self-correct) and log in again.

**Frontend (Vercel):**
1. Commit and push the updated `frontend/` code to the repo Vercel is watching — it redeploys automatically.
2. No new environment variables are required unless your backend URL changed; `NEXT_PUBLIC_API_URL` should already point at your Azure backend.

**Afterwards, confirm:**
- Log in, refresh the page — you should stay logged in (this was the original bug).
- Wealth tab looks right on mobile (stat cards, Holdings current-rate field, "Add asset" button all fixed).
- If you configured Google sign-in, test the full flow once from an incognito window.

## 9. Known simplifications

- Records live as embedded arrays on the `User` document rather than separate collections — simple, fine for personal data volumes.
- Editing a past transaction's quantity/price does **not** retroactively recompute the holding's average rate. Delete and re-add if a correction should change your consolidated average.
- Mutual fund name-matching (mfapi.in search) is cached in memory per server process. If a fund's name search picks the wrong scheme (regular vs. direct plan), type the exact AMFI scheme code into the symbol field to override it.
- Health Check numbers (emergency fund, savings rate) are computed only from months that actually have logged expenses — an empty month no longer silently drags the average down.
