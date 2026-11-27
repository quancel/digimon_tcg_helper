# Digimon Alysion Deckbuilder

Private PWA for the Digimon Alysion online TCG: a complete card database, a deckbuilder and
AI-assisted deck analysis ("which cards fit Digimon X and why", anti-meta, new-card ratings).

Unofficial fan project, not affiliated with BANDAI. Card images and texts © BANDAI.
Images are linked, not stored in this repository.

## Plan

1. **Card database:** an import script (GitHub Action) fetches all cards into `public/data/cards.json`.
2. **PWA:** card search with filters and a deckbuilder with rule checks. Hosted on GitHub Pages, no login.
3. **Analysis:** a synergy engine (traits, keywords, evolution lines, curves) pre-filters cards; only
   the relevant cards go to Claude in a compact one-line format. The API key lives in a
   Supabase Edge Function, never in the browser.
4. **Meta and launch:** meta-deck data and an ad slot for a possible public launch.

## Development

```bash
npm install
npm run dev
```

## AI analysis setup

The API key never reaches the browser. It lives in a Supabase Edge Function:

```bash
supabase functions deploy analyze --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGIN=https://quancel.github.io
```

Then add two repository variables (Settings → Secrets and variables → Actions → Variables):
`VITE_ANALYZE_URL` (the function URL) and `VITE_SUPABASE_ANON_KEY` (the project's publishable key).

The synergy engine (`src/lib/synergy.ts`) pre-filters up to 40 relevant cards and sends them
in a one-line format, so a request stays at a few thousand tokens.
