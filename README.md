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
