import { useMemo, useState } from 'react'
import type { Card } from '../types/card'
import { findSynergies, toCompact } from '../lib/synergy'
import { ANALYZE_URL, askAI, type Mode } from '../lib/ai'
import type { Deck } from '../lib/deck'

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'build', label: 'Deck um Karte bauen', hint: 'Welche Karten passen zur Fokuskarte, warum, und wie spielt man das?' },
  { id: 'evaluate', label: 'Karte bewerten', hint: 'Wie stark ist die Karte im aktuellen Meta?' },
  { id: 'antimeta', label: 'Anti-Meta', hint: 'Was kontert die genannten Meta-Decks?' },
  { id: 'deck', label: 'Mein Deck prüfen', hint: 'Schwachstellen und Tauschvorschläge für dein aktuelles Deck.' },
]

export function AnalysisPanel({ cards, deck, byId, onOpen }: {
  cards: Card[]
  deck: Deck
  byId: Map<string, Card>
  onOpen: (c: Card) => void
}) {
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<Card | null>(null)
  const [mode, setMode] = useState<Mode>('build')
  const [question, setQuestion] = useState('')
  const [meta, setMeta] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q.length < 2 ? [] : cards.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)).slice(0, 12)
  }, [cards, query])
  const synergies = useMemo(() => (focus ? findSynergies(focus, cards) : []), [focus, cards])

  const deckLines = Object.entries(deck.counts).map(([id, n]) => {
    const c = byId.get(id)
    return c ? `${n}x ${toCompact(c)}` : `${n}x ${id}`
  })

  const run = async () => {
    setBusy(true); setError(''); setAnswer('')
    try {
      const text = await askAI({
        mode,
        question: question || undefined,
        focus: focus ? [toCompact(focus)] : undefined,
        candidates: synergies.map((s) => toCompact(s.card)),
        deck: mode === 'deck' || mode === 'build' ? deckLines : undefined,
        meta: meta || undefined,
      })
      setAnswer(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="layout">
      <div className="panel">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Fokuskarte</h2>
        <div className="filters" style={{ marginBottom: 8 }}>
          <input className="search" type="search" placeholder="Karte suchen, z. B. Rubeusdramon" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {matches.length > 0 && (
          <div className="grid" style={{ marginBottom: 12 }}>
            {matches.map((c) => (
              <button key={c.id} className="card-tile" onClick={() => { setFocus(c); setQuery('') }}>
                <img src={c.imageUrl} alt={c.name} loading="lazy" referrerPolicy="no-referrer" />
                <div className="label">{c.id} {c.name}</div>
              </button>
            ))}
          </div>
        )}
        {focus && (
          <p className="meta">Ausgewählt: <b style={{ color: 'var(--text)' }}>{focus.id} {focus.name}</b> · <a href="#" onClick={(e) => { e.preventDefault(); onOpen(focus) }}>Details</a></p>
        )}
      </div>

      {focus && (
        <div className="panel">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Passende Karten ({synergies.length})</h2>
          <p className="meta">Regelbasiert aus Namen, Eigenschaften und Digitationslinien. Diese Liste bekommt auch die KI.</p>
          {synergies.length === 0 && <p className="empty">Keine direkten Synergien gefunden.</p>}
          {synergies.slice(0, 20).map((s) => (
            <div className="deck-row" key={s.card.id}>
              <span className="dot" style={{ background: `var(--${s.card.colors[0] ?? 'white'})` }} />
              <span className="name" role="button" onClick={() => onOpen(s.card)}>
                <b>{s.card.name}</b> <span className="meta">{s.card.id} · {s.reasons.join(' · ')}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>KI-Analyse</h2>
        <div className="tabs" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          {MODES.map((m) => (
            <button key={m.id} className="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
        <p className="meta">{MODES.find((m) => m.id === mode)?.hint}</p>
        <div className="filters">
          <input className="search" placeholder="Optionale Frage, z. B. Wie spiele ich gegen Kontrolle?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          {(mode === 'antimeta' || mode === 'evaluate') && (
            <input className="search" placeholder="Aktuelle Meta-Decks, z. B. Rubeusdramon, Yukinamon Control" value={meta} onChange={(e) => setMeta(e.target.value)} />
          )}
        </div>
        <button className="btn primary" onClick={run} disabled={busy || !ANALYZE_URL || (mode !== 'deck' && mode !== 'antimeta' && !focus)}>
          {busy ? 'Analysiere …' : 'Analyse starten'}
        </button>
        {!ANALYZE_URL && <p className="meta" style={{ marginTop: 8 }}>Die KI-Analyse wird aktiv, sobald der API-Schlüssel in Supabase hinterlegt ist.</p>}
        {error && <p className="issues"><span style={{ color: 'var(--warn)' }}>{error}</span></p>}
        {answer && <div className="effect" style={{ marginTop: 12 }}>{answer}</div>}
      </div>
    </section>
  )
}
