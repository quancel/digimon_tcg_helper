/** Calls the Supabase Edge Function in supabase/functions/analyze. */
export const ANALYZE_URL: string | undefined = import.meta.env.VITE_ANALYZE_URL
const ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

export type Mode = 'build' | 'evaluate' | 'antimeta' | 'deck'

export async function askAI(req: {
  mode: Mode
  question?: string
  focus?: string[]
  candidates?: string[]
  deck?: string[]
  meta?: string
}): Promise<string> {
  if (!ANALYZE_URL) throw new Error('Die KI-Analyse ist noch nicht eingerichtet.')
  const res = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(ANON_KEY ? { authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } : {}) },
    body: JSON.stringify(req),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.text
}
