import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | null = null

export function db() {
  if (!_sql) {
    const url = Netlify.env.get("DATABASE_URL")
    if (!url) throw new Error("DATABASE_URL ontbreekt")
    _sql = neon(url)
  }
  return _sql
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
export const DATUM = /^\d{4}-\d{2}-\d{2}$/

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}

export function fout(boodschap: string, status = 400) {
  return json({ fout: boodschap }, status)
}

/** Zet databankfouten om naar een leesbare melding. Bedrijfsregels (RAISE EXCEPTION) gaan door naar de gebruiker. */
export function dbFout(err: any) {
  const code = err?.code
  if (code === "P0001") return fout(String(err.message || "Actie geweigerd"), 400)
  if (code === "23505") return fout("Dit bestaat al (dubbele waarde).", 409)
  if (code === "23503") return fout("Gekoppeld record niet gevonden.", 400)
  if (code === "23514") return fout("Ongeldige waarde.", 400)
  if (code === "22P02" || code === "22007" || code === "22008") return fout("Ongeldig formaat.", 400)
  console.error("Databankfout", err)
  return fout("Er ging iets mis. Probeer opnieuw.", 500)
}

export function tekst(v: unknown, max = 300): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

export function geheel(v: unknown, min: number, max: number): number | null {
  if (v === undefined || v === null || v === "") return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}
