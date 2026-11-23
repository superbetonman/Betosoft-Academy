import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, EMAIL, UUID } from "../lib/db.mts"
import { eigenAanvraag, zetDemo } from "../lib/sessie.mts"
import { randomInt } from "node:crypto"
import { hashToken, nieuwToken } from "../lib/demo.mts"
import { verstuur } from "../lib/mail.mts"

/**
 * POST /api/demo/aanvraag — demoformulier (migratie 013): naam, e-mail, telefoon, onderneming, cursus, taal.
 * Stuurt een persoonlijke link per mail (Brevo, lib/mail.mts) en per sms als SMS_AFZENDER ingesteld is (Brevo, met sms-krediet).
 * De mail bevat een link (30 dagen) en een code van 6 cijfers (24 uur, max. 5 pogingen; POST /api/demo/code).
 * Zonder mail geen toegang (migratie 014): lukt de mail niet, dan een foutmelding.
 */

/** Belgisch nummer naar +32…; ook +31, +33 enz. Geen geldig nummer → null. */
export function telefoonNormaal(v: string | null): string | null {
  if (!v) return null
  let t = v.replace(/[\s.\-\/()]/g, "")
  if (t.startsWith("00")) t = "+" + t.slice(2)
  else if (t.startsWith("0")) t = "+32" + t.slice(1)
  return /^\+\d{8,15}$/.test(t) ? t : null
}

async function sms(naar: string, inhoud: string) {
  const sleutel = Netlify.env.get("BREVO_API_KEY")
  const afzender = Netlify.env.get("SMS_AFZENDER")
  if (!sleutel || !afzender) return false
  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
    method: "POST",
    headers: { "api-key": sleutel, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: afzender.slice(0, 11), recipient: naar.replace("+", ""), content: inhoud, type: "transactional" }),
  }).catch(() => null)
  if (!res?.ok) console.error("Brevo sms", res?.status, (await res?.text().catch(() => ""))?.slice(0, 300))
  return !!res?.ok
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

async function aanvraag(req: Request, context: Context) {
  const b = await req.json().catch(() => ({}))
  const fr = b.taal === "fr"
  const F = (nl: string, f: string) => (fr ? f : nl)
  const naam = tekst(b.naam, 120)
  const email = tekst(b.email, 254)
  const telefoon = telefoonNormaal(tekst(b.telefoon, 30))
  const onderneming = tekst(b.onderneming, 160)
  const code = (tekst(b.cursus, 20) ?? "").toUpperCase()
  if (!naam) return fout(F("Vul je naam in.", "Indiquez votre nom."))
  if (!email || !EMAIL.test(email)) return fout(F("Vul een geldig e-mailadres in.", "Indiquez une adresse e-mail valable."))
  if (!telefoon) return fout(F("Vul een geldig telefoonnummer in, bv. 0470 12 34 56.", "Indiquez un numéro de téléphone valable, p. ex. 0470 12 34 56."))
  const [c] = await db()`SELECT code, titel FROM cursussen WHERE code = ${code} AND startpagina <> 'niet_tonen'`
  if (!c) return fout(F("Deze demo bestaat niet.", "Cette démo n'existe pas."), 404)

  // misbruik beperken: max. 5 aanvragen per adres per uur, 200 in totaal per uur (mailkrediet)
  const [n] = await db()`SELECT count(*) FILTER (WHERE email = ${email})::int AS adres, count(*)::int AS alle FROM demo_bezoekers WHERE aangevraagd_op > now() - interval '1 hour'`
  if (n.adres >= 5 || n.alle >= 200) return fout(F("Te veel aanvragen. Probeer het later opnieuw.", "Trop de demandes. Réessayez plus tard."), 429)

  const token = nieuwToken()
  const pin = String(randomInt(0, 1000000)).padStart(6, "0")
  const [r] = await db()`
    INSERT INTO demo_bezoekers (naam, email, telefoon, onderneming, cursus, taal, token_hash)
    VALUES (${naam}, ${email}, ${telefoon}, ${onderneming}, ${code}, ${fr ? "fr" : "nl"}, ${hashToken(token)}) RETURNING id`
  await db()`UPDATE demo_bezoekers SET code_hash = ${hashToken(r.id + ":" + pin)} WHERE id = ${r.id}`
  const basis = Netlify.env.get("URL") || new URL(req.url).origin
  const pad = fr ? `/fr/demo/${code}/` : `/demo/${code}/`
  const link = `${basis}${pad}?toegang=${token}`
  const titel = fr && code === "BMC" ? "Chauffeur de camion malaxeur" : c.titel

  const m = await verstuur({
    naar: email,
    naarNaam: naam,
    onderwerp: F(`Je toegang tot de demo: ${titel}`, `Votre accès à la démo : ${titel}`),
    html: `<p>${F("Hallo", "Bonjour")} ${esc(naam)},</p>
      <p>${F("Met deze link open je de demo van de cursus", "Avec ce lien, vous ouvrez la démo de la formation")} <strong>${esc(titel)}</strong>.</p>
      <p><a href="${link}" style="display:inline-block;background:#B25C31;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:600">${F("Open de demo", "Ouvrir la démo")}</a></p>
      <p>${F("Of vul deze code in op de pagina van de demo:", "Ou saisissez ce code sur la page de la démo :")}<br><span style="font:700 24px/1.4 monospace;letter-spacing:.2em">${pin}</span></p>
      <p style="color:#4e5f66;font-size:13px">${F("De link werkt 30 dagen, de code 24 uur. Deze toegang is persoonlijk. Vragen? Antwoord gewoon op deze mail.", "Le lien est valable 30 jours, le code 24 heures. Cet accès est personnel. Des questions ? Répondez simplement à ce mail.")}</p>
      <p>Betosoft Academy</p>`,
    tekst: `${F("Hallo", "Bonjour")} ${naam},\n\n${F("Open de demo", "Ouvrir la démo")} (${titel}): ${link}\n${F("Of vul deze code in", "Ou saisissez ce code")}: ${pin}\n\n${F("De link werkt 30 dagen, de code 24 uur.", "Le lien est valable 30 jours, le code 24 heures.")}\n\nBetosoft Academy`,
  })
  if (!m.ok) {
    await db()`UPDATE demo_bezoekers SET verstuurd_via = 'mislukt' WHERE id = ${r.id}`
    return fout(F("We konden de mail niet versturen. Probeer het later opnieuw of mail naar thierry@tbmv.be.", "Nous n'avons pas pu envoyer le mail. Réessayez plus tard ou écrivez à thierry@tbmv.be."), 502)
  }
  const viaSms = await sms(telefoon, `${F("Betosoft Academy: je code voor de demo is", "Betosoft Academy : votre code pour la démo est")} ${pin}`)
  await db()`UPDATE demo_bezoekers SET verstuurd_via = ${viaSms ? "mail+sms" : "mail"} WHERE id = ${r.id}`
  return json({ ok: true, mail: true, id: r.id })
}

async function codeControle(req: Request, context: Context) {
  const b = await req.json().catch(() => ({}))
  const fr = b.taal === "fr"
  const F = (nl: string, f: string) => (fr ? f : nl)
  const id = tekst(b.id, 36)
  const pin = (tekst(b.code, 10) ?? "").replace(/\D/g, "")
  if (!id || !UUID.test(id) || pin.length !== 6) return fout(F("Vul de code van 6 cijfers in.", "Saisissez le code de 6 chiffres."))
  const [r] = await db()`
    UPDATE demo_bezoekers SET code_pogingen = code_pogingen + 1
    WHERE id = ${id} AND verstuurd_via LIKE 'mail%' AND aangevraagd_op > now() - interval '24 hours' AND code_pogingen < 5
    RETURNING id, cursus, taal, code_hash`
  if (!r) return fout(F("Deze code is niet meer geldig. Vraag een nieuwe aan.", "Ce code n'est plus valable. Demandez-en un nouveau."), 403)
  if (r.code_hash !== hashToken(id + ":" + pin)) return fout(F("Deze code klopt niet.", "Ce code n'est pas correct."), 403)
  zetDemo(context, r.id)
  return json({ ok: true, url: r.taal === "fr" ? `/fr/demo/${r.cursus}/` : `/demo/${r.cursus}/` })
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST" || !eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  try {
    return new URL(req.url).pathname.endsWith("/code") ? await codeControle(req, context) : await aanvraag(req, context)
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = { region: "fra", path: ["/api/demo/aanvraag", "/api/demo/code"] }
