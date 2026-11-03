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

/** Btw-nummer zonder spaties, punten of streepjes, in hoofdletters. Een Belgisch ondernemingsnummer zonder landcode krijgt BE. */
export function btwNormaal(v: unknown): string | null {
  const s = tekst(v, 30)?.replace(/[\s.\-]/g, "").toUpperCase()
  if (!s) return null
  return /^[01]\d{9}$/.test(s) ? `BE${s}` : s
}

/** Vorm van een EU-btw-nummer; een Belgisch nummer moet ook de controle modulo 97 doorstaan (typfouten). */
export function btwGeldig(btw: string): boolean {
  if (!/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(btw)) return false
  if (!btw.startsWith("BE")) return true
  const m = /^BE([01]\d{7})(\d{2})$/.exec(btw)
  return !!m && 97 - (Number(m[1]) % 97) === Number(m[2])
}

/** Leest en controleert een btw-nummer. Geeft de foutmelding terug als het niet klopt. */
export function btwVeld(v: unknown): { btw: string | null; fout?: string } {
  const btw = btwNormaal(v)
  if (!btw) return { btw: null }
  if (btwGeldig(btw)) return { btw }
  return {
    btw,
    fout: btw.startsWith("BE")
      ? "Dit Belgische btw-nummer klopt niet. Controleer de cijfers (bv. BE0123456749)."
      : "Vul een geldig btw-nummer in, bv. BE0123456749.",
  }
}

export function geheel(v: unknown, min: number, max: number): number | null {
  if (v === undefined || v === null || v === "") return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}
