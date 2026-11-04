import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst } from "../lib/db.mts"
import { aangemeld, bestemming, eigenAanvraag, wisSessie, zetSessie, type Rol } from "../lib/sessie.mts"
import { controleerWachtwoord, hashWachtwoord, tokenHash, wachtwoordFout } from "../lib/wachtwoord.mts"
import { maakUitnodiging } from "../lib/uitnodiging.mts"
import { mailGeconfigureerd, verstuur } from "../lib/mail.mts"
import { esc } from "../lib/attestpagina.mts"

/** Gewoon verstuurd HTML-formulier (zonder JavaScript), van deze site zelf. */
const formulierPost = (req: Request) =>
  req.method === "POST" &&
  (req.headers.get("content-type") || "").startsWith("application/x-www-form-urlencoded") &&
  (req.headers.get("origin") === new URL(req.url).origin || req.headers.get("sec-fetch-site") === "same-origin")

const veiligPad = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p.slice(0, 300) : null)
const doorsturen = (naar: string) => new Response(null, { status: 303, headers: { location: naar, "cache-control": "no-store" } })

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const pad = url.pathname
  const viaFormulier = pad === "/api/aanmelden" && formulierPost(req)
  if (!eigenAanvraag(req) && !viaFormulier) return fout("Ongeldige aanvraag.", 403)
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
    // Normaal via fetch (JSON). Wordt het formulier verstuurd voor het script geladen is, dan komt het hier als gewoon
    // formulier binnen: dan sturen we door naar de bestemming of terug naar de aanmeldpagina met een foutmelding.
    if (pad === "/api/aanmelden" && req.method === "POST") {
      const b: Record<string, unknown> = viaFormulier
        ? Object.fromEntries(new URLSearchParams(await req.text()))
        : await req.json().catch(() => ({}))
      const terug = veiligPad(b.terug)
      const mislukt = (melding: string, status: number) =>
        viaFormulier ? doorsturen(`/aanmelden/?fout=1${terug ? `&terug=${encodeURIComponent(terug)}` : ""}`) : fout(melding, status)
      const login = tekst(b.login, 254)
      const wachtwoord = typeof b.wachtwoord === "string" ? b.wachtwoord.slice(0, 200) : ""
      if (!login || !wachtwoord) return mislukt("Vul je gebruikersnaam of e-mail en je wachtwoord in.", 400)
      const [g] = await sql`
        SELECT id, rol::text AS rol, wachtwoord_hash, actief FROM gebruikers
        WHERE gebruikersnaam = ${login} OR email = ${login} LIMIT 1`
      const ok = await controleerWachtwoord(wachtwoord, g?.wachtwoord_hash)
      if (!g || !ok || !g.actief) {
        await new Promise((r) => setTimeout(r, 500))
        return mislukt("Gebruikersnaam of wachtwoord klopt niet.", 401)
      }
      await sql`UPDATE gebruikers SET laatst_aangemeld_op = now() WHERE id = ${g.id}`
      zetSessie(context, g.id)
      if (viaFormulier) return doorsturen(terug || bestemming(g.rol as Rol))
      return json({ ok: true, bestemming: bestemming(g.rol as Rol) })
    }

    // ---------- Wachtwoord vergeten ----------
    // Het antwoord is altijd hetzelfde, of er nu een account bestaat of niet, zodat niemand zo kan nagaan wie een account heeft.
    // Met mail (Brevo): een herstellink van 1 uur naar het e-mailadres van het account.
    // Zonder mail: een melding voor de beheerders, die een nieuwe aanmeldlink maken en doorsturen.
    if (pad === "/api/wachtwoord-vergeten" && req.method === "POST") {
      const b = await req.json().catch(() => ({}))
      const login = tekst(b.login, 254)
      if (!login) return fout("Vul je e-mailadres of gebruikersnaam in.")
      const metMail = mailGeconfigureerd()
      const [g] = await sql`
        SELECT id, email::text AS email, voornaam, achternaam FROM gebruikers
        WHERE (gebruikersnaam = ${login} OR email = ${login}) AND actief LIMIT 1`
      if (g) {
        // het werk (link, mail of melding) loopt verder na het antwoord, zodat de antwoordtijd niets verraadt
        const werk = herstel(req, g as Persoon, metMail).catch((err) => console.error("wachtwoord vergeten", err))
        if (typeof context.waitUntil === "function") context.waitUntil(werk)
        else await werk
      }
      return json({ ok: true, mail: metMail })
    }

    // ---------- Uitnodiging of herstellink bekijken en aanvaarden ----------
    if (pad === "/api/uitnodiging" && req.method === "GET") {
      const token = tekst(url.searchParams.get("t"), 100)
      if (!token) return fout("Deze link is onvolledig.")
      const [u] = await sql`
        SELECT g.voornaam, g.email::text AS email, o.naam AS organisatie, u.vervalt_op, u.gebruikt_op,
               (g.wachtwoord_hash IS NOT NULL) AS herstel
        FROM uitnodigingen u JOIN gebruikers g ON g.id = u.gebruiker_id LEFT JOIN organisaties o ON o.id = g.organisatie_id
        WHERE u.token_hash = ${tokenHash(token)}`
      if (!u) return fout("Deze link bestaat niet.", 404)
      if (u.gebruikt_op) return fout("Deze link werd al gebruikt. Meld je aan met je wachtwoord.", 410)
      if (new Date(u.vervalt_op) < new Date()) return fout("Deze link is verlopen. Vraag een nieuwe aan.", 410)
      return json({ voornaam: u.voornaam, email: u.email, organisatie: u.organisatie, herstel: u.herstel })
    }

    if (pad === "/api/uitnodiging" && req.method === "POST") {
      const b = await req.json().catch(() => ({}))
      const token = tekst(b.token, 100)
      const w = typeof b.wachtwoord === "string" ? b.wachtwoord : ""
      if (!token) return fout("Deze link is onvolledig.")
      const f = wachtwoordFout(w)
      if (f) return fout(f)
      const hash = await hashWachtwoord(w)
      const [u] = await sql`
        UPDATE uitnodigingen SET gebruikt_op = now()
        WHERE token_hash = ${tokenHash(token)} AND gebruikt_op IS NULL AND vervalt_op > now()
        RETURNING gebruiker_id`
      if (!u) return fout("Deze link is niet meer geldig.", 410)
      const [g] = await sql`
        WITH oud AS (SELECT wachtwoord_hash IS NOT NULL AS had FROM gebruikers WHERE id = ${u.gebruiker_id})
        UPDATE gebruikers SET wachtwoord_hash = ${hash}, laatst_aangemeld_op = now() WHERE id = ${u.gebruiker_id} AND actief
        RETURNING id, rol::text AS rol, (SELECT had FROM oud) AS herstel`
      if (!g) return fout("Dit account is niet actief.", 403)
      await sql`SELECT log_actie(${g.herstel ? "wachtwoord_hersteld" : "account_geactiveerd"}, 'gebruiker', ${g.id}::uuid, '{}'::jsonb)`
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

type Persoon = { id: string; email: string; voornaam: string | null; achternaam: string | null }

/** Herstellink mailen of, zonder mail, de beheerders verwittigen. Met een grens tegen misbruik. */
async function herstel(req: Request, g: Persoon, metMail: boolean) {
  const sql = db()
  // met mail: max. 3 links per uur; zonder mail: max. 1 melding per dag
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM auditlog
    WHERE actie = 'wachtwoord_herstel_gevraagd' AND entiteit_id = ${g.id}
      AND tijdstip > now() - ${metMail ? "1 hour" : "1 day"}::interval`
  if (n >= (metMail ? 3 : 1)) return
  await sql`SELECT log_actie('wachtwoord_herstel_gevraagd', 'gebruiker', ${g.id}::uuid, ${JSON.stringify({ mail: metMail })}::jsonb)`
  const wie = [g.voornaam, g.achternaam].filter(Boolean).join(" ")

  if (!metMail) {
    await sql`
      INSERT INTO meldingen (titel, omschrijving, ernst, context, gebruiker_id, email)
      VALUES (${`Wachtwoord vergeten: ${g.email}`.slice(0, 200)},
              ${`${wie || g.email} (${g.email}) vraagt een nieuwe aanmeldlink via "Wachtwoord vergeten". Mailen is niet ingesteld, dus de link gaat niet vanzelf weg. ` +
                `Maak een link via Beheer → Cursisten → Aanmeldlink (of laat de beheerder van de onderneming dat doen via Medewerkers → Nieuwe aanmeldlink) en stuur hem naar de persoon.`},
              'Functioneel', ${JSON.stringify({ scherm: "/wachtwoord-vergeten/", soort: "wachtwoord_vergeten" })}::jsonb, ${g.id}, ${g.email})`
    return
  }

  const { link } = await maakUitnodiging(req, g.id, null, { uren: 1, actie: "herstellink_gemaakt" })
  const tekstMail = [
    `Dag${g.voornaam ? " " + g.voornaam : ""},`,
    "",
    "Je vroeg een nieuw wachtwoord voor de Betosoft Academie. Kies het via deze link:",
    link,
    "",
    "De link is 1 uur geldig en werkt één keer.",
    "Heb je dit niet zelf gevraagd? Dan mag je deze mail negeren. Je wachtwoord blijft hetzelfde.",
    "",
    "Betosoft Academie",
  ].join("\n")
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#223840;max-width:560px">
    <p>Dag${g.voornaam ? " " + esc(g.voornaam) : ""},</p>
    <p>Je vroeg een nieuw wachtwoord voor de Betosoft Academie.</p>
    <p><a href="${esc(link)}" style="display:inline-block;background:#1E5A66;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:600">Nieuw wachtwoord kiezen</a></p>
    <p>De link is 1 uur geldig en werkt één keer.<br>Heb je dit niet zelf gevraagd? Dan mag je deze mail negeren. Je wachtwoord blijft hetzelfde.</p>
    <p style="font-size:13px;color:#5a6b70">Werkt de knop niet? Kopieer dan deze link in je browser: ${esc(link)}</p>
    <p style="font-size:13px;color:#5a6b70">Betosoft Academie · betosoft.be</p></div>`
  const r = await verstuur({ naar: g.email, naarNaam: wie || null, onderwerp: "Nieuw wachtwoord kiezen · Betosoft Academie", html, tekst: tekstMail })
  if (!r.ok) console.error("herstelmail niet verstuurd", g.id, r.fout)
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: ["/api/aanmelden", "/api/afmelden", "/api/sessie", "/api/uitnodiging", "/api/wachtwoord", "/api/wachtwoord-vergeten"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
}
