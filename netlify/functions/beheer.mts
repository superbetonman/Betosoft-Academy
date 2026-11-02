import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, geheel, UUID, EMAIL, DATUM } from "../lib/db.mts"
import { COOKIE, leesSessie } from "../lib/sessie.mts"

type Handler = (p: { b: any; q: URLSearchParams; id?: string }) => Promise<Response>

const sql = () => db()

function id(v: unknown) {
  const s = tekst(v, 36)
  return s && UUID.test(s) ? s : null
}
function datum(v: unknown) {
  const s = tekst(v, 10)
  return s && DATUM.test(s) ? s : null
}

const routes: Record<string, Handler> = {
  // ---------- Overzicht ----------
  "GET overzicht": async () => {
    const [cijfers] = await sql()`
      SELECT
        (SELECT count(*)::int FROM aanvragen WHERE status = 'nieuw') AS nieuwe_aanvragen,
        (SELECT count(*)::int FROM aanvragen WHERE status = 'gefactureerd') AS gefactureerd,
        (SELECT count(*)::int FROM v_geldige_rechten WHERE geldig) AS actieve_rechten,
        (SELECT count(*)::int FROM gebruikers WHERE rol <> 'beheerder') AS cursisten,
        (SELECT count(*)::int FROM organisaties) AS centrales`
    const aflopend = await sql()`
      SELECT id, klant, email, product_naam, eind_datum::text, dagen_resterend
      FROM v_aflopend ORDER BY eind_datum`
    return json({ cijfers, aflopend })
  },

  // ---------- Aanvragen ----------
  "GET aanvragen": async ({ q }) => {
    const st = q.get("status")
    const status = ["nieuw", "gefactureerd", "geactiveerd", "geweigerd"].includes(st ?? "") ? st : null
    const rijen = await sql()`
      SELECT a.id, a.type, a.status, a.voornaam, a.achternaam, a.email, a.telefoon, a.organisatie_naam, a.btw_nummer,
             a.adres, a.aantal_plaatsen, a.opmerking, a.factuurnummer, a.ingediend_op, a.verwerkt_op,
             p.naam AS product, p.prijs_excl_btw, p.periode, p.geldigheid_maanden
      FROM aanvragen a LEFT JOIN producten p ON p.id = a.product_id
      WHERE (${status}::text IS NULL AND a.status IN ('nieuw','gefactureerd')) OR a.status::text = ${status}::text
      ORDER BY a.ingediend_op DESC LIMIT 300`
    return json({ aanvragen: rijen })
  },

  "POST aanvragen/factureer": async ({ b, id: aid }) => {
    const f = tekst(b.factuurnummer, 60)
    if (!f) return fout("Vul het factuurnummer in.")
    const r = await sql()`
      UPDATE aanvragen SET status = 'gefactureerd', factuurnummer = ${f}
      WHERE id = ${aid} AND status = 'nieuw' RETURNING id`
    if (!r.length) return fout("Aanvraag niet gevonden of niet meer nieuw.")
    await sql()`SELECT log_actie('aanvraag_gefactureerd', 'aanvraag', ${aid}::uuid, ${JSON.stringify({ factuur: f })}::jsonb)`
    return json({ ok: true })
  },

  "POST aanvragen/activeer": async ({ b, id: aid }) => {
    const f = tekst(b.factuurnummer, 60)
    const start = datum(b.start_datum)
    const [r] = await sql()`SELECT activeer_aanvraag(${aid}::uuid, ${f}, COALESCE(${start}::date, current_date)) AS recht`
    return json({ ok: true, recht: r.recht })
  },

  "POST aanvragen/weiger": async ({ b, id: aid }) => {
    const reden = tekst(b.reden, 300)
    const r = await sql()`
      UPDATE aanvragen SET status = 'geweigerd', verwerkt_op = now()
      WHERE id = ${aid} AND status IN ('nieuw','gefactureerd') RETURNING id`
    if (!r.length) return fout("Aanvraag niet gevonden of al verwerkt.")
    await sql()`SELECT log_actie('aanvraag_geweigerd', 'aanvraag', ${aid}::uuid, ${JSON.stringify({ reden })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Toegangsrechten ----------
  "GET rechten": async ({ q }) => {
    const filter = q.get("filter") ?? "actief"
    const zoek = tekst(q.get("zoek"), 80)
    const patroon = zoek ? `%${zoek}%` : null
    const rijen = await sql()`
      SELECT tr.id, tr.status, tr.geldig, tr.start_datum::text, tr.eind_datum::text, tr.factuurnummer, tr.aantal_plaatsen,
             tr.organisatie_id, tr.gebruiker_id, tr.opmerking,
             p.naam AS product, p.type AS product_type, p.periode, p.geldigheid_maanden,
             CASE WHEN tr.organisatie_id IS NOT NULL THEN 'centrale' ELSE 'individueel' END AS klanttype,
             COALESCE(o.naam, concat_ws(' ', g.voornaam, g.achternaam)) AS klant,
             COALESCE(g.email, o.contact_email) AS email,
             COALESCE(vp.gebruikt, 0)::int AS plaatsen_gebruikt,
             CASE WHEN tr.eind_datum IS NULL THEN NULL ELSE (tr.eind_datum - current_date) END AS dagen_resterend
      FROM v_geldige_rechten tr
      JOIN producten p ON p.id = tr.product_id
      LEFT JOIN gebruikers g ON g.id = tr.gebruiker_id
      LEFT JOIN organisaties o ON o.id = tr.organisatie_id
      LEFT JOIN v_plaatsen vp ON vp.toegangsrecht_id = tr.id
      WHERE (
        (${filter} = 'actief' AND tr.geldig) OR
        (${filter} = 'aflopend' AND tr.status = 'actief' AND tr.eind_datum BETWEEN current_date AND current_date + 14) OR
        (${filter} = 'verlopen' AND (tr.eind_datum < current_date OR tr.status <> 'actief')) OR
        (${filter} = 'alle')
      )
      AND (${patroon}::text IS NULL OR o.naam ILIKE ${patroon} OR g.email ILIKE ${patroon}
           OR concat_ws(' ', g.voornaam, g.achternaam) ILIKE ${patroon} OR tr.factuurnummer ILIKE ${patroon})
      ORDER BY tr.eind_datum NULLS LAST, klant LIMIT 500`
    return json({ rechten: rijen })
  },

  "GET rechten/verlengingen": async ({ id: rid }) => {
    const rijen = await sql()`
      SELECT oude_eind_datum::text, nieuwe_eind_datum::text, factuurnummer, opmerking, verlengd_op
      FROM verlengingen WHERE toegangsrecht_id = ${rid} ORDER BY verlengd_op DESC`
    return json({ verlengingen: rijen })
  },

  "POST rechten/verleng": async ({ b, id: rid }) => {
    const maanden = geheel(b.maanden, 1, 60)
    const eind = datum(b.eind_datum)
    if (!maanden && !eind) return fout("Kies een aantal maanden of een einddatum.")
    const [r] = await sql()`
      SELECT verleng_recht(${rid}::uuid, ${eind ? null : maanden}::int, ${eind}::date,
                           ${tekst(b.factuurnummer, 60)}, ${tekst(b.opmerking, 300)})::text AS eind`
    return json({ ok: true, eind_datum: r.eind })
  },

  "POST rechten/status": async ({ b, id: rid }) => {
    const status = ["actief", "gepauzeerd", "ingetrokken"].includes(b.status) ? b.status : null
    if (!status) return fout("Ongeldige status.")
    const r = await sql()`UPDATE toegangsrechten SET status = ${status}::recht_status WHERE id = ${rid} RETURNING id`
    if (!r.length) return fout("Toegangsrecht niet gevonden.", 404)
    await sql()`SELECT log_actie('recht_status', 'toegangsrecht', ${rid}::uuid, ${JSON.stringify({ status })}::jsonb)`
    return json({ ok: true })
  },

  "POST rechten/plaatsen": async ({ b, id: rid }) => {
    const n = geheel(b.aantal_plaatsen, 1, 500)
    if (!n) return fout("Aantal plaatsen moet tussen 1 en 500 liggen.")
    const [vp] = await sql()`SELECT gebruikt::int FROM v_plaatsen WHERE toegangsrecht_id = ${rid}`
    if (!vp) return fout("Dit is geen toegangsrecht van een centrale.")
    if (n < vp.gebruikt) return fout(`Er zijn al ${vp.gebruikt} plaatsen toegewezen. Trek eerst plaatsen in.`)
    await sql()`UPDATE toegangsrechten SET aantal_plaatsen = ${n} WHERE id = ${rid}`
    await sql()`SELECT log_actie('plaatsen_gewijzigd', 'toegangsrecht', ${rid}::uuid, ${JSON.stringify({ aantal: n, factuur: tekst(b.factuurnummer, 60) })}::jsonb)`
    return json({ ok: true })
  },

  /** Rechtstreeks een toegangsrecht toekennen (bv. na een telefonische bestelling). Loopt via een aanvraag, zodat dezelfde regels gelden. */
  "POST rechten": async ({ b }) => {
    const type = b.type === "centrale" ? "centrale" : "individueel"
    const email = tekst(b.email, 254)
    const product = id(b.product_id)
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    if (!product) return fout("Kies een product.")
    const plaatsen = type === "centrale" ? geheel(b.aantal_plaatsen, 1, 500) : 1
    if (!plaatsen) return fout("Vul het aantal plaatsen in.")
    const btw = tekst(b.btw_nummer, 20)?.replace(/[\s.]/g, "").toUpperCase() ?? null
    if (type === "centrale" && !tekst(b.organisatie_naam, 160)) return fout("Vul de naam van de centrale in.")
    const aid = crypto.randomUUID()
    const f = tekst(b.factuurnummer, 60)
    const start = datum(b.start_datum)
    const [, [r]] = await sql().transaction([
      sql()`INSERT INTO aanvragen (id, type, voornaam, achternaam, email, telefoon, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, opmerking, factuurnummer)
            VALUES (${aid}, ${type}, ${tekst(b.voornaam, 80)}, ${tekst(b.achternaam, 80)}, ${email}, ${tekst(b.telefoon, 40)},
                    ${type === "centrale" ? tekst(b.organisatie_naam, 160) : null}, ${type === "centrale" ? btw : null},
                    ${tekst(b.adres, 300)}, ${product}, ${plaatsen}, ${"Rechtstreeks toegekend door beheerder"}, ${f})`,
      sql()`SELECT activeer_aanvraag(${aid}::uuid, ${f}, COALESCE(${start}::date, current_date)) AS recht`,
    ])
    return json({ ok: true, recht: (r as any).recht })
  },

  // ---------- Centrales ----------
  "GET centrales": async () => {
    const rijen = await sql()`
      SELECT o.id, o.naam, o.btw_nummer, o.contact_naam, o.contact_email, o.telefoon,
             (SELECT count(*)::int FROM gebruikers g WHERE g.organisatie_id = o.id) AS personen,
             (SELECT count(*)::int FROM v_geldige_rechten tr WHERE tr.organisatie_id = o.id AND tr.geldig) AS actieve_rechten,
             (SELECT COALESCE(sum(vp.aantal_plaatsen), 0)::int FROM v_plaatsen vp JOIN v_geldige_rechten tr ON tr.id = vp.toegangsrecht_id WHERE vp.organisatie_id = o.id AND tr.geldig) AS plaatsen,
             (SELECT COALESCE(sum(vp.gebruikt), 0)::int FROM v_plaatsen vp JOIN v_geldige_rechten tr ON tr.id = vp.toegangsrecht_id WHERE vp.organisatie_id = o.id AND tr.geldig) AS plaatsen_gebruikt
      FROM organisaties o ORDER BY o.naam`
    return json({ centrales: rijen })
  },

  "GET centrales/detail": async ({ id: oid }) => {
    const [centrale] = await sql()`SELECT * FROM organisaties WHERE id = ${oid}`
    if (!centrale) return fout("Centrale niet gevonden.", 404)
    const personen = await sql()`
      SELECT g.id, g.email, g.voornaam, g.achternaam, g.rol, g.actief, g.aangemaakt_op,
             COALESCE(json_agg(json_build_object('toewijzing', pt.id, 'recht', pt.toegangsrecht_id, 'product', p.naam))
                      FILTER (WHERE pt.id IS NOT NULL), '[]') AS plaatsen
      FROM gebruikers g
      LEFT JOIN plaats_toewijzingen pt ON pt.gebruiker_id = g.id AND pt.ingetrokken_op IS NULL
      LEFT JOIN toegangsrechten tr ON tr.id = pt.toegangsrecht_id
      LEFT JOIN producten p ON p.id = tr.product_id
      WHERE g.organisatie_id = ${oid}
      GROUP BY g.id ORDER BY g.rol DESC, g.achternaam, g.voornaam`
    const rechten = await sql()`
      SELECT tr.id, p.naam AS product, tr.status, tr.geldig, tr.start_datum::text, tr.eind_datum::text, tr.factuurnummer,
             tr.aantal_plaatsen, COALESCE(vp.gebruikt, 0)::int AS gebruikt
      FROM v_geldige_rechten tr JOIN producten p ON p.id = tr.product_id
      LEFT JOIN v_plaatsen vp ON vp.toegangsrecht_id = tr.id
      WHERE tr.organisatie_id = ${oid} ORDER BY tr.geldig DESC, tr.eind_datum DESC NULLS FIRST`
    return json({ centrale, personen, rechten })
  },

  "POST centrales/wijzig": async ({ b, id: oid }) => {
    const naam = tekst(b.naam, 160)
    if (!naam) return fout("Naam is verplicht.")
    const r = await sql()`
      UPDATE organisaties SET naam = ${naam}, btw_nummer = ${tekst(b.btw_nummer, 20)?.replace(/[\s.]/g, "").toUpperCase() ?? null},
             adres = ${tekst(b.adres, 300)}, contact_naam = ${tekst(b.contact_naam, 160)}, contact_email = ${tekst(b.contact_email, 254)},
             telefoon = ${tekst(b.telefoon, 40)}, opmerking = ${tekst(b.opmerking, 1000)}
      WHERE id = ${oid} RETURNING id`
    if (!r.length) return fout("Centrale niet gevonden.", 404)
    return json({ ok: true })
  },

  "POST centrales/cursist": async ({ b, id: oid }) => {
    const email = tekst(b.email, 254)
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    const voornaam = tekst(b.voornaam, 80)
    if (!voornaam) return fout("Vul minstens de voornaam in.")
    const [g] = await sql()`SELECT voeg_cursist_toe(${oid}::uuid, ${email}, ${voornaam}, ${tekst(b.achternaam, 80)}) AS id`
    const recht = id(b.recht_id)
    if (recht) await sql()`SELECT wijs_plaats_toe(${recht}::uuid, ${g.id}::uuid)`
    return json({ ok: true, gebruiker: g.id })
  },

  "POST plaatsen": async ({ b }) => {
    const recht = id(b.recht_id)
    const gebruiker = id(b.gebruiker_id)
    if (!recht || !gebruiker) return fout("Kies een toegangsrecht en een persoon.")
    const [r] = await sql()`SELECT wijs_plaats_toe(${recht}::uuid, ${gebruiker}::uuid) AS id`
    return json({ ok: true, toewijzing: r.id })
  },

  "POST plaatsen/intrek": async ({ id: tid }) => {
    const r = await sql()`
      UPDATE plaats_toewijzingen SET ingetrokken_op = now() WHERE id = ${tid} AND ingetrokken_op IS NULL RETURNING id`
    if (!r.length) return fout("Toewijzing niet gevonden.", 404)
    await sql()`SELECT log_actie('plaats_ingetrokken', 'plaats', ${tid}::uuid, '{}'::jsonb)`
    return json({ ok: true })
  },

  // ---------- Cursisten ----------
  "GET cursisten": async ({ q }) => {
    const zoek = tekst(q.get("zoek"), 80)
    const patroon = zoek ? `%${zoek}%` : null
    const rijen = await sql()`
      SELECT g.id, g.email, g.voornaam, g.achternaam, g.rol, g.actief, g.aangemaakt_op, o.naam AS centrale,
             (SELECT count(DISTINCT module_id)::int FROM v_module_toegang v WHERE v.gebruiker_id = g.id) AS modules_toegang,
             (SELECT count(*)::int FROM voortgang vg WHERE vg.gebruiker_id = g.id) AS lessen_af,
             (SELECT count(*)::int FROM attesten a WHERE a.gebruiker_id = g.id AND a.ingetrokken_op IS NULL) AS attesten,
             (SELECT COALESCE(sum(punten), 0)::int FROM punten pt WHERE pt.gebruiker_id = g.id) AS punten
      FROM gebruikers g LEFT JOIN organisaties o ON o.id = g.organisatie_id
      WHERE g.rol <> 'beheerder'
        AND (${patroon}::text IS NULL OR g.email ILIKE ${patroon} OR concat_ws(' ', g.voornaam, g.achternaam) ILIKE ${patroon} OR o.naam ILIKE ${patroon})
      ORDER BY g.aangemaakt_op DESC LIMIT 500`
    return json({ cursisten: rijen })
  },

  "POST cursisten/actief": async ({ b, id: gid }) => {
    const r = await sql()`UPDATE gebruikers SET actief = ${b.actief === true} WHERE id = ${gid} AND rol <> 'beheerder' RETURNING id`
    if (!r.length) return fout("Persoon niet gevonden.", 404)
    await sql()`SELECT log_actie('gebruiker_actief', 'gebruiker', ${gid}::uuid, ${JSON.stringify({ actief: b.actief === true })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Producten ----------
  "GET producten": async () => {
    const rijen = await sql()`
      SELECT p.id, p.code, p.naam, p.type, p.alle_modules, p.prijs_excl_btw, p.periode, p.geldigheid_maanden, p.actief, p.beschrijving,
             (SELECT count(*)::int FROM product_modules pm WHERE pm.product_id = p.id) AS modules,
             (SELECT count(*)::int FROM v_geldige_rechten tr WHERE tr.product_id = p.id AND tr.geldig) AS actieve_rechten
      FROM producten p ORDER BY CASE p.type WHEN 'abonnement' THEN 1 WHEN 'traject' THEN 2 ELSE 3 END, p.code`
    return json({ producten: rijen })
  },

  "POST producten/wijzig": async ({ b, id: pid }) => {
    let prijs: number | null = null
    if (b.prijs_excl_btw !== null && b.prijs_excl_btw !== "" && b.prijs_excl_btw !== undefined) {
      prijs = Number(String(b.prijs_excl_btw).replace(",", "."))
      if (!Number.isFinite(prijs) || prijs < 0 || prijs > 100000) return fout("Ongeldige prijs.")
      prijs = Math.round(prijs * 100) / 100
    }
    const geldigheid = b.geldigheid_maanden === "" || b.geldigheid_maanden == null ? null : geheel(b.geldigheid_maanden, 1, 120)
    if (b.geldigheid_maanden && !geldigheid) return fout("Geldigheid moet tussen 1 en 120 maanden liggen.")
    const naam = tekst(b.naam, 160)
    if (!naam) return fout("Naam is verplicht.")
    const r = await sql()`
      UPDATE producten SET naam = ${naam}, prijs_excl_btw = ${prijs}, geldigheid_maanden = ${geldigheid},
             actief = ${b.actief === true}, beschrijving = ${tekst(b.beschrijving, 500)}
      WHERE id = ${pid} RETURNING id`
    if (!r.length) return fout("Product niet gevonden.", 404)
    await sql()`SELECT log_actie('product_gewijzigd', 'product', ${pid}::uuid, ${JSON.stringify({ prijs, geldigheid, actief: b.actief === true })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Logboek ----------
  "GET logboek": async () => {
    const rijen = await sql()`SELECT id, actie, entiteit, entiteit_id, details, tijdstip FROM auditlog ORDER BY tijdstip DESC LIMIT 200`
    return json({ logboek: rijen })
  },
}

export default async (req: Request, context: Context) => {
  const sessie = leesSessie(context.cookies.get(COOKIE))
  if (!sessie || sessie.rol !== "beheerder") return fout("Niet aangemeld.", 401)
  if (req.method !== "GET" && req.headers.get("x-academie") !== "1") return fout("Ongeldige aanvraag.", 403)

  const url = new URL(req.url)
  // /api/beheer/<bron>[/<id>][/<actie>]
  const delen = url.pathname.replace(/^\/api\/beheer\/?/, "").split("/").filter(Boolean)
  let sleutel: string
  let rid: string | undefined
  if (delen.length >= 2 && UUID.test(delen[1])) {
    rid = delen[1]
    sleutel = `${req.method} ${delen[0]}${delen[2] ? "/" + delen[2] : ""}`
    if (!delen[2] && req.method === "GET") sleutel = `GET ${delen[0]}/detail`
  } else {
    sleutel = `${req.method} ${delen.join("/")}`
  }

  const h = routes[sleutel]
  if (!h) return fout("Niet gevonden.", 404)

  let b: any = {}
  if (req.method === "POST") {
    try {
      b = await req.json()
    } catch {
      b = {}
    }
  }
  try {
    return await h({ b, q: url.searchParams, id: rid })
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: "/api/beheer/*",
}
