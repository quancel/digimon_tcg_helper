import type { Card } from '../types/card'

/**
 * Rule-based synergy engine. It does the cheap, exact part of the analysis
 * (which cards reference each other) so that only a small, relevant slice of
 * the database has to be sent to the AI.
 */

export interface Synergy {
  card: Card
  score: number
  reasons: string[]
}

// Traits so common that sharing them says little on their own.
const WEAK_TRAITS = new Set(['ALYSION'])

const text = (c: Card) => [c.effect, c.inheritedEffect, c.securityEffect].filter(Boolean).join(' ')

/** Names and traits a card's text refers to, e.g. "[Gemmon]" or "[ALYSION] trait". */
function references(c: Card) {
  const t = text(c)
  const names = new Set<string>()
  const traits = new Set<string>()
  for (const m of t.matchAll(/\[([^\]]+)\](\s+trait)?/g)) {
    if (m[2]) traits.add(m[1])
    else names.add(m[1])
  }
  return { names, traits }
}

function mentions(refs: Set<string>, name: string) {
  for (const r of refs) if (name.includes(r)) return r
  return null
}

export function findSynergies(focus: Card, cards: Card[], limit = 40): Synergy[] {
  const fRefs = references(focus)
  const out: Synergy[] = []
  for (const c of cards) {
    if (c.id === focus.id) continue
    const reasons: string[] = []
    let score = 0
    const cRefs = references(c)

    const n1 = mentions(fRefs.names, c.name)
    if (n1) { score += 5; reasons.push(`${focus.name} nennt [${n1}]`) }
    const n2 = mentions(cRefs.names, focus.name)
    if (n2) { score += 5; reasons.push(`nennt [${n2}]`) }
    for (const t of c.traits) if (fRefs.traits.has(t)) { score += WEAK_TRAITS.has(t) ? 2 : 4; reasons.push(`hat Eigenschaft ${t}, die ${focus.name} nutzt`) }
    for (const t of focus.traits) if (cRefs.traits.has(t)) { score += WEAK_TRAITS.has(t) ? 2 : 4; reasons.push(`unterstützt Eigenschaft ${t}`) }

    // Evolution line: same colour, one level apart, and a digivolve condition that fits.
    const sharedColor = c.colors.some((x) => focus.colors.includes(x))
    if (sharedColor && c.level != null && focus.level != null) {
      if (c.level === focus.level - 1 && focus.digivolve.some((d) => c.colors.includes(d.color) && d.level === c.level)) {
        score += 3; reasons.push(`kann zu ${focus.name} digitieren`)
      }
      if (c.level === focus.level + 1 && c.digivolve.some((d) => focus.colors.includes(d.color) && d.level === focus.level)) {
        score += 3; reasons.push(`${focus.name} kann hierzu digitieren`)
      }
    }
    const sharedTraits = c.traits.filter((t) => focus.traits.includes(t) && !WEAK_TRAITS.has(t))
    if (sharedTraits.length) { score += 1.5 * sharedTraits.length; reasons.push(`gleiche Eigenschaft ${sharedTraits.join(', ')}`) }
    if (sharedColor && (c.kind === 'tamer' || c.kind === 'option') && score > 0) score += 1

    if (score > 0) out.push({ card: c, score, reasons: [...new Set(reasons)] })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * One short line per card for the AI. Field order:
 * id|name|type|colors|Lv|cost|DP|digivolve|form|attribute|traits|effect|inherited|security
 * Empty fields are kept as "" so positions stay stable; the legend is in the system prompt.
 */
const colorCode = (x: string) => (x === 'black' ? 'Bk' : x[0]?.toUpperCase() ?? '')

export function toCompact(c: Card): string {
  const k = { 'digi-egg': 'E', digimon: 'D', tamer: 'T', option: 'O', 'digimon-option': 'DO' }[c.kind] ?? c.kind
  const col = c.colors.map(colorCode).join('')
  const dv = c.digivolve.map((d) => `${colorCode(d.color)}${d.level}c${d.cost}`).join(',')
  return [
    c.id, c.name, k, col,
    c.level ?? '', c.playCost ?? '', c.dp ?? '', dv,
    c.form ?? '', c.attribute ?? '', c.traits.join(','),
    c.effect, c.inheritedEffect ?? '', c.securityEffect ?? '',
  ].join('|').replace(/\|+$/, '')
}
