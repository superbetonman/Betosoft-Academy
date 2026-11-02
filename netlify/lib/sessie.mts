import { createHmac, timingSafeEqual } from "node:crypto"
import type { Context } from "@netlify/functions"
import { db } from "./db.mts"

export const COOKIE = "academie_sessie"
const DUUR_S = 60 * 60 * 12 // 12 uur
export const DUUR_SECONDEN = DUUR_S

export type Rol = "superadmin" | "beheerder" | "centrale_verantwoordelijke" | "cursist"
export type Gebruiker = {
  id: string
  rol: Rol
  organisatie_id: string | null
  voornaam: string | null
  achternaam: string | null
  email: string
  gebruikersnaam: string | null
}

function geheim() {
  const g = Netlify.env.get("SESSIE_GEHEIM")
  if (!g || g.length < 32) throw new Error("SESSIE_GEHEIM ontbreekt of is te kort")
  return g
}
const handtekening = (data: string) => createHmac("sha256", geheim()).update(data).digest("base64url")

export function maakSessie(uid: string) {
  const data = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + DUUR_S })).toString("base64url")
  return `${data}.${handtekening(data)}`
}

function leesToken(token: string | undefined | null): string | null {
  if (!token) return null
  const [data, sig] = token.split(".")
  if (!data || !sig) return null
  const a = Buffer.from(handtekening(data))
  const b = Buffer.from(sig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString())
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000 || typeof p.uid !== "string") return null
    return p.uid
  } catch {
    return null
  }
}

/** Haalt de aangemelde gebruiker op. Rol en status komen altijd uit de databank, zodat een wijziging meteen geldt. */
export async function aangemeld(context: Context): Promise<Gebruiker | null> {
  const uid = leesToken(context.cookies.get(COOKIE))
  if (!uid) return null
  const [g] = await db()`
    SELECT id, rol::text AS rol, organisatie_id, voornaam, achternaam, email::text AS email, gebruikersnaam::text AS gebruikersnaam
    FROM gebruikers WHERE id = ${uid} AND actief AND wachtwoord_hash IS NOT NULL`
  return (g as Gebruiker) ?? null
}

export function zetSessie(context: Context, uid: string) {
  context.cookies.set({
    name: COOKIE,
    value: maakSessie(uid),
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    expires: new Date(Date.now() + DUUR_S * 1000),
  })
}

export function wisSessie(context: Context) {
  context.cookies.delete({ name: COOKIE, path: "/" })
}

export const isBeheer = (g: Gebruiker | null) => !!g && (g.rol === "beheerder" || g.rol === "superadmin")

export function bestemming(rol: Rol) {
  if (rol === "superadmin" || rol === "beheerder") return "/beheer/"
  if (rol === "centrale_verantwoordelijke") return "/centrale/"
  return "/leren/"
}

/** Eenvoudige bescherming tegen aanvragen van andere sites: elke wijziging moet deze header meesturen. */
export const eigenAanvraag = (req: Request) => req.method === "GET" || req.headers.get("x-academie") === "1"
