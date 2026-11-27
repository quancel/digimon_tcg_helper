import { useState } from 'react'
import type { Card } from '../types/card'
import { analyseDeck, deckFromText, deckToText, RULES, type Deck } from '../lib/deck'

export function DeckPanel({ deck, byId, onChange, onReplace, onOpen }: {
  deck: Deck
  byId: Map<string, Card>
  onChange: (id: string, delta: number) => void
  onReplace: (d: Deck) => void
  onOpen: (c: Card) => void
}) {
  const a = analyseDeck(deck, byId)
  const [msg, setMsg] = useState('')
  const maxCurve = Math.max(1, ...Object.values(a.curve))
  const levels = ['2', '3', '4', '5', '6', '7'].filter((l) => l in a.curve || ['3', '4', '5', '6'].includes(l))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deckToText(deck, byId))
      setMsg('Deckliste kopiert')
    } catch {
      setMsg('Kopieren nicht möglich')
    }
  }
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const d = deckFromText(text)
      if (Object.keys(d.counts).length) onReplace(d)
      setMsg(`${Object.keys(d.counts).length} Karten importiert`)
    } catch {
      setMsg('Einfügen nicht möglich')
    }
  }

  const section = (title: string, rows: { card: Card; n: number }[]) =>
    rows.length > 0 && (
      <>
        <p className="meta" style={{ margin: '10px 0 2px' }}>{title}</p>
        {rows
          .sort((x, y) => (x.card.level ?? 0) - (y.card.level ?? 0) || x.card.id.localeCompare(y.card.id))
          .map(({ card, n }) => (
            <div className="deck-row" key={card.id}>
              <span className="dot" style={{ background: `var(--${card.colors[0] ?? 'white'})` }} />
              <span className="name" onClick={() => onOpen(card)} role="button">
                {card.level != null ? `Lv.${card.level} ` : ''}{card.name}
              </span>
              <button onClick={() => onChange(card.id, -1)} aria-label="Eine entfernen">−</button>
              <span>{n}</span>
              <button onClick={() => onChange(card.id, 1)} aria-label="Eine hinzufügen" disabled={n >= RULES.maxCopies}>+</button>
            </div>
          ))}
      </>
    )

  return (
    <aside className="panel deck">
      <h2>
        <input
          value={deck.name}
          onChange={(e) => onReplace({ ...deck, name: e.target.value })}
          style={{ border: 0, background: 'none', fontWeight: 700, width: '60%' }}
          aria-label="Deckname"
        />
        <span>{a.mainCount}/{RULES.mainSize} · {a.eggCount}/{RULES.maxEggs} Eier</span>
      </h2>
      <ul className="issues">
        {a.valid ? <li className="ok">Deck ist regelkonform</li> : a.issues.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <div className="curve" aria-label="Levelkurve">
        {levels.map((l) => (
          <div key={l} style={{ height: `${((a.curve[l] ?? 0) / maxCurve) * 100}%` }} title={`Lv.${l}: ${a.curve[l] ?? 0}`}>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {section('Digi-Eier', a.eggs)}
      {section('Digimon', a.main.filter((e) => e.card.kind === 'digimon' || e.card.kind === 'digimon-option'))}
      {section('Tamer', a.main.filter((e) => e.card.kind === 'tamer'))}
      {section('Optionen', a.main.filter((e) => e.card.kind === 'option'))}
      {a.eggs.length + a.main.length === 0 && <p className="empty">Tippe auf eine Karte, um sie hinzuzufügen.</p>}
      <div className="row">
        <button className="btn" onClick={copy}>Liste kopieren</button>
        <button className="btn" onClick={paste}>Liste einfügen</button>
        <button className="btn" onClick={() => onReplace({ name: 'Neues Deck', counts: {} })}>Leeren</button>
      </div>
      {msg && <p className="meta" style={{ marginTop: 8 }}>{msg}</p>}
    </aside>
  )
}
