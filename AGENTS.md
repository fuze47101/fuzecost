# AGENTS — fuzecost Operational Procedures

## Session Startup
1. Read CLAUDE.md for brand rules, product info, platform context, wish list
2. Read memory/glossary.md for full terminology decoder
3. Check git status — are there unpushed commits?
4. Identify which repo you are in: fuzecost = fuzefaq.com (Railway)

## Critical Brand Language Rules
| NEVER say | ALWAYS say |
|-----------|------------|
| silver | FUZE |
| nanoparticle(s) | metamaterial |
| nano | metamaterial |
| silver nanoparticles | FUZE metamaterial |
| silver nanoparticle technology | FUZE metamaterial technology |

Exception: Technical/compliance docs (CIL, ARSL, SDS) may use chemical names.

## Deployment Workflow — fuzecost (Railway)
1. Make changes locally
2. `git add` specific files (never `git add .`)
3. `git commit -m "descriptive message"`
4. `git push origin main` — Railway auto-deploys
5. Hard refresh fuzefaq.com (Cmd+Shift+R) to verify

## File Locations
- Public HTML pages: `public/index.html`, `public/sustainability.html`, `public/competitors.html`
- Next.js route redirects: `src/app/*/page.tsx`
- Calculator formulas: `src/lib/calc.ts` (SOURCE OF TRUTH)
- Logo: `public/fuze-logo.jpg` (nav), `public/fuze-logo-full.png` (hero, removed)
- Memory: `CLAUDE.md` (root), `memory/glossary.md`

## Calculator Constants (from calc.ts)
- Stock concentration: 30 mg/L
- Bottle size: 19 L
- Default FUZE Price: $36/L
- Default GSM: 150, Width: 60 inches
- Tiers: F1=1.0, F2=0.75, F3=0.5, F4=0.25 mg/kg

## Pages & Nav Structure
All pages must have matching:
- White nav bar with bigger logo (64px)
- Dark text links (slate-600)
- "Other Products" link
- "Try FUZE Atlas — Free" CTA button
- Consistent styling across index, sustainability, competitors

## DO NOT
- Push to fuzeatlas repo from this workspace
- Use dark nav (we switched to white)
- Include "20 ppm" in hero text
- Show purity stats banner (removed)
- Use the hero logo (removed — nav logo only)

## Wish List (Priority Order)
1. Environmental Impact Reports for Brands (ESG) — HIGHEST PRIORITY
2. Consumption & Reorder Dashboard
3. Competitive Intelligence Dashboard (EPA Scraping)
4. Real-Time Test Tracking (FedEx-style)
5. AI Test Interpretation at Scale
6. Brand Self-Service QR Verification
7. Factory Performance Scoring
8. API for Brand PLM Integration

## Competitive Intelligence Project
- Stage 1: COMPLETE — v2 document delivered
- Stage 2: Bio-based antimicrobial comparison (chitosan, etc.) — PENDING
- Target competitors: NordShield, Noble Biometal, Microban, Sciessent, Sanitized AG, Ultra-Fresh, BioPrism, Aegis, Silvadur, HeiQ
