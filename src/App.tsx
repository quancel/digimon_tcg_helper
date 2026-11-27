import { useMemo, useState } from 'react'
import type { Card } from './types/card'
import { COLOR_LABEL, KIND_LABEL, emptyFilters, facets, filterCards, useCards, type Filters } from './lib/cards'
import { useDeck } from './lib/deck'
import { CardModal } from './components/CardModal'
import { DeckPanel } from './components/DeckPanel'

const PAGE = 120

export default function App() {
  const { cards, error } = useCards()
  const { deck, setDeck, change } = useDeck()
  const [tab, setTab] = useState<'cards' | 'deck'>('cards')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<Card | null>(null)

  const byId = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards])
  const f = useMemo(() => facets(cards ?? []), [cards])
  const results = useMemo(() => filterCards(cards ?? [], filters), [cards, filters])
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => {
    setFilters({ ...filters, [k]: e.target.value })
    setShown(PAGE)
  }
  const deckSize = Object.values(deck.counts).reduce((a, b) => a + b, 0)

  return (
    <div className="app">
      <header className="top">
        <h1>Alysion Deckbuilder</h1>
        <nav className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'cards'} onClick={() => setTab('cards')}>Karten</button>
          <button className="tab" role="tab" aria-selected={tab === 'deck'} onClick={() => setTab('deck')}>Deck ({deckSize})</button>
        </nav>
      </header>

      {error && <p className="empty">Kartendaten konnten nicht geladen werden: {error}</p>}
      {!cards && !error && <p className="empty">Lade Karten …</p>}

      {cards && (
        <div className={`layout ${tab === 'deck' ? '' : 'with-deck'}`}>
          {tab === 'cards' && (
            <section>
              <div className="filters">
                <input className="search" type="search" placeholder="Name, Kartennummer oder Effekttext" value={filters.text} onChange={set('text')} />
                <select value={filters.color} onChange={set('color')} aria-label="Farbe">
                  <option value="">Alle Farben</option>
                  {Object.entries(COLOR_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={filters.kind} onChange={set('kind')} aria-label="Kartentyp">
                  <option value="">Alle Typen</option>
                  {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={filters.level} onChange={set('level')} aria-label="Level">
                  <option value="">Alle Level</option>
                  {f.levels.map((l) => <option key={l} value={l}>Lv.{l}</option>)}
                </select>
                <select value={filters.set} onChange={set('set')} aria-label="Set">
                  <option value="">Alle Sets</option>
                  {f.sets.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={filters.trait} onChange={set('trait')} aria-label="Eigenschaft">
                  <option value="">Alle Eigenschaften</option>
                  {f.traits.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={filters.keyword} onChange={set('keyword')} aria-label="Schlüsselwort">
                  <option value="">Alle Schlüsselwörter</option>
                  {f.keywords.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <p className="count">{results.length} Karten</p>
              <div className="grid">
                {results.slice(0, shown).map((c) => (
                  <button key={c.id} className="card-tile" onClick={() => setOpen(c)}>
                    <img src={c.imageUrl} alt={c.name} loading="lazy" referrerPolicy="no-referrer" />
                    {deck.counts[c.id] ? <span className="badge">{deck.counts[c.id]}</span> : null}
                    <div className="label">{c.id} {c.name}</div>
                  </button>
                ))}
              </div>
              {results.length > shown && (
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn" onClick={() => setShown(shown + PAGE)}>Mehr anzeigen</button>
                </div>
              )}
            </section>
          )}
          <DeckPanel deck={deck} byId={byId} onChange={change} onReplace={setDeck} onOpen={setOpen} />
        </div>
      )}

      {/* Reserved for a possible public launch with ads; hidden for now. */}
      <div className="ad-slot" aria-hidden="true" />

      {open && (
        <CardModal card={open} count={deck.counts[open.id] ?? 0} onChange={(d) => change(open.id, d)} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
