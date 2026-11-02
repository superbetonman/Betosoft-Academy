import type { Config, Context } from "@netlify/functions"
import { json, fout } from "../lib/db.mts"
import { COOKIE, DUUR_SECONDEN, gelijk, leesSessie, maakSessie } from "../lib/sessie.mts"

export default async (req: Request, context: Context) => {
  const pad = new URL(req.url).pathname

  if (pad === "/api/sessie" && req.method === "GET") {
    const s = leesSessie(context.cookies.get(COOKIE))
    return json({ aangemeld: !!s, rol: s?.rol ?? null })
  }

  if (pad === "/api/afmelden" && req.method === "POST") {
    context.cookies.delete({ name: COOKIE, path: "/" })
    return json({ ok: true })
  }

  if (pad === "/api/aanmelden" && req.method === "POST") {
    if (req.headers.get("x-academie") !== "1") return fout("Ongeldige aanvraag.", 403)
    const verwacht = Netlify.env.get("ADMIN_WACHTWOORD")
    if (!verwacht || verwacht.length < 12) return fout("Beheerderswachtwoord is nog niet ingesteld.", 503)
    let b: any
    try {
      b = await req.json()
    } catch {
      return fout("Ongeldige aanvraag.")
    }
    const wachtwoord = typeof b.wachtwoord === "string" ? b.wachtwoord : ""
    if (!gelijk(wachtwoord, verwacht)) {
      await new Promise((r) => setTimeout(r, 800))
      return fout("Wachtwoord klopt niet.", 401)
    }
    context.cookies.set({
      name: COOKIE,
      value: maakSessie("beheerder"),
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      expires: new Date(Date.now() + DUUR_SECONDEN * 1000),
    })
    return json({ ok: true })
  }

  return fout("Niet gevonden.", 404)
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: ["/api/aanmelden", "/api/afmelden", "/api/sessie"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
}
