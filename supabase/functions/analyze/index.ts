// Supabase Edge Function: deck analysis with Claude.
// Deploy:  supabase functions deploy analyze --no-verify-jwt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=... ALLOWED_ORIGIN=https://quancel.github.io
//
// The browser sends only pre-filtered cards in the compact one-line format,
// so a request stays at a few thousand tokens instead of the whole database.
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic() // reads ANTHROPIC_API_KEY
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const MAX_CARDS = 120

// Static, so it is cached across requests.
const SYSTEM = `Du bist ein erfahrener Spieler und Deckbauer für Digimon Alysion, die Mobile-Version des Digimon Card Game.
Antworte auf Deutsch, konkret und praxisnah. Nutze nur die Karten, die dir gegeben werden, und erfinde keine Karten oder Effekte.
Wenn dir Informationen fehlen, sag das.

Deckregeln: 50 Karten im Hauptdeck, bis zu 5 Digi-Eier im Ei-Deck, höchstens 4 Kopien pro Kartennummer.

Kartenformat (eine Zeile pro Karte, Felder durch | getrennt):
Nummer|Name|Typ|Farben|Level|Spielkosten|DP|Digitation|Form|Attribut|Eigenschaften|Effekt|Vererbter Effekt|Sicherheitseffekt
Typ: E=Digi-Ei, D=Digimon, T=Tamer, O=Option, DO=Digimon/Option.
Farben: R=Rot, B=Blau, Y=Gelb, G=Grün, Bk=Schwarz, P=Lila, W=Weiß.
Digitation: z. B. R3c2 = von rotem Level 3 für 2 Kosten.

Aufgaben je nach Modus:
- build: Baue um die Fokuskarte(n) ein Deck oder einen Deckkern. Erkläre, welche Karten passen und warum, die Rollen (Starter, Engine, Finisher, Schutz), die Levelkurve und wie man das Deck spielt (Eröffnung, Mitte, Abschluss).
- evaluate: Bewerte die Fokuskarte(n) für das aktuelle Meta: Stärken, Schwächen, in welche Decks sie passen, Note 1-10 mit Begründung.
- antimeta: Finde unter den Kandidaten Karten und Strategien, die die genannten Meta-Decks kontern, und erkläre wie.
- deck: Analysiere das gegebene Deck: Schwachstellen, fehlende Rollen, konkrete Tauschvorschläge.
Formatiere mit kurzen Überschriften und Listen.`

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  mode: 'build' | 'evaluate' | 'antimeta' | 'deck'
  question?: string
  focus?: string[]
  candidates?: string[]
  deck?: string[]
  meta?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: cors })
  }
  const lines = (xs?: string[]) => (xs ?? []).slice(0, MAX_CARDS).map((s) => String(s).slice(0, 1500)).join('\n')
  const parts = [
    `Modus: ${body.mode}`,
    body.focus?.length ? `Fokuskarten:\n${lines(body.focus)}` : '',
    body.deck?.length ? `Deck (Anzahl x Karte):\n${lines(body.deck)}` : '',
    body.candidates?.length ? `Kandidaten (vorgefiltert nach Synergie):\n${lines(body.candidates)}` : '',
    body.meta ? `Aktuelles Meta:\n${body.meta.slice(0, 4000)}` : '',
    body.question ? `Frage: ${body.question.slice(0, 2000)}` : '',
  ].filter(Boolean)

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: parts.join('\n\n') }],
    })
    if (response.stop_reason === 'refusal') {
      return Response.json({ error: 'Die Anfrage wurde abgelehnt.' }, { status: 422, headers: cors })
    }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')
    return Response.json({ text, usage: response.usage }, { headers: cors })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: 'Zu viele Anfragen, bitte kurz warten.' }, { status: 429, headers: cors })
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: 'API-Schlüssel fehlt oder ist ungültig.' }, { status: 500, headers: cors })
    if (e instanceof Anthropic.APIError) return Response.json({ error: `API-Fehler ${e.status}` }, { status: 502, headers: cors })
    return Response.json({ error: 'Unbekannter Fehler' }, { status: 500, headers: cors })
  }
})
