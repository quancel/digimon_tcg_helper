/**
 * Full card record as stored in public/data/cards.json.
 * Filled by the import script (scripts/), source still to be decided.
 */
export type CardColor = 'red' | 'blue' | 'yellow' | 'green' | 'black' | 'purple' | 'white'
export type CardKind = 'digi-egg' | 'digimon' | 'tamer' | 'option'

export interface DigivolveCondition {
  color: CardColor
  level: number
  cost: number
}

export interface Card {
  id: string // normalised card number, e.g. "BD01-002"
  name: string
  kind: CardKind
  colors: CardColor[]
  level?: number
  playCost?: number
  dp?: number
  digivolve: DigivolveCondition[]
  form?: string // e.g. "Rookie"
  attribute?: string // e.g. "Vaccine"
  traits: string[] // e.g. ["Lesser", "ALYSION"]
  effect: string
  inheritedEffect?: string
  securityEffect?: string
  keywords: string[] // extracted, e.g. ["Blocker", "Rush", "<Draw 1>"]
  rarity?: string
  set: string // e.g. "BD01"
  alysionExclusive: boolean
  released: boolean
  imageUrl: string // linked, not stored in the repo
  rulings?: { q: string; a: string; date?: string }[]
}

/**
 * Compact form sent to the AI. One short line per card keeps the context small, e.g.
 * "BD01-002|Gemmon|D|R|L3|C3|DP4000|ev:R2c1|Rookie|Vaccine|Lesser,ALYSION|<eff>|inh:<inh>"
 * The AI gets only the cards relevant to a question (pre-filtered by the synergy engine),
 * never the whole database.
 */
export type CompactCard = string
