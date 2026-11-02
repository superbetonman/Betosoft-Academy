import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst } from "../lib/db.mts"
import { aangemeld, bestemming, eigenAanvraag, wisSessie, zetSessie, type Rol } from "../lib/sessie.mts"
import { controleerWachtwoord, hashWachtwoord, tokenHash, wachtwoordFout } from "../lib/wachtwoord.mts"

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const pad = url.pathname
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  const sql = db()

  try {
    // ---------- Wie is aangemeld ----------
    if (pad === "/api/sessie" && req.method === "GET") {
      const g = await aangemeld(context)
      if (!g) return json({ aangemeld: false })
      let organisatie: Record<string, any> | null = null
      if (g.organisatie_id) [organisatie] = await sql`SELECT id, naam, ouder_id FROM organisaties WHERE id = ${g.organisatie_id}`
      return json({
        aangemeld: true,
        gebruiker: { id: g.id, rol: g.rol, voornaam: g.voornaam, achternaam: g.achternaam, email: g.email, gebruikersnaam: g.gebruikersnaam, organisatie },
        bestemming: bestemming(g.rol),
      })
    }

    if (pad === "/api/afmelden" && req.method === "POST") {
      wisSessie(context)
      return json({ ok: true })
    }

    // ---------- Aanmelden met gebruikersnaam of e-mail ----------
    if (pad === "/api/aanmelden" && req.method === "POST") {
      const b = await req.json().catch(() => ({}))
      const login = tekst(b.login, 254)
      const wachtwoord = typeof b.wachtwoord === "string" ? b.wachtwoord.slice(0, 200) : ""
      if (!login || !wachtwoord) return fout("Vul je gebruikersnaam of e-mail en je wachtwoord in.")
      const [g] = await sql`
        SELECT id, rol::text AS rol, wachtwoord_hash, actief FROM gebruikers
        WHERE gebruikersnaam = ${login} OR email = ${login} LIMIT 1`
      const ok = await controleerWachtwoord(wachtwoord, g?.wachtwoord_hash)
      if (!g || !ok || !g.actief) {
        await new Promise((r) => setTimeout(r, 500))
        return fout("Gebruikersnaam of wachtwoord klopt niet.", 401)
      }
      await sql`UPDATE gebruikers SET laatst_aangemeld_op = now() WHERE id = ${g.id}`
      zetSessie(context, g.id)
      return json({ ok: true, bestemming: bestemming(g.rol as Rol) })
    }

    // ---------- Uitnodiging bekijken en aanvaarden ----------
    if (pad === "/api/uitnodiging" && req.method === "GET") {
      const token = tekst(url.searchParams.get("t"), 100)
      if (!token) return fout("Uitnodiging ontbreekt.")
      const [u] = await sql`
        SELECT g.voornaam, g.email::text AS email, o.naam AS organisatie, u.vervalt_op, u.gebruikt_op
        FROM uitnodigingen u JOIN gebruikers g ON g.id = u.gebruiker_id LEFT JOIN organisaties o ON o.id = g.organisatie_id
        WHERE u.token_hash = ${tokenHash(token)}`
      if (!u) return fout("Deze uitnodiging bestaat niet.", 404)
      if (u.gebruikt_op) return fout("Deze uitnodiging werd al gebruikt. Meld je aan met je wachtwoord.", 410)
      if (new Date(u.vervalt_op) < new Date()) return fout("Deze uitnodiging is verlopen. Vraag een nieuwe aan.", 410)
      return json({ voornaam: u.voornaam, email: u.email, organisatie: u.organisatie })
    }

    if (pad === "/api/uitnodiging" && req.method === "POST") {
      const b = await req.json().catch(() => ({}))
      const token = tekst(b.token, 100)
      const w = typeof b.wachtwoord === "string" ? b.wachtwoord : ""
      if (!token) return fout("Uitnodiging ontbreekt.")
      const f = wachtwoordFout(w)
      if (f) return fout(f)
      const hash = await hashWachtwoord(w)
      const [u] = await sql`
        UPDATE uitnodigingen SET gebruikt_op = now()
        WHERE token_hash = ${tokenHash(token)} AND gebruikt_op IS NULL AND vervalt_op > now()
        RETURNING gebruiker_id`
      if (!u) return fout("Deze uitnodiging is niet meer geldig.", 410)
      const [g] = await sql`
        UPDATE gebruikers SET wachtwoord_hash = ${hash}, laatst_aangemeld_op = now() WHERE id = ${u.gebruiker_id} AND actief
        RETURNING id, rol::text AS rol`
      if (!g) return fout("Dit account is niet actief.", 403)
      await sql`SELECT log_actie('account_geactiveerd', 'gebruiker', ${g.id}::uuid, '{}'::jsonb)`
      zetSessie(context, g.id)
      return json({ ok: true, bestemming: bestemming(g.rol as Rol) })
    }

    // ---------- Eigen wachtwoord wijzigen ----------
    if (pad === "/api/wachtwoord" && req.method === "POST") {
      const g = await aangemeld(context)
      if (!g) return fout("Niet aangemeld.", 401)
      const b = await req.json().catch(() => ({}))
      const [r] = await sql`SELECT wachtwoord_hash FROM gebruikers WHERE id = ${g.id}`
      if (!(await controleerWachtwoord(String(b.huidig ?? ""), r?.wachtwoord_hash))) return fout("Je huidige wachtwoord klopt niet.", 400)
      const f = wachtwoordFout(b.nieuw)
      if (f) return fout(f)
      await sql`UPDATE gebruikers SET wachtwoord_hash = ${await hashWachtwoord(b.nieuw)} WHERE id = ${g.id}`
      await sql`SELECT log_actie('wachtwoord_gewijzigd', 'gebruiker', ${g.id}::uuid, '{}'::jsonb)`
      return json({ ok: true })
    }

    return fout("Niet gevonden.", 404)
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: ["/api/aanmelden", "/api/afmelden", "/api/sessie", "/api/uitnodiging", "/api/wachtwoord"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
}
