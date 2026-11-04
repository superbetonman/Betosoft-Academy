import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, UUID, EMAIL } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, type Gebruiker } from "../lib/sessie.mts"
import { maakUitnodiging } from "../lib/uitnodiging.mts"
import { laadDeelnemers, leerlijn, volleNaam } from "../lib/leerlijn.mts"

/**
 * Portaal voor de beheerder van een onderneming (in de code: centrale) of van een locatie.
 * Bereik: de eigen organisatie, plus alle locaties als het een hoofdbedrijf is.
 */

type Ctx = { ik: Gebruiker; b: any; q: URLSearchParams; id?: string; req: Request; bereik: string[]; hoofd: string; isHoofd: boolean }
type Handler = (c: Ctx) => Promise<Response>
const sql = () => db()
const uuid = (v: unknown) => {
  const s = tekst(v, 36)
  return s && UUID.test(s) ? s : null
}

async function persoonInBereik(gid: string | undefined, bereik: string[]) {
  if (!gid) return null
  const [g] = await sql()`SELECT id, organisatie_id, rol::text AS rol FROM gebruikers WHERE id = ${gid} AND organisatie_id = ANY(${bereik}::uuid[])`
  return g ?? null
}
async function rechtInBereik(rid: string | undefined, hoofd: string, bereik: string[]) {
  if (!rid) return null
  const [r] = await sql()`SELECT id, organisatie_id FROM toegangsrechten WHERE id = ${rid} AND (organisatie_id = ${hoofd} OR organisatie_id = ANY(${bereik}::uuid[]))`
  return r ?? null
}

const routes: Record<string, Handler> = {
  "GET overzicht": async ({ bereik, hoofd, isHoofd, ik }) => {
    const [org] = await sql()`SELECT id, naam, btw_nummer, adres, contact_naam, contact_email FROM organisaties WHERE id = ${ik.organisatie_id}`
    const locaties = await sql()`SELECT id, naam, adres FROM organisaties WHERE id = ANY(${bereik}::uuid[]) AND ouder_id IS NOT NULL ORDER BY naam`
    const rechten = await sql()`
      SELECT tr.id, p.naam AS product, p.type AS product_type, tr.start_datum::text, tr.eind_datum::text, tr.status, tr.geldig,
             tr.aantal_plaatsen, COALESCE(vp.gebruikt, 0)::int AS gebruikt,
             CASE WHEN tr.eind_datum IS NULL THEN NULL ELSE tr.eind_datum - current_date END AS dagen_resterend,
             vs.gebruikt AS verlengingen, vs.maximum AS verlengingen_max, vs.aanvragen_tot::text, vs.prijs_excl_btw AS verlenging_prijs,
             EXISTS (SELECT 1 FROM aanvragen a WHERE a.toegangsrecht_id = tr.id AND a.status IN ('nieuw','gefactureerd')) AS verlenging_open
      FROM v_geldige_rechten tr JOIN producten p ON p.id = tr.product_id
      LEFT JOIN v_plaatsen vp ON vp.toegangsrecht_id = tr.id
      JOIN v_verlenging_stand vs ON vs.toegangsrecht_id = tr.id
      WHERE tr.organisatie_id = ${hoofd} OR tr.organisatie_id = ANY(${bereik}::uuid[])
      ORDER BY tr.geldig DESC, tr.eind_datum NULLS LAST`
    const [cijfers] = await sql()`
      SELECT count(*)::int AS medewerkers,
             count(*) FILTER (WHERE modules_toegang > 0)::int AS met_opleiding,
             count(*) FILTER (WHERE account_actief)::int AS aangemeld
      FROM v_medewerker_stand WHERE organisatie_id = ANY(${bereik}::uuid[]) AND actief`
    // voortgang, score en attesten uit de cursusapps (leerlijn)
    const lijnen = await leerlijn(await laadDeelnemers({ orgs: bereik, enkelActief: true }))
    const lopend = lijnen.flatMap((d) => d.cursussen).filter((c) => c.pct !== null && (c.toegang || c.deels))
    const scores = lijnen.map((d) => d.totaal.gem_score).filter((x): x is number => x !== null)
    Object.assign(cijfers, {
      modules_af: lijnen.reduce((t, d) => t + d.totaal.modules_af, 0),
      attesten: lijnen.reduce((t, d) => t + d.attesten.filter((a) => !a.ingetrokken_op).length, 0),
      gem_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      gem_voortgang: lopend.length ? Math.round(lopend.reduce((t, c) => t + (c.pct ?? 0), 0) / lopend.length) : null,
    })
    return json({ organisatie: org, isHoofd, locaties, rechten, cijfers })
  },

  "GET medewerkers": async ({ bereik }) => {
    const rijen = await sql()`
      SELECT s.*, o.naam AS locatie, s.eerste_einde::text AS eerste_einde,
             COALESCE((SELECT json_agg(json_build_object('toewijzing', pt.id, 'recht', tr.id, 'product', p.naam, 'eind', tr.eind_datum::text))
                       FROM plaats_toewijzingen pt JOIN toegangsrechten tr ON tr.id = pt.toegangsrecht_id JOIN producten p ON p.id = tr.product_id
                       WHERE pt.gebruiker_id = s.gebruiker_id AND pt.ingetrokken_op IS NULL), '[]') AS opleidingen
      FROM v_medewerker_stand s JOIN organisaties o ON o.id = s.organisatie_id
      WHERE s.organisatie_id = ANY(${bereik}::uuid[])
      ORDER BY s.actief DESC, s.achternaam, s.voornaam`
    // voortgang, score en attesten uit de cursusapps
    const lijnen = new Map((await leerlijn(await laadDeelnemers({ orgs: bereik }))).map((d) => [d.id, d]))
    return json({
      medewerkers: rijen.map((r: any) => {
        const d = lijnen.get(r.gebruiker_id)
        if (!d) return r
        const lopend = d.cursussen.filter((c) => c.pct !== null && (c.toegang || c.deels))
        const laatst = [r.laatste_activiteit, d.totaal.laatst].filter(Boolean).map((x) => new Date(x).getTime())
        return {
          ...r,
          voortgang_pct: lopend.length ? Math.round(lopend.reduce((t, c) => t + (c.pct ?? 0), 0) / lopend.length) : null,
          gem_score: d.totaal.gem_score,
          attesten: d.attesten.filter((a) => !a.ingetrokken_op).length,
          punten: d.totaal.punten,
          laatste_activiteit: laatst.length ? new Date(Math.max(...laatst)).toISOString() : null,
        }
      }),
    })
  },

  "GET scorebord": async ({ bereik, q }) => {
    const locatie = uuid(q.get("locatie"))
    const filter = locatie && bereik.includes(locatie) ? [locatie] : bereik
    const lijnen = await leerlijn(await laadDeelnemers({ orgs: filter, enkelActief: true }))
    const rijen = lijnen
      .filter((d) => d.cursussen.some((c) => c.toegang || c.deels) || d.totaal.punten > 0)
      .map((d) => {
        const lopend = d.cursussen.filter((c) => c.pct !== null && (c.toegang || c.deels))
        return {
          gebruiker_id: d.id, voornaam: d.voornaam, achternaam: d.achternaam, locatie: d.locatie,
          punten: d.totaal.punten, niveau: d.totaal.niveau.naam, modules_af: d.totaal.modules_af, lessen_af: d.totaal.lessen_af,
          cursussen_af: d.totaal.cursussen_af, attesten: d.attesten.filter((a) => !a.ingetrokken_op).length,
          voortgang_pct: lopend.length ? Math.round(lopend.reduce((t, c) => t + (c.pct ?? 0), 0) / lopend.length) : null,
          gem_score: d.totaal.gem_score, badges: d.totaal.aantal_badges,
        }
      })
      .sort((a, b) => b.punten - a.punten || b.modules_af - a.modules_af || (b.voortgang_pct ?? -1) - (a.voortgang_pct ?? -1))
    return json({ scorebord: rijen })
  },

  "GET leerlijn": async ({ bereik, q }) => {
    const locatie = uuid(q.get("locatie"))
    const filter = locatie && bereik.includes(locatie) ? [locatie] : bereik
    const lijnen = await leerlijn(await laadDeelnemers({ orgs: filter }))
    return json({
      medewerkers: lijnen.map((d) => ({
        id: d.id, naam: volleNaam(d), email: d.email, locatie: d.locatie, actief: d.actief,
        totaal: { punten: d.totaal.punten, niveau: d.totaal.niveau, lessen_af: d.totaal.lessen_af, modules_af: d.totaal.modules_af, cursussen_af: d.totaal.cursussen_af, gem_score: d.totaal.gem_score, laatst: d.totaal.laatst, badges: d.totaal.badges },
        cursussen: d.cursussen.map(({ dagen, ...c }) => c),
        attesten: d.attesten,
      })),
    })
  },

  "POST medewerkers": async ({ b, bereik, ik, req, hoofd }) => {
    const email = tekst(b.email, 254)
    const voornaam = tekst(b.voornaam, 80)
    if (!voornaam) return fout("Vul minstens de voornaam in.")
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    const locatie = uuid(b.locatie_id) ?? ik.organisatie_id!
    if (!bereik.includes(locatie)) return fout("Je kunt enkel medewerkers toevoegen aan je eigen onderneming of locaties.", 403)
    const [g] = await sql()`SELECT voeg_cursist_toe(${locatie}::uuid, ${email}, ${voornaam}, ${tekst(b.achternaam, 80)}) AS id`
    const recht = uuid(b.recht_id)
    if (recht) {
      if (!(await rechtInBereik(recht, hoofd, bereik))) return fout("Onbekende opleiding.", 403)
      await sql()`SELECT wijs_plaats_toe(${recht}::uuid, ${g.id}::uuid)`
    }
    const uitnodiging = await maakUitnodiging(req, g.id, ik.id)
    return json({ ok: true, gebruiker: g.id, uitnodiging })
  },

  "POST medewerkers/wijzig": async ({ b, id: gid, bereik }) => {
    const g = await persoonInBereik(gid, bereik)
    if (!g) return fout("Medewerker niet gevonden.", 404)
    const locatie = uuid(b.locatie_id)
    if (locatie && !bereik.includes(locatie)) return fout("Onbekende locatie.", 403)
    await sql()`
      UPDATE gebruikers SET voornaam = coalesce(${tekst(b.voornaam, 80)}, voornaam), achternaam = ${tekst(b.achternaam, 80)},
             organisatie_id = coalesce(${locatie}::uuid, organisatie_id)
      WHERE id = ${gid}`
    return json({ ok: true })
  },

  "POST medewerkers/actief": async ({ b, id: gid, bereik, ik }) => {
    if (gid === ik.id) return fout("Je kunt je eigen account niet uitschakelen.")
    const g = await persoonInBereik(gid, bereik)
    if (!g) return fout("Medewerker niet gevonden.", 404)
    const actief = b.actief === true
    await sql()`UPDATE gebruikers SET actief = ${actief} WHERE id = ${gid}`
    if (!actief) await sql()`UPDATE plaats_toewijzingen SET ingetrokken_op = now() WHERE gebruiker_id = ${gid} AND ingetrokken_op IS NULL`
    await sql()`SELECT log_actie('gebruiker_actief', 'gebruiker', ${gid}::uuid, ${JSON.stringify({ actief, door: ik.id })}::jsonb)`
    return json({ ok: true })
  },

  "POST medewerkers/rol": async ({ b, id: gid, bereik, ik }) => {
    if (gid === ik.id) return fout("Je kunt je eigen rol niet wijzigen.")
    const g = await persoonInBereik(gid, bereik)
    if (!g) return fout("Medewerker niet gevonden.", 404)
    const rol = b.rol === "centrale_verantwoordelijke" ? "centrale_verantwoordelijke" : "cursist"
    await sql()`UPDATE gebruikers SET rol = ${rol}::gebruiker_rol WHERE id = ${gid}`
    await sql()`SELECT log_actie('rol_gewijzigd', 'gebruiker', ${gid}::uuid, ${JSON.stringify({ rol, door: ik.id })}::jsonb)`
    return json({ ok: true })
  },

  "POST medewerkers/uitnodiging": async ({ id: gid, bereik, req, ik }) => {
    const g = await persoonInBereik(gid, bereik)
    if (!g) return fout("Medewerker niet gevonden.", 404)
    return json({ ok: true, uitnodiging: await maakUitnodiging(req, gid!, ik.id) })
  },

  "POST plaatsen": async ({ b, bereik, hoofd }) => {
    const recht = uuid(b.recht_id)
    const g = await persoonInBereik(uuid(b.gebruiker_id) ?? undefined, bereik)
    if (!g || !recht || !(await rechtInBereik(recht, hoofd, bereik))) return fout("Kies een opleiding en een medewerker.")
    const [r] = await sql()`SELECT wijs_plaats_toe(${recht}::uuid, ${g.id}::uuid) AS id`
    return json({ ok: true, toewijzing: r.id })
  },

  "POST plaatsen/intrek": async ({ id: tid, bereik }) => {
    const r = await sql()`
      UPDATE plaats_toewijzingen pt SET ingetrokken_op = now()
      FROM gebruikers g WHERE pt.id = ${tid} AND pt.ingetrokken_op IS NULL AND g.id = pt.gebruiker_id AND g.organisatie_id = ANY(${bereik}::uuid[])
      RETURNING pt.id`
    if (!r.length) return fout("Toewijzing niet gevonden.", 404)
    await sql()`SELECT log_actie('plaats_ingetrokken', 'plaats', ${tid}::uuid, '{}'::jsonb)`
    return json({ ok: true })
  },

  "POST locaties": async ({ b, isHoofd, ik }) => {
    if (!isHoofd) return fout("Enkel de beheerder van het hoofdbedrijf kan locaties toevoegen.", 403)
    const naam = tekst(b.naam, 160)
    if (!naam) return fout("Vul de naam van de locatie in.")
    const [l] = await sql()`INSERT INTO organisaties (naam, adres, ouder_id) VALUES (${naam}, ${tekst(b.adres, 300)}, ${ik.organisatie_id}) RETURNING id`
    await sql()`SELECT log_actie('locatie_toegevoegd', 'organisatie', ${l.id}::uuid, ${JSON.stringify({ naam, door: ik.id })}::jsonb)`
    return json({ ok: true, id: l.id })
  },

  "POST rechten/verlenging": async ({ id: rid, bereik, hoofd, b }) => {
    if (!(await rechtInBereik(rid, hoofd, bereik))) return fout("Opleiding niet gevonden.", 404)
    const [r] = await sql()`SELECT vraag_verlenging(${rid}::uuid, ${tekst(b.opmerking, 300)}) AS id`
    return json({ ok: true, aanvraag: r.id })
  },

  "POST bestelling": async ({ b, ik, hoofd }) => {
    // Extra plaatsen of een nieuwe opleiding bestellen: komt als aanvraag bij Betosoft binnen
    const product = uuid(b.product_id)
    const n = Number(b.aantal_plaatsen)
    if (!product) return fout("Kies een opleiding.")
    if (!Number.isInteger(n) || n < 1 || n > 500) return fout("Aantal plaatsen: 1 tot 500.")
    const [o] = await sql()`SELECT naam, btw_nummer, adres FROM organisaties WHERE id = ${hoofd}`
    const [p] = await sql()`SELECT id FROM producten WHERE id = ${product} AND product_te_koop(id)`
    if (!p) return fout("Deze opleiding is niet beschikbaar.")
    await sql()`
      INSERT INTO aanvragen (type, voornaam, achternaam, email, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, opmerking, organisatie_id, gebruiker_id)
      VALUES ('centrale', ${ik.voornaam}, ${ik.achternaam}, ${ik.email}, ${o.naam}, ${o.btw_nummer}, ${o.adres}, ${product}, ${n},
              ${["Bestelling via het portaal van de onderneming", tekst(b.opmerking, 500)].filter(Boolean).join(" · ")}, ${hoofd}, ${ik.id})`
    return json({ ok: true })
  },

  "GET producten": async () => {
    const rijen = await sql()`
      SELECT id, naam, type, prijs_excl_btw, periode, geldigheid_maanden, beschrijving FROM producten
      WHERE actief AND type <> 'abonnement' AND product_te_koop(id) ORDER BY CASE type WHEN 'traject' THEN 1 ELSE 2 END, code`
    return json({ producten: rijen })
  },
}

export default async (req: Request, context: Context) => {
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  try {
    const ik = await aangemeld(context)
    if (!ik) return fout("Niet aangemeld.", 401)
    if (ik.rol !== "centrale_verantwoordelijke" || !ik.organisatie_id) return fout("Geen toegang.", 403)
    const bereik = (await sql()`SELECT organisatie_id FROM beheerde_organisaties(${ik.id}::uuid)`).map((r: any) => r.organisatie_id)
    if (!bereik.length) return fout("Geen toegang.", 403)
    const [h] = await sql()`SELECT hoofdorganisatie(${ik.organisatie_id}::uuid) AS id, (SELECT ouder_id IS NULL FROM organisaties WHERE id = ${ik.organisatie_id}) AS is_hoofd`

    const url = new URL(req.url)
    const delen = url.pathname.replace(/^\/api\/centrale\/?/, "").split("/").filter(Boolean)
    let sleutel = `${req.method} ${delen.join("/")}`
    let rid: string | undefined
    if (delen.length >= 2 && UUID.test(delen[1])) {
      rid = delen[1]
      sleutel = `${req.method} ${delen[0]}${delen[2] ? "/" + delen[2] : ""}`
    }
    const handler = routes[sleutel]
    if (!handler) return fout("Niet gevonden.", 404)
    const b = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    return await handler({ ik, b, q: url.searchParams, id: rid, req, bereik, hoofd: h.id, isHoofd: !!h.is_hoofd })
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: "/api/centrale/*",
}
