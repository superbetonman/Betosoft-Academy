import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, EMAIL } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, isBeheer } from "../lib/sessie.mts"

/**
 * Meldingen (fouten, inhoudelijke opmerkingen, wensen), naar het model van de bevindingen in Betosoft.
 *   POST /api/meldingen                    nieuwe melding (iedereen; aangemelde gebruikers worden herkend)
 *   GET  /api/meldingen/mijn               meldingen van de aangemelde gebruiker, met status en antwoord
 *   GET  /api/meldingen/beheer?status=…    lijst voor beheerders (open | alle | een status)
 *   GET  /api/meldingen/beheer/<id>        één melding met schermafbeelding
 *   POST /api/meldingen/beheer/<id>        { status, antwoord } (beheerders)
 */

const ERNST = ["Blokkerend", "Inhoudelijke fout", "Functioneel", "Tekst en vorm", "Wens"]
const STATUS = ["Nieuw", "In behandeling", "Opgelost", "Later", "Niet weerhouden"]
const MAX_AFBEELDING = 1_500_000

function schoneContext(c: any) {
  const uit: Record<string, string> = {}
  if (!c || typeof c !== "object") return uit
  for (const k of ["scherm", "adres", "onderdeel", "pad", "cursus", "les", "venster", "browser", "versie"]) {
    const v = tekst(c[k], 400)
    if (v) uit[k] = v
  }
  return uit
}

export default async (req: Request, context: Context) => {
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  const url = new URL(req.url)
  const delen = url.pathname.replace(/^\/api\/meldingen\/?/, "").split("/").filter(Boolean)
  const sql = db()
  try {
    const g = await aangemeld(context)

    // ---------- Nieuwe melding ----------
    if (delen.length === 0 && req.method === "POST") {
      const ruw = await req.text()
      if (ruw.length > MAX_AFBEELDING + 50_000) return fout("De melding is te groot. Verstuur ze zonder schermafbeelding.", 413)
      let b: any
      try {
        b = JSON.parse(ruw)
      } catch {
        return fout("Ongeldige melding.")
      }
      if (tekst(b.website)) return json({ ok: true, nummer: "M-0000" }) // valkuil voor robots
      const titel = tekst(b.titel, 200)
      if (!titel) return fout("Geef een korte titel.")
      const ernst = ERNST.includes(b.ernst) ? b.ernst : null
      if (!ernst) return fout("Kies wat voor melding het is.")
      let email: string | null = null
      if (!g) {
        email = tekst(b.email, 254)
        if (email && !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in, of laat het leeg.")
      }
      let afbeelding: string | null = null
      if (typeof b.afbeelding === "string" && b.afbeelding) {
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.afbeelding) || b.afbeelding.length > MAX_AFBEELDING)
          return fout("De schermafbeelding is ongeldig of te groot.")
        afbeelding = b.afbeelding
      }
      // max. 20 meldingen per uur per gebruiker of e-mailadres tegen misbruik
      const [{ n }] = await sql`
        SELECT count(*)::int AS n FROM meldingen
        WHERE aangemaakt_op > now() - interval '1 hour'
          AND ((${g?.id ?? null}::uuid IS NOT NULL AND gebruiker_id = ${g?.id ?? null}::uuid) OR (${email}::text IS NOT NULL AND email = ${email}::citext))`
      if (n >= 20) return fout("Je hebt het voorbije uur al veel meldingen gestuurd. Probeer later opnieuw.", 429)
      const [r] = await sql`
        INSERT INTO meldingen (titel, omschrijving, verwacht, ernst, context, afbeelding, gebruiker_id, email, naam)
        VALUES (${titel}, ${tekst(b.omschrijving, 4000)}, ${tekst(b.verwacht, 2000)}, ${ernst}, ${JSON.stringify(schoneContext(b.context))}::jsonb,
                ${afbeelding}, ${g?.id ?? null}, ${email}, ${g ? null : tekst(b.naam, 120)})
        RETURNING id`
      return json({ ok: true, nummer: `M-${String(r.id).padStart(4, "0")}` })
    }

    // ---------- Mijn meldingen ----------
    if (delen[0] === "mijn" && req.method === "GET") {
      if (!g) return fout("Niet aangemeld.", 401)
      const rijen = await sql`
        SELECT id, titel, ernst, status, antwoord, context->>'scherm' AS scherm, aangemaakt_op, bijgewerkt_op
        FROM meldingen WHERE gebruiker_id = ${g.id} ORDER BY aangemaakt_op DESC LIMIT 100`
      return json({ meldingen: rijen.map((r: any) => ({ ...r, nummer: `M-${String(r.id).padStart(4, "0")}` })) })
    }

    // ---------- Beheer ----------
    if (delen[0] === "beheer") {
      if (!g) return fout("Niet aangemeld.", 401)
      if (!isBeheer(g)) return fout("Enkel voor beheerders.", 403)
      const id = delen[1] && /^\d{1,12}$/.test(delen[1]) ? delen[1] : null

      if (!id && req.method === "GET") {
        const st = url.searchParams.get("status") ?? "open"
        const rijen = await sql`
          SELECT m.id, m.titel, m.omschrijving, m.ernst, m.status, m.antwoord, m.context, m.email, m.naam, m.aangemaakt_op, m.bijgewerkt_op,
                 (m.afbeelding IS NOT NULL) AS met_afbeelding,
                 COALESCE(concat_ws(' ', u.voornaam, u.achternaam), u.email::text) AS gebruiker, u.rol::text AS rol
          FROM meldingen m LEFT JOIN gebruikers u ON u.id = m.gebruiker_id
          WHERE (${st} = 'alle') OR (${st} = 'open' AND m.status IN ('Nieuw', 'In behandeling')) OR (m.status = ${st})
          ORDER BY m.aangemaakt_op DESC LIMIT 300`
        const [tel] = await sql`SELECT count(*) FILTER (WHERE status = 'Nieuw')::int AS nieuw, count(*) FILTER (WHERE status IN ('Nieuw', 'In behandeling'))::int AS open FROM meldingen`
        return json({ meldingen: rijen.map((r: any) => ({ ...r, nummer: `M-${String(r.id).padStart(4, "0")}` })), tellers: tel })
      }
      if (id && req.method === "GET") {
        const [r] = await sql`
          SELECT m.*, COALESCE(concat_ws(' ', u.voornaam, u.achternaam), u.email::text) AS gebruiker, u.email::text AS gebruiker_email, u.rol::text AS rol
          FROM meldingen m LEFT JOIN gebruikers u ON u.id = m.gebruiker_id WHERE m.id = ${id}`
        if (!r) return fout("Melding niet gevonden.", 404)
        return json({ melding: { ...r, nummer: `M-${String(r.id).padStart(4, "0")}` } })
      }
      if (id && req.method === "POST") {
        const b = await req.json().catch(() => ({}))
        const status = STATUS.includes(b.status) ? b.status : null
        if (!status) return fout("Ongeldige status.")
        const r = await sql`
          UPDATE meldingen SET status = ${status}, antwoord = ${tekst(b.antwoord, 4000)}, bijgewerkt_op = now()
          WHERE id = ${id} RETURNING id`
        if (!r.length) return fout("Melding niet gevonden.", 404)
        await sql`SELECT log_actie('melding_behandeld', 'melding', NULL, ${JSON.stringify({ melding: Number(id), status })}::jsonb)`
        return json({ ok: true })
      }
    }

    return fout("Niet gevonden.", 404)
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = {
  region: "fra",
  path: ["/api/meldingen", "/api/meldingen/*"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
}
