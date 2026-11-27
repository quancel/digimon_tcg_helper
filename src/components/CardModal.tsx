import type { Card } from '../types/card'
import { COLOR_LABEL, KIND_LABEL } from '../lib/cards'

export function CardModal({ card, count, onChange, onClose }: {
  card: Card
  count: number
  onChange: (delta: number) => void
  onClose: () => void
}) {
  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={card.name}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <img src={card.imageUrl} alt={card.name} referrerPolicy="no-referrer" />
        <div>
          <h2>{card.name}</h2>
          <p className="meta">
            {card.id} · {card.rarity} · {KIND_LABEL[card.kind] ?? card.kind}
            {card.alysionExclusive && ' · Alysion-exklusiv'}
          </p>
          <div className="stats">
            {card.colors.map((c) => <span key={c}>{COLOR_LABEL[c] ?? c}</span>)}
            {card.level != null && <span>Lv.{card.level}</span>}
            {card.playCost != null && <span>Kosten {card.playCost}</span>}
            {card.dp != null && <span>{card.dp} DP</span>}
            {card.digivolve.map((d, i) => (
              <span key={i}>Digitation {d.cost} von Lv.{d.level} ({COLOR_LABEL[d.color] ?? d.color})</span>
            ))}
            {card.form && <span>{card.form}</span>}
            {card.attribute && <span>{card.attribute}</span>}
            {card.traits.map((t) => <span key={t}>{t}</span>)}
          </div>
          {card.effect && <p className="effect"><b>Effekt</b>{card.effect}</p>}
          {card.inheritedEffect && <p className="effect"><b>Vererbter Effekt</b>{card.inheritedEffect}</p>}
          {card.securityEffect && <p className="effect"><b>Sicherheitseffekt</b>{card.securityEffect}</p>}
          <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => onChange(-1)} disabled={count === 0}>−</button>
            <span>{count} im Deck</span>
            <button className="btn primary" onClick={() => onChange(1)}>+ Hinzufügen</button>
            <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>Schließen</button>
          </div>
          {card.rulings && (
            <details>
              <summary>Offizielle Q&amp;A ({card.rulings.length})</summary>
              {card.rulings.map((r) => (
                <p key={r.id}><b>{r.q}</b><br />{r.a}</p>
              ))}
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
