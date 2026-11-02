import { createHmac, timingSafeEqual } from "node:crypto"

export const COOKIE = "academie_sessie"
const DUUR_S = 60 * 60 * 12 // 12 uur

function geheim() {
  const g = Netlify.env.get("SESSIE_GEHEIM")
  if (!g || g.length < 32) throw new Error("SESSIE_GEHEIM ontbreekt of is te kort")
  return g
}

function b64(s: string) {
  return Buffer.from(s).toString("base64url")
}

function handtekening(data: string) {
  return createHmac("sha256", geheim()).update(data).digest("base64url")
}

export function maakSessie(rol: "beheerder") {
  const data = b64(JSON.stringify({ rol, exp: Math.floor(Date.now() / 1000) + DUUR_S }))
  return `${data}.${handtekening(data)}`
}

export function leesSessie(token: string | undefined | null): { rol: string } | null {
  if (!token) return null
  const [data, sig] = token.split(".")
  if (!data || !sig) return null
  const verwacht = Buffer.from(handtekening(data))
  const ontvangen = Buffer.from(sig)
  if (verwacht.length !== ontvangen.length || !timingSafeEqual(verwacht, ontvangen)) return null
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString())
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null
    return { rol: p.rol }
  } catch {
    return null
  }
}

export function gelijk(a: string, b: string) {
  const x = createHmac("sha256", "vergelijk").update(a).digest()
  const y = createHmac("sha256", "vergelijk").update(b).digest()
  return timingSafeEqual(x, y)
}

export const DUUR_SECONDEN = DUUR_S
