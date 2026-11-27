// Builds the full Digimon Alysion card pool from alysion.gg (data from the game files)
// and merges in the official Bandai data (public/data/cards.json) where a card exists there.
//
// alysion.gg decides WHICH cards exist in Alysion and their in-game stats.
// The official list adds rulings, structured digivolve costs and alternative arts.
//
// The result is NOT committed to the public repo. With SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set it is uploaded to the Supabase table "cards";
// otherwise it is written to .private/cards-full.json (git-ignored).
import * as cheerio from 'cheerio'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const BASE = 'https://alysion.gg'
const UA = 'digimon-alysion-helper (private deckbuilder)'
const COLORS = ['red', 'blue', 'yellow', 'green', 'black', 'purple', 'white']
const KINDS = { 'Digi-Egg': 'digi-egg', Digimon: 'digimon', Tamer: 'tamer', Option: 'option' }
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

/** alysion.gg "BD1-002" -> official "BD01-02"; BT/ST/P numbers stay as they are. */
export function normaliseId(id) {
  const m = id.match(/^(BD|SD|ED)0?(\d+)-0?(\d+)$/)
  return m ? `${m[1]}${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : id
}

/** Card text HTML -> official-style plain text: <strong>On Play</strong> -> [On Play], keywords -> ＜Blocker＞. */
export function htmlToText(html) {
  if (!html || html === '–') return ''
  const $ = cheerio.load(`<div>${html}</div>`)
  $('br').replaceWith('\n')
  $('p').each((_, p) => { $(p).append('\n') })
  $('strong').each((_, s) => {
    const t = clean($(s).text())
    const timing = /^(On Play|When Digivolving|When Attacking|On Deletion|Your Turn|Opponent's Turn|All Turns|Main|Security|Start of Your Turn|End of Your Turn|Start of Your Main Phase|End of Opponent's Turn|Counter|Hand|Breeding|Once Per Turn|Twice Per Turn|When Moving|End of Attack|When Linking|On Link)/i
    $(s).replaceWith(timing.test(t) ? `[${t}]` : `＜${t}＞`)
  })
  return $('div').text().split('\n').map(clean).filter(Boolean).join('\n')
}

export function parseList(html) {
  const $ = cheerio.load(html)
  const rows = new Map()
  $('article.card-cell').each((_, el) => {
    const $a = $(el)
    const link = $a.find('a.card-frame')
    const rawId = link.attr('data-card-tip')
    if (!rawId) return
    rows.set(rawId, {
      colors: ($a.attr('data-colors') ?? '').split(/[|,\s]+/).map((c) => c.toLowerCase()).filter((c) => COLORS.includes(c)),
      type: $a.attr('data-type'),
      level: $a.attr('data-level'),
      rarity: $a.attr('data-rarity'),
      set: $a.attr('data-set'),
      pack: $a.attr('data-pack'),
      exclusive: $a.attr('data-origin') === 'Alysion exclusive',
      released: $a.attr('data-availability') === 'In the game',
      traits: ($a.attr('data-traits') ?? '').split('|').map(clean).filter(Boolean),
      image: new URL(link.find('img').attr('src') ?? '', BASE).href,
      page: new URL(link.attr('href') ?? '', BASE).href,
    })
  })
  return rows
}

/** "Lv.6 · Play cost 12 · 11,000 DP · Digivolve 4 from Blue Lv.5" */
export function parseStats(stats, fallbackColor) {
  const out = { digivolve: [] }
  for (const part of (stats ?? '').split('·').map(clean)) {
    let m
    if ((m = part.match(/^Lv\.(\d+)/))) out.level = Number(m[1])
    else if ((m = part.match(/^Play cost (\d+)/i))) out.playCost = Number(m[1])
    else if ((m = part.match(/^Use cost (\d+)/i))) out.playCost = Number(m[1])
    else if ((m = part.match(/^([\d,]+) DP/))) out.dp = Number(m[1].replace(/,/g, ''))
    else if ((m = part.match(/^Digivolve (\d+) from (\w+) Lv\.(\d+)/i)))
      out.digivolve.push({ cost: Number(m[1]), color: m[2].toLowerCase(), level: Number(m[3]) })
    else if ((m = part.match(/^Digivolve (\d+) from Lv\.(\d+)/i)))
      out.digivolve.push({ cost: Number(m[1]), color: fallbackColor, level: Number(m[2]) })
  }
  return out
}

export function buildCards(tips, list, official) {
  const officialById = new Map(official.map((c) => [c.id, c]))
  const cards = []
  const diffs = []
  for (const [rawId, tip] of Object.entries(tips)) {
    const row = list.get(rawId) ?? {}
    const id = normaliseId(rawId)
    const s = parseStats(tip.stats, row.colors?.[0])
    const traitsLine = (tip.traits ?? '').split('|').map(clean).filter(Boolean)
    const [form, attribute] = traitsLine
    const game = {
      id,
      name: tip.name,
      kind: KINDS[row.type] ?? (tip.meta?.split('·')[1] ? KINDS[clean(tip.meta.split('·')[1])] : undefined) ?? 'digimon',
      colors: row.colors ?? [],
      level: s.level,
      playCost: s.playCost,
      dp: s.dp,
      digivolve: s.digivolve,
      form,
      attribute,
      traits: row.traits?.length ? row.traits.filter((t) => t !== form && t !== attribute) : traitsLine.slice(2),
      effect: htmlToText(tip.text),
      inheritedEffect: htmlToText(tip.inherited) || undefined,
      rarity: row.rarity,
      set: id.split('-')[0],
      pack: row.pack,
      alysionExclusive: !!row.exclusive,
      released: row.released ?? true,
      imageUrl: row.image,
      sourceUrl: row.page,
      source: 'alysion.gg',
    }
    const off = officialById.get(id)
    if (!off) {
      game.keywords = [...new Set([...`${game.effect} ${game.inheritedEffect ?? ''}`.matchAll(/＜([^＞]+)＞/g)].map((m) => m[1].replace(/\s+\d+$/, '')))]
      cards.push(game)
      continue
    }
    // In-game numbers win: Alysion can be balanced differently from the tabletop game.
    for (const k of ['playCost', 'dp', 'level']) {
      if (game[k] != null && off[k] != null && game[k] !== off[k]) diffs.push(`${id} ${k}: official ${off[k]}, game ${game[k]}`)
    }
    cards.push({
      ...off,
      playCost: game.playCost ?? off.playCost,
      dp: game.dp ?? off.dp,
      level: game.level ?? off.level,
      pack: game.pack,
      alysionExclusive: game.alysionExclusive,
      released: game.released,
      sourceUrl: game.sourceUrl,
      source: 'official+alysion.gg',
    })
  }
  return { cards: cards.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })), diffs }
}

async function get(path, type) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return type === 'json' ? res.json() : res.text()
}

async function upload(cards) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const rows = cards.map((c) => ({ id: c.id, data: c, updated_at: new Date().toISOString() }))
  for (let i = 0; i < rows.length; i += 200) {
    const res = await fetch(`${url}/rest/v1/cards?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows.slice(i, i + 200)),
    })
    if (!res.ok) throw new Error(`Supabase upload: HTTP ${res.status} ${await res.text()}`)
  }
  // Remove cards that are no longer in the pool.
  const ids = cards.map((c) => `"${c.id}"`).join(',')
  await fetch(`${url}/rest/v1/cards?id=not.in.(${encodeURIComponent(ids)})`, {
    method: 'DELETE', headers: { apikey: key, authorization: `Bearer ${key}` },
  })
}

async function main() {
  const tips = await get('/card-tips.json', 'json')
  await new Promise((r) => setTimeout(r, 1500))
  const list = parseList(await get('/cards/'))
  const official = JSON.parse(await readFile('public/data/cards.json', 'utf8'))
  const { cards, diffs } = buildCards(tips, list, official)
  if (cards.length < 100) throw new Error(`Only ${cards.length} cards parsed, the site layout may have changed`)
  const bySource = {}
  for (const c of cards) bySource[c.source] = (bySource[c.source] ?? 0) + 1
  console.log(`${cards.length} cards`, bySource)
  if (diffs.length) console.log(`Stat differences (game wins):\n  ${diffs.join('\n  ')}`)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await upload(cards)
    console.log('Uploaded to Supabase')
  } else {
    await mkdir('.private', { recursive: true })
    await writeFile('.private/cards-full.json', JSON.stringify(cards, null, 1))
    console.log('Written to .private/cards-full.json')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1) })
