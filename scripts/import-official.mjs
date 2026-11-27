// Imports the Digimon Alysion card pool from the official Bandai card list
// (world.digimoncard.com) into public/data/cards.json.
//
// Usage:
//   node scripts/import-official.mjs              fetch all categories in the Alysion pool
//   node scripts/import-official.mjs --fixture f  parse a saved HTML page instead (for testing)
//
// Card images are linked, never downloaded. Requests are made one at a time with a pause.
import * as cheerio from 'cheerio'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const BASE = 'https://world.digimoncard.com/cards/'
const UA = 'digimon-alysion-helper (private fan tool; github.com/quancel/digimon_tcg_helper)'
const OUT = 'public/data/cards.json'

// Official categories whose cards are legal in Digimon Alysion.
// Source: aegis-digimon-tcg Alysion format (BT1-BT4, ST1-ST13 without ST11, BD, SD, ED, promos).
const CATEGORIES = [
  522001, 522002, 522003, // BT1-BT3 (Ver.1.0, Ver.1.5), BT4
  522101, 522102, 522103, 522104, 522105, 522106, 522107, 522108, 522109, 522110, 522112, 522113, // ST1-ST13
  522125, 522126, // ST-25, ST-26 (Alysion starter decks, also contain BD/SD/ED cards)
  522901, // P-numbered promos
]
// Card-number prefixes in the Alysion pool. Anything else found in a category is dropped.
const POOL = /^(BT0?[1-4]|ST0?([1-9]|1[0-3])|ST2[56]|BD\d+|SD\d+|ED\d+|P)-/

const COLORS = ['red', 'blue', 'yellow', 'green', 'black', 'purple', 'white']
const KINDS = { 'Digi-Egg': 'digi-egg', Digimon: 'digimon', Tamer: 'tamer', Option: 'option', 'Digimon/Option': 'digimon-option' }

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

export function parseCardList(html) {
  const $ = cheerio.load(html)
  const cards = []
  $('li.image_lists_item .popupCol').each((_, el) => {
    const $c = $(el)
    $c.find('br').replaceWith(' ')
    const fields = {}
    $c.find('dl.cardInfoBox').each((_, dl) => {
      const key = clean($(dl).children('dt').first().text())
      if (key) fields[key] = $(dl).children('dd').first()
    })
    const texts = {}
    $c.find('dl.cardInfoBoxSmall').each((_, dl) => {
      const key = clean($(dl).find('dt').text()).replace(/^\[|\]$/g, '')
      const $dd = $(dl).find('dd')
      $dd.find('br').replaceWith(' ')
      texts[key] = clean($dd.text())
    })
    const id = clean($c.find('li.cardNo').text())
    const img = $c.find('.cardImg img').attr('src') ?? ''
    const imageFile = img.split('/').pop()?.split('?')[0] ?? ''
    const variant = imageFile.replace(/\.png$/, '').slice(id.length) // "" or "_P1"
    const kindRaw = clean($c.find('li.cardType').text())
    const lv = clean($c.find('li.cardLv').text()).match(/\d+/)
    const num = (k) => {
      const v = fields[k] && clean(fields[k].text())
      return v && /^\d+$/.test(v) ? Number(v) : undefined
    }
    const digivolve = Object.keys(fields)
      .filter((k) => k.startsWith('Digivolve Cost'))
      .map((k) => {
        const $dd = fields[k]
        const color = clean($dd.find('span').first().text()).toLowerCase()
        const m = clean($dd.text()).match(/(\d+)\s+from\s+Lv\.(\d+)/)
        return m ? { color, cost: Number(m[1]), level: Number(m[2]) } : null
      })
      .filter(Boolean)
    const colors = fields.Color
      ? fields.Color.find('span').map((_, s) => clean($(s).text()).toLowerCase()).get().filter((c) => COLORS.includes(c))
      : []
    const traits = fields.Type ? clean(fields.Type.text()).split('/').map(clean).filter(Boolean) : []
    const effect = [texts['Special Digivolution Condition'], texts['Effect'], texts['DUAL Rule'], texts['DUAL Effect']]
      .filter(Boolean)
      .join('\n')
    const allText = [effect, texts['Inherited Effect'], texts['Security Effect']].join(' ')
    const keywords = [...new Set([...allText.matchAll(/[<＜]([^<>＜＞]+)[>＞]/g)].map((m) => m[1].replace(/\s+\d+$/, '')))]
    const rulings = $c
      .find('li.cardFaqListItem')
      .map((_, q) => ({
        id: clean($(q).find('.cardFaqNum').text()),
        date: clean($(q).find('.cardFaqDate').text()),
        q: clean($(q).find('.cardFaqQuestion').text()),
        a: clean($(q).find('.cardFaqAnswer').text()),
      }))
      .get()
    const set = id.split('-')[0]
    cards.push({
      id,
      variant,
      name: clean($c.find('.cardTitle').text()),
      kind: KINDS[kindRaw] ?? kindRaw.toLowerCase(),
      colors,
      level: lv ? Number(lv[0]) : undefined,
      playCost: num('Cost') ?? num('DUAL Cost'),
      dp: num('DP'),
      digivolve,
      form: fields.Form ? clean(fields.Form.text()) : undefined,
      attribute: fields.Attribute ? clean(fields.Attribute.text()) : undefined,
      traits,
      effect,
      inheritedEffect: texts['Inherited Effect'] || undefined,
      securityEffect: texts['Security Effect'] || undefined,
      keywords,
      rarity: clean($c.find('li.cardRarity').text()) || undefined,
      set,
      alysionExclusive: /^(BD|SD|ED)\d/.test(set),
      released: true,
      imageUrl: new URL(img, BASE).href,
      rulings: rulings.length ? rulings : undefined,
      source: 'official',
    })
  })
  return cards
}

// One entry per card number; alternative arts are kept as extra image URLs.
export function mergeVariants(cards) {
  const byId = new Map()
  for (const c of cards) {
    if (!POOL.test(c.id)) continue
    const existing = byId.get(c.id)
    if (!existing) {
      byId.set(c.id, { ...c, altArts: [] })
    } else if (c.variant && !existing.altArts.includes(c.imageUrl)) {
      existing.altArts.push(c.imageUrl)
    } else if (!c.variant && existing.variant) {
      byId.set(c.id, { ...c, altArts: [...existing.altArts, existing.imageUrl] })
    }
  }
  return [...byId.values()]
    .map(({ variant, ...c }) => ({ ...c, altArts: c.altArts.length ? c.altArts : undefined }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
}

async function fetchCategory(id) {
  const res = await fetch(`${BASE}?search=true&category=${id}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`category ${id}: HTTP ${res.status}`)
  return res.text()
}

async function main() {
  const args = process.argv.slice(2)
  let raw = []
  if (args[0] === '--fixture') {
    raw = parseCardList(await readFile(args[1], 'utf8'))
  } else {
    for (const cat of CATEGORIES) {
      const cards = parseCardList(await fetchCategory(cat))
      console.log(`category ${cat}: ${cards.length} entries`)
      raw.push(...cards)
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  const cards = mergeVariants(raw)
  if (cards.length === 0) throw new Error('No cards parsed, the page layout may have changed')
  await mkdir('public/data', { recursive: true })
  await writeFile(OUT, JSON.stringify(cards, null, 1) + '\n')
  const bySet = {}
  for (const c of cards) bySet[c.set] = (bySet[c.set] ?? 0) + 1
  console.log(`${cards.length} cards written to ${OUT}`, bySet)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1) })
