# Security Reference

This document covers every security control in the application, what it protects against, and what you must do yourself before going to production.

---

## Controls already in place

| Layer | Control | What it prevents |
|---|---|---|
| **Transport** | httpOnly + Secure cookie | XSS can't steal the session token |
| **Transport** | sameSite: 'none' | CSRF on cross-site subresource requests |
| **Transport** | helmet (HSTS, X-Frame-Options, no-sniff, referrer) | Clickjacking, MIME-sniffing, downgrade attacks |
| **Auth** | bcrypt (cost 12) for passwords | Password-database dump doesn't expose plaintext |
| **Auth** | Account lockout after 8 failures, 15 min | Online brute-force |
| **Auth** | Tighter rate limit on `/api/auth` (15 req/15 min) | Credential-stuffing |
| **Auth** | JWT expiry (7 days) + server-side user refetch | Token stays valid after account deletion only for <7 d |
| **Auth** | Generic 401 on any auth failure | Username-enumeration oracle |
| **Input** | express-mongo-sanitize | MongoDB operator injection (`$where`, `$gt` etc.) |
| **Input** | All string fields trimmed + length-capped in routes | Oversized payload DoS |
| **Input** | `express.json({ limit: '100kb' })` | Request-body memory exhaustion |
| **Input** | hpp (HTTP parameter pollution) | Parameter override attacks |
| **Input** | Enum validation on all enum fields | Unexpected values reaching Mongoose |
| **Input** | Date format regex (`/^\d{4}-\d{2}-\d{2}$/`) | Date injection / NaN surprises |
| **Input** | Amount > 0 and ≤ 1 billion check | Negative-balance exploits, overflow |
| **Input** | Color validated as `#RRGGBB` hex | CSS injection through color fields |
| **Input** | Account-ID ownership verified before linking | IDOR (user A linking user B's account) |
| **DB** | `strictQuery: true` + `strict: true` | Unknown fields silently stored |
| **DB** | `w: 'majority', journal: true` | Write loss on primary failover |
| **DB** | Connection retry with exponential back-off | Transient network blip dropping startup |
| **DB** | Graceful SIGTERM/SIGINT shutdown | In-flight write truncation on deploy/restart |
| **API** | General rate limit (300 req/15 min) | Scraping, light DoS |
| **API** | Write rate limit (100 mutations/15 min) | Rapid-fire mutation abuse |
| **Error** | Generic 500 message in production | Stack traces leaking file paths / library names |
| **CORS** | Explicit origin whitelist via `CLIENT_ORIGINS` env | Cross-origin API access |

---

## What you MUST add before production

### 1. TLS / HTTPS
Use a reverse proxy (nginx, Caddy) or your hosting provider's built-in TLS. Never expose the Node server on port 4000 directly to the internet.

### 2. MongoDB access control
- Create a dedicated DB user with **readWrite** on your database only — not admin.
- Enable **Atlas IP allowlist** (add only your server's IP, not 0.0.0.0/0).
- Enable **Atlas auditing** (free on M10+) for a write audit log.

### 3. Automated backups
Atlas free tier (M0) does NOT provide point-in-time restore. Options:
- Upgrade to M10+ for continuous backups.
- **Or** run a nightly `mongodump` cron and upload to S3/GCS (free).

Quick nightly backup script:
```bash
#!/bin/bash
mongodump --uri "$MONGODB_URI" --out /tmp/backup/$(date +%F)
# Then: aws s3 sync /tmp/backup s3://your-bucket/mongo-backups/
```

### 4. Secrets management
`.env` in the filesystem is readable by anyone with shell access. In production, use:
- Azure Key Vault / AWS Secrets Manager / GCP Secret Manager
- Or at minimum: systemd `EnvironmentFile` with `chmod 600`

### 5. Dependency updates
```bash
cd backend && npm audit
cd frontend && npm audit
```
Run monthly or set up Dependabot on GitHub.

### 6. Monitor logs
Forward your server logs to a log aggregator (Papertrail, Logtail, Datadog) so you're notified of repeated auth failures or 500 errors.

---

## Data you should never store (already enforced)
- Account numbers, card numbers, PAN, Aadhaar — none of these are in the schema
- Plaintext passwords — bcrypt-hashed only
- Third-party API keys — env-only, not in the database

