import { useEffect, useState } from 'react'
import type { Card } from '../types/card'

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useCards() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const fromRepo = () =>
      fetch(`${import.meta.env.BASE_URL}data/cards.json`).then((r) =>
        r.ok ? (r.json() as Promise<Card[]>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
    // Full Alysion pool from Supabase when configured, otherwise the official list in the repo.
    const fromSupabase = async (): Promise<Card[]> => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/cards?select=data&order=id`, {
        headers: { apikey: SUPABASE_KEY!, authorization: `Bearer ${SUPABASE_KEY}` },
      })
      if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`)
      const rows: { data: Card }[] = await r.json()
      if (rows.length === 0) throw new Error('Supabase table is empty')
      return rows.map((x) => x.data)
    }
    ;(SUPABASE_URL && SUPABASE_KEY ? fromSupabase().catch(fromRepo) : fromRepo())
      .then(setCards)
      .catch((e) => setError(String(e)))
  }, [])
  return { cards, error }
}

export interface Filters {
  text: string
  color: string
  kind: string
  level: string
  set: string
  trait: string
  keyword: string
}

export const emptyFilters: Filters = { text: '', color: '', kind: '', level: '', set: '', trait: '', keyword: '' }

export function filterCards(cards: Card[], f: Filters): Card[] {
  const q = f.text.trim().toLowerCase()
  return cards.filter(
    (c) =>
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.effect.toLowerCase().includes(q) ||
        (c.inheritedEffect ?? '').toLowerCase().includes(q)) &&
      (!f.color || c.colors.includes(f.color as Card['colors'][number])) &&
      (!f.kind || c.kind === f.kind) &&
      (!f.level || String(c.level ?? '') === f.level) &&
      (!f.set || c.set === f.set) &&
      (!f.trait || c.traits.includes(f.trait)) &&
      (!f.keyword || c.keywords.includes(f.keyword)),
  )
}

export function facets(cards: Card[]) {
  const uniq = (xs: (string | undefined)[]) =>
    [...new Set(xs.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  return {
    sets: uniq(cards.map((c) => c.set)),
    traits: uniq(cards.flatMap((c) => c.traits)),
    keywords: uniq(cards.flatMap((c) => c.keywords)),
    levels: uniq(cards.map((c) => (c.level != null ? String(c.level) : undefined))),
  }
}

export const KIND_LABEL: Record<string, string> = {
  'digi-egg': 'Digi-Ei',
  digimon: 'Digimon',
  tamer: 'Tamer',
  option: 'Option',
  'digimon-option': 'Digimon/Option',
}

export const COLOR_LABEL: Record<string, string> = {
  red: 'Rot', blue: 'Blau', yellow: 'Gelb', green: 'Grün', black: 'Schwarz', purple: 'Lila', white: 'Weiß',
}
