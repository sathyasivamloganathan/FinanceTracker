# Finance Tracker — Personal Finance App

A private, full-stack personal finance tracker: net worth with history
snapshots, holdings with automatic end-of-day price updates, liabilities,
allocation targets, daily spends (kept fully separate from investments),
insurance/deadline reminders, a rule-based Buy/Sell/Hold checklist, a
financial health check, goals, and CSV export. Your own MongoDB, your own
email credentials — nothing is shared with any third party by this code.

```
Finance Tracker-app/
  backend/   Express API + MongoDB (Mongoose), auth, cron jobs, email, price sync
  frontend/  Next.js app (App Router) that talks to the backend over HTTP
```

## 1. Prerequisites

- Node.js 18+
- A MongoDB database — local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- An SMTP account for email — optional, only needed for month-end/deadline reminders

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Change the values marked `REPLACE_WITH...` in `.env`:

| Variable | What to put there |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A long random string — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `EMAIL_HOST` / `PORT` / `USER` / `PASS` / `FROM` | Your SMTP provider (Gmail needs an App Password, not your normal password) |

```bash
npm run dev   # or: npm start
```

Runs on `http://localhost:4000` by default. Missing email credentials just log a warning and skip sending — everything else works fine without them.

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`, register, and go.

## 4. How automatic price updates work

There's no public Google Finance API, so this uses two free, keyless sources that give you exactly what you asked for — an end-of-day price pulled in from a symbol, not a real-time feed:

- **Stocks** → Yahoo Finance's public quote endpoint. Paste exactly what Google's finance card shows you under the name — `NSE:GOLDBEES`, `DATAPATTNS`, `TCS`, `RELIANCE.NS`, whatever format — the backend normalizes it automatically (strips an `NSE:`/`BSE:` prefix, adds `.NS`/`.BO` if there's no suffix at all).
- **Mutual funds** → [mfapi.in](https://www.mfapi.in), a free, keyless API built specifically to serve AMFI's data reliably (AMFI's own raw file can be flaky to hit directly — confirmed in testing). Usually you don't need to enter a symbol at all: leave it blank and it's matched by the fund's **name** automatically, then the resolved AMFI scheme code is cached onto the holding so every sync after the first is a single direct, fast lookup. You can also type an exact AMFI scheme code (a plain number) yourself if you already know it.
- **Gold** → no free reliable keyless daily source exists, so it stays manual — update it in the Holdings table whenever you check a rate.

Every holding with a symbol gets refreshed automatically once a day (20:30 server time). You can also hit the small refresh icon next to any holding's price to sync it immediately instead of waiting. If a symbol fails to resolve, the row shows "Sync failed" with the reason — check the symbol format above. Leaving the symbol blank (or editing a holding to turn auto-sync off) keeps a rate fully manual, editable directly in the table at any time.

## 5. Feature map

| You asked for | Where it is |
|---|---|
| Auto NAV/price update from a symbol | Wealth → Holdings (see §4) |
| CSV export — holdings & transactions separately | Wealth → Holdings / Wealth → Transactions, "Export CSV" button |
| CSV export — daily spends, by month/year/all | Money → "Export" dropdown + CSV button |
| Edit transactions | Wealth → Transactions, pencil icon per row |
| Edit daily spends | Money → Daily Spends, pencil icon per row |
| Daily Spends and investments kept separate | Money = spends only; Wealth = holdings/transactions/allocation/advisor |
| Net worth snapshots over time (like Finboom) | Wealth → Net Worth → "Take snapshot" |
| Liabilities (loans/debts) | Wealth → Liabilities |
| Financial health check (emergency fund, savings rate, FI estimate, recommended cover, debt ratio) | More → Health Check |
| Goals | More → Goals |
| Hide/eye toggle | Top bar, masks amounts everywhere except Overview's Daily Spends widget |
| Month-end email (spend + P/L only) | Automatic, see backend `.env` for SMTP setup |
| Insurance/deadline reminders (60 days out) | Automatic |
| Weekly auto-logout | Enforced server-side via 7-day JWT expiry |

## 6. Security — what's covered and what isn't

Implemented: bcrypt password hashing, JWT in an httpOnly/sameSite cookie, login lockout after repeated failures, `helmet` headers, MongoDB-injection sanitization, rate limiting (tighter on auth routes), CORS locked to `CLIENT_ORIGINS`, generic login error messages.

Not covered — add these before putting real financial data on the public internet: TLS/HTTPS in front of it, a real secrets manager instead of a plain `.env` file, dependency updates, database backups. No configuration makes an application "unhackable" — this is a solid, conventional baseline, not a guarantee.

> **Different domains for frontend/backend in production?** Change `sameSite` from `'lax'` to `'none'` in `backend/src/routes/auth.routes.js`'s `cookieOptions()` and keep `secure: true` (requires HTTPS both sides).

## 7. Known simplifications

- Records live as embedded arrays on the `User` document rather than separate collections — simple, and plenty for personal data volumes. Split into their own collections keyed by `userId` if this ever needs heavy multi-user scale.
- Editing a past transaction's quantity/price does **not** retroactively recompute the holding's average rate. Delete and re-add if a correction should change your consolidated average.
- Mutual fund name-matching (mfapi.in search) is cached in memory per server process — the first sync for a new fund does a search, every sync after that is a direct scheme-code lookup. If a fund's name search picks the wrong scheme (e.g. regular vs. direct plan), type the exact AMFI scheme code into the symbol field to override it.
- Health Check numbers (emergency fund, savings rate) are computed from your last 3 months of logged expenses — log spends consistently for these to be meaningful.
