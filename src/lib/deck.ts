import { useEffect, useState } from 'react'
import type { Card } from '../types/card'

/** Deck rules. Taken from the Digimon Card Game; adjust here if Alysion differs. */
export const RULES = { mainSize: 50, maxEggs: 5, maxCopies: 4 }

export type Deck = { name: string; counts: Record<string, number> }

const KEY = 'alysion-deck-v1'

function load(): Deck {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* storage unavailable */
  }
  return { name: 'Neues Deck', counts: {} }
}

export function useDeck() {
  const [deck, setDeck] = useState<Deck>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(deck))
    } catch {
      /* storage unavailable */
    }
  }, [deck])
  const change = (id: string, delta: number) =>
    setDeck((d) => {
      const next = Math.max(0, Math.min(RULES.maxCopies, (d.counts[id] ?? 0) + delta))
      const counts = { ...d.counts }
      if (next === 0) delete counts[id]
      else counts[id] = next
      return { ...d, counts }
    })
  return { deck, setDeck, change }
}

export function analyseDeck(deck: Deck, byId: Map<string, Card>) {
  const entries = Object.entries(deck.counts)
    .map(([id, n]) => ({ card: byId.get(id), id, n }))
    .filter((e): e is { card: Card; id: string; n: number } => !!e.card)
  const eggs = entries.filter((e) => e.card.kind === 'digi-egg')
  const main = entries.filter((e) => e.card.kind !== 'digi-egg')
  const sum = (xs: typeof entries) => xs.reduce((s, e) => s + e.n, 0)
  const eggCount = sum(eggs)
  const mainCount = sum(main)
  const issues: string[] = []
  if (mainCount !== RULES.mainSize) issues.push(`Hauptdeck hat ${mainCount}/${RULES.mainSize} Karten`)
  if (eggCount > RULES.maxEggs) issues.push(`Zu viele Digi-Eier: ${eggCount}/${RULES.maxEggs}`)
  const curve: Record<string, number> = {}
  for (const e of main) {
    if (e.card.kind === 'digimon' || e.card.kind === 'digimon-option') {
      const k = e.card.level != null ? String(e.card.level) : '-'
      curve[k] = (curve[k] ?? 0) + e.n
    }
  }
  const colors: Record<string, number> = {}
  for (const e of entries) for (const c of e.card.colors) colors[c] = (colors[c] ?? 0) + e.n
  return { eggs, main, eggCount, mainCount, issues, curve, colors, valid: issues.length === 0 }
}

/** "4 BT1-010 Agumon" per line; also the import format. */
export function deckToText(deck: Deck, byId: Map<string, Card>) {
  return Object.entries(deck.counts)
    .map(([id, n]) => `${n} ${id} ${byId.get(id)?.name ?? ''}`.trim())
    .join('\n')
}

export function deckFromText(text: string, name = 'Importiertes Deck'): Deck {
  const counts: Record<string, number> = {}
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(\d+)\s*x?\s+([A-Z]+\d*-\d+)/i)
    if (m) counts[m[2].toUpperCase()] = Math.min(RULES.maxCopies, (counts[m[2].toUpperCase()] ?? 0) + Number(m[1]))
  }
  return { name, counts }
}
