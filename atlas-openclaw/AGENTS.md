# AGENTS — FUZE Atlas Operational Procedures

## Session Startup
1. Read CLAUDE.md for brand rules, product info, platform context, wish list
2. Read memory/glossary.md for full terminology decoder
3. Check git status — are there unpushed commits? Is dev synced with main?
4. Identify: you are in fuzeatlas = fuzeatlas.com (Vercel + Railway PostgreSQL + S3)

## Critical Brand Language Rules
| NEVER say | ALWAYS say |
|-----------|------------|
| silver | FUZE |
| nanoparticle(s) | metamaterial |
| nano | metamaterial |
| silver nanoparticles | FUZE metamaterial |

Exception: Technical/compliance docs (CIL, ARSL, SDS) may use chemical names.

## Deployment Workflow — fuzeatlas (Vercel)
### THE LAW: Dev First, Then Main
1. `git checkout dev`
2. Make changes, commit
3. `git push origin dev` — Vercel auto-deploys preview URL
4. Verify on preview URL (fuzeatlas-git-dev-*.vercel.app)
5. `git checkout main && git merge dev && git push origin main`
6. Verify on production (fuzeatlas.com)
7. NEVER skip the dev verification step

### Pre-commit Hook
- Husky + lint-staged configured but eslint may fail (ENOENT)
- Use `--no-verify` if eslint is not installed locally
- `npm install` first to get local eslint

## Tech Stack
- Next.js 15.5 / Prisma 6.19.2 / PostgreSQL (Railway) / Vercel
- S3 for document/file storage (bucket in us-east-2)
- AWS credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
- CSP header in next.config.ts line 38 — must include S3 domains
- Database: caboose.proxy.rlwy.net:28355 (Railway PostgreSQL)

## Prisma
- Schema: `prisma/schema.prisma`
- ALWAYS use local prisma: `npx prisma db push --schema prisma/schema.prisma`
- NEVER let npx install prisma 7.x — project uses 6.19.2
- If `node_modules` missing: `npm install` first
- Prisma 7.x breaks the schema (url in datasource no longer supported)

## Portal Architecture
| Portal | Route | Users | Key Pages |
|--------|-------|-------|-----------|
| Admin | /dashboard, /brands, /fabrics, /tests, /labs, /settings | FUZE team | Full access to everything |
| Brand | /brand-portal/* | Brand contacts (Toray, Rhone, etc.) | Dashboard, Fabrics, Submissions, Tests, Request Testing |
| Factory | /factory-portal/* | Factory contacts | Dashboard, Fabrics, Submit Fabric, Request Testing, Sample Trials |
| Lab | /lab-portal/* | Lab staff | Dashboard, Requests, Service Catalog, Profile, Forms |

## API Routes (Critical)
- Auth: /api/auth/login, /api/auth/me, /api/auth/register
- Fabrics: /api/fabrics, /api/fabrics/[id], /api/fabric-library
- Tests: /api/tests, /api/test-requests, /api/tests/upload
- Brands: /api/brands, /api/brand-portal
- Labs: /api/labs, /api/lab-portal
- Upload: /api/compliance-docs/upload-url (needs S3 + CSP whitelist)
- Dashboard: /api/dashboard (heavy query — uses caching)

## Middleware (src/middleware.ts)
- Routes external users (brand/factory/lab) to their portal
- Whitelists specific paths for external access (fabrics, intake, test-request)
- EXTERNAL_ALLOWED_PATHS must be updated when adding new external-facing routes

## Known Issues & Fixes
- **CSP blocking S3**: next.config.ts connect-src must include `*.s3.us-east-2.amazonaws.com`
- **Git lock files**: `rm -f .git/HEAD.lock .git/index.lock` before commits
- **Prisma version mismatch**: Always `npm install` before `npx prisma` commands
- **Upload "failed to fetch"**: Usually CSP or S3 credential issue, not server error

## Wish List (Priority Order)
1. **Environmental Impact Reports for Brands (ESG)** — HIGHEST PRIORITY
2. **Consumption & Reorder Dashboard**
3. **Competitive Intelligence Dashboard (EPA Scraping)**
4. **Real-Time Test Tracking (FedEx-style)**
5. **AI Test Interpretation at Scale**
6. **Brand Self-Service QR Verification**
7. **Factory Performance Scoring**
8. **API for Brand PLM Integration**

## User Accounts to Manage
- Akio: role change needed
- Yamada/Miyazaki: password resend
- Hubert/Steve Savage: deletion
- Two lab applicants: pending approval

## Competitive Intelligence
- Stage 1: COMPLETE (v2 document with EPA genealogy, HeiQ/Noble teardowns)
- Stage 2: Bio-based comparison — PENDING
- Competitors: NordShield, Noble, Microban, Sciessent, Sanitized AG, Ultra-Fresh, BioPrism, Aegis, Silvadur, HeiQ
