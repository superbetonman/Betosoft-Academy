import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, UUID, EMAIL, tekst } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, isBeheer, type Gebruiker } from "../lib/sessie.mts"
import { CURSUSCODE } from "../lib/cursustoegang.mts"
import { laadStructuren, beschikbaar } from "../lib/leerlijn.mts"
import { verstuur, mailGeconfigureerd } from "../lib/mail.mts"
import { pagina, esc, datum, type Attest } from "../lib/attestpagina.mts"

/**
 * Attesten:
 *   GET  /attest/<id>                   het attest (A4 liggend, afdrukken of bewaren als PDF) en verificatie: wie de link heeft,
 *                                       ziet of het attest geldig is. De id is lang en willekeurig; zonder link vind je het niet.
 *   GET  /attest/voorbeeld/<CODE>       voorbeeld voor beheerders (met het opschrift VOORBEELD)
 *   POST /api/attest/<id>/mail          { naar } attest mailen (de deelnemer zelf, zijn centrale of een beheerder)
 */

async function laadAttest(id: string): Promise<Attest | null> {
  const [a] = await db()`
    SELECT a.id, a.nummer, a.gebruiker_id, g.organisatie_id, g.email::text AS email, g.voornaam,
           coalesce(a.naam, concat_ws(' ', g.voornaam, g.achternaam)) AS naam, c.code AS cursus, coalesce(a.cursus_titel, c.titel) AS cursus_titel,
           a.score::float AS score, coalesce(a.modules, '[]'::jsonb) AS modules, a.lessen, a.toetsen, a.gestart_op, a.afgerond_op,
           a.uitgereikt_op, a.ingetrokken_op, a.gemaild_op, h.naam AS bedrijf
    FROM attesten a JOIN gebruikers g ON g.id = a.gebruiker_id JOIN cursussen c ON c.id = a.cursus_id
    LEFT JOIN organisaties o ON o.id = g.organisatie_id LEFT JOIN organisaties h ON h.id = coalesce(o.ouder_id, o.id)
    WHERE a.id = ${id} AND a.module_id IS NULL`
  return (a as Attest) ?? null
}

/** Mag deze gebruiker het attest beheren (mailen)? De deelnemer zelf, een beheerder, of de centrale van de deelnemer. */
async function magBeheren(ik: Gebruiker | null, a: Attest) {
  if (!ik) return false
  if (ik.id === a.gebruiker_id || isBeheer(ik)) return true
  if (ik.rol !== "centrale_verantwoordelijke" || !a.organisatie_id) return false
  const [r] = await db()`SELECT 1 AS ok FROM beheerde_organisaties(${ik.id}::uuid) WHERE organisatie_id = ${a.organisatie_id}`
  return !!r
}

function htmlAntwoord(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" },
  })
}
function melding(titel: string, tekstInhoud: string, status: number) {
  return htmlAntwoord(`<!doctype html><html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} · Betosoft Academy</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="/thema.js"></script><link rel="stylesheet" href="/stijl.css"></head>
<body><header class="kop"><div class="kop-in"><a class="logo" href="/"><img src="/logo.svg" alt="" width="34" height="30"><span class="logo-tekst">Betosoft <em>Academy</em></span></a></div></header>
<main style="max-width:640px"><h1 style="margin-top:24px">${esc(titel)}</h1><p>${esc(tekstInhoud)}</p><p><a href="/">Naar de startpagina</a></p></main></body></html>`, status)
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  try {
    // ---------- Attest mailen ----------
    const mailM = url.pathname.match(/^\/api\/attest\/([0-9a-f-]{36})\/mail$/i)
    if (mailM) {
      if (req.method !== "POST" || !eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
      const ik = await aangemeld(context)
      if (!ik) return fout("Niet aangemeld.", 401)
      const a = UUID.test(mailM[1]) ? await laadAttest(mailM[1]) : null
      if (!a || !(await magBeheren(ik, a))) return fout("Attest niet gevonden.", 404)
      if (a.ingetrokken_op) return fout("Dit attest is ingetrokken.")
      const b = await req.json().catch(() => ({}))
      const naar = tekst(b.naar, 254)
      if (!naar || !EMAIL.test(naar)) return fout("Vul een geldig e-mailadres in.")
      const link = `${url.origin}/attest/${a.id}`
      const onderwerp = `Attest ${a.cursus_titel} · ${a.naam}`
      const tekstMail = [
        `Beste${a.voornaam && naar.toLowerCase() === a.email.toLowerCase() ? " " + a.voornaam : ""},`,
        "",
        `${a.naam} heeft de opleiding "${a.cursus_titel}" van de Betosoft Academy met succes afgerond.`,
        `Attest ${a.nummer}, uitgereikt op ${datum(a.uitgereikt_op)}.`,
        "",
        `Bekijk, druk af of bewaar het attest als PDF: ${link}`,
        "Via dezelfde link controleer je ook of het attest geldig is.",
        "",
        "Betosoft Academy",
      ].join("\n")
      if (!mailGeconfigureerd()) {
        // geen mailserver ingesteld: het eigen mailprogramma opent met het bericht klaar
        const mailto = `mailto:${encodeURIComponent(naar)}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekstMail)}`
        return json({ ok: true, verstuurd: false, mailto })
      }
      const [teller] = await db()`
        SELECT count(*)::int AS n FROM auditlog WHERE actie = 'attest_gemaild' AND entiteit_id = ${a.id} AND tijdstip > now() - interval '1 day'`
      if (teller.n >= 10) return fout("Dit attest werd vandaag al vaak gemaild. Probeer morgen opnieuw.", 429)
      const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#223840;max-width:560px">
        <p>${esc(tekstMail.split("\n")[0])}</p>
        <p><strong>${esc(a.naam)}</strong> heeft de opleiding <strong>${esc(a.cursus_titel)}</strong> van de Betosoft Academy met succes afgerond.<br>
        Attest <span style="font-family:monospace">${esc(a.nummer)}</span>, uitgereikt op ${datum(a.uitgereikt_op)}.</p>
        <p><a href="${esc(link)}" style="display:inline-block;background:#1E5A66;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:600">Attest bekijken en afdrukken</a></p>
        <p style="font-size:13px;color:#5a6b70">Via dezelfde link controleer je ook of het attest geldig is: ${esc(link)}</p>
        <p style="font-size:13px;color:#5a6b70">Betosoft Academy · betosoft.be</p></div>`
      const r = await verstuur({ naar, naarNaam: naar.toLowerCase() === a.email.toLowerCase() ? a.naam : null, onderwerp, html, tekst: tekstMail, antwoordAan: ik.email })
      if (!r.ok) return fout(r.fout || "Versturen mislukt.", 502)
      await db()`UPDATE attesten SET gemaild_op = now(), gemaild_aantal = gemaild_aantal + 1 WHERE id = ${a.id}`
      await db()`SELECT log_actie('attest_gemaild', 'attest', ${a.id}::uuid, ${JSON.stringify({ naar, door: ik.id })}::jsonb)`
      return json({ ok: true, verstuurd: true })
    }

    if (req.method !== "GET") return fout("Niet gevonden.", 404)
    const ik = await aangemeld(context)

    // ---------- Voorbeeld voor beheerders ----------
    const vb = url.pathname.match(/^\/attest\/voorbeeld\/([A-Za-z0-9-]{1,20})\/?$/)
    if (vb) {
      if (!isBeheer(ik)) return melding("Geen toegang", "Het voorbeeld is enkel voor beheerders.", 403)
      const code = vb[1].toUpperCase()
      if (!CURSUSCODE.test(code)) return melding("Niet gevonden", "Deze cursus bestaat niet.", 404)
      const [c] = await db()`SELECT id, code, titel FROM cursussen WHERE code = ${code}`
      if (!c) return melding("Niet gevonden", "Deze cursus bestaat niet.", 404)
      const s = (await laadStructuren()).get(code)
      const modules = s
        ? beschikbaar(s.structuur).filter((m) => m.n !== "0").map((m) => ({ n: m.n, titel: m.titel, status: "af" }))
        : ((await db()`SELECT m.code AS n, m.titel, CASE WHEN m.gepubliceerd THEN 'af' ELSE 'nog' END AS status
                       FROM v_cursus_modules cm JOIN modules m ON m.id = cm.module_id WHERE cm.cursus_id = ${c.id} ORDER BY m.volgorde`) as any[])
      const nu = new Date().toISOString()
      const a: Attest = {
        id: "voorbeeld", nummer: `BSA-${new Date().getFullYear()}-00000`, gebruiker_id: "", organisatie_id: null, email: "", voornaam: "Voornaam",
        naam: "Voornaam Achternaam", cursus: code, cursus_titel: c.titel, score: 86, modules,
        lessen: s ? s.structuur.modules.filter((m) => m.avail).reduce((t, m) => t + m.lessen.length, 0) : null,
        toetsen: s ? s.structuur.modules.filter((m) => m.avail).reduce((t, m) => t + m.lessen.filter((l) => l.soort === "toets").length, 0) : null,
        gestart_op: new Date(Date.now() - 40 * 86_400_000).toISOString(), afgerond_op: nu, uitgereikt_op: nu, ingetrokken_op: null, gemaild_op: null,
        bedrijf: "Betoncentrale Voorbeeld",
      }
      return htmlAntwoord(pagina(a, { url: `${url.origin}/attest/…`, magMailen: false, voorbeeld: true, terug: "/beheer/#cursussen" }))
    }

    // ---------- Attest ----------
    const m = url.pathname.match(/^\/attest\/([0-9a-f-]{36})\/?$/i)
    if (!m || !UUID.test(m[1])) return melding("Niet gevonden", "Dit attest bestaat niet. Controleer de link.", 404)
    const a = await laadAttest(m[1].toLowerCase())
    if (!a) return melding("Niet gevonden", "Dit attest bestaat niet. Controleer de link.", 404)
    const mag = await magBeheren(ik, a)
    const terug = !ik ? "/" : ik.id === a.gebruiker_id ? "/leren/" : isBeheer(ik) ? "/beheer/#leerlijn" : ik.rol === "centrale_verantwoordelijke" ? "/centrale/#leerlijn" : "/"
    return htmlAntwoord(pagina(a, { url: `${url.origin}/attest/${a.id}`, magMailen: mag, terug }))
  } catch (err) {
    if (url.pathname.startsWith("/api/")) return dbFout(err)
    console.error("Attest", err)
    return melding("Er ging iets mis", "Probeer het later opnieuw.", 500)
  }
}

export const config: Config = {
  region: "fra",
  path: ["/attest/*", "/api/attest/*"],
}
