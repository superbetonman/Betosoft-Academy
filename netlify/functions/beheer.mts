import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, geheel, btwVeld, UUID, EMAIL, DATUM } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, isBeheer, type Gebruiker } from "../lib/sessie.mts"
import { maakUitnodiging } from "../lib/uitnodiging.mts"
import { hashWachtwoord, wachtwoordFout } from "../lib/wachtwoord.mts"
import { laadDeelnemers, laadCursussen, laadStructuren, leerlijn, stand, reikAttestUit, volleNaam } from "../lib/leerlijn.mts"

type Handler = (p: { b: any; q: URLSearchParams; id?: string; ik: Gebruiker; req: Request }) => Promise<Response>

/** Enkel de superadmin mag prijzen, instellingen en beheerders wijzigen. */
const SUPERADMIN = new Set(["POST producten/wijzig", "POST instellingen", "POST beheerders", "POST beheerders/actief"])

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
        (SELECT count(*)::int FROM gebruikers WHERE rol IN ('cursist','centrale_verantwoordelijke')) AS cursisten,
        (SELECT count(*)::int FROM organisaties) AS centrales`
    const aflopend = await sql()`
      SELECT a.id, a.klant, a.email, a.product_naam, a.eind_datum::text, a.dagen_resterend, a.modules_niet_af, a.verlenging_aangevraagd,
             s.gebruikt AS verlengingen, s.maximum AS verlengingen_max, s.aanvragen_tot::text, s.prijs_excl_btw AS verlenging_prijs
      FROM v_aflopend a JOIN v_verlenging_stand s ON s.toegangsrecht_id = a.id ORDER BY a.eind_datum`
    return json({ cijfers, aflopend })
  },

  // ---------- Aanvragen ----------
  "GET aanvragen": async ({ q }) => {
    const st = q.get("status")
    const status = ["nieuw", "gefactureerd", "geactiveerd", "geweigerd"].includes(st ?? "") ? st : null
    const rijen = await sql()`
      SELECT a.id, a.type, a.status, a.voornaam, a.achternaam, a.email, a.telefoon, a.organisatie_naam, a.btw_nummer,
             a.adres, a.aantal_plaatsen, a.opmerking, a.factuurnummer, a.ingediend_op, a.verwerkt_op, a.bedrag_excl_btw, a.toegangsrecht_id, a.organisatie_id,
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

  "POST aanvragen/activeer": async ({ b, id: aid, req, ik }) => {
    const f = tekst(b.factuurnummer, 60)
    const start = datum(b.start_datum)
    const [r] = await sql()`SELECT activeer_aanvraag(${aid}::uuid, ${f}, COALESCE(${start}::date, current_date)) AS recht`
    // Uitnodiging voor wie nog geen wachtwoord heeft (cursist of beheerder van de centrale)
    const [g] = await sql()`
      SELECT g.id, coalesce(g.voornaam, g.email::text) AS wie FROM aanvragen a JOIN gebruikers g ON g.id = a.gebruiker_id
      WHERE a.id = ${aid} AND a.type::text <> 'verlenging' AND g.wachtwoord_hash IS NULL AND g.actief`
    const uitnodiging = g ? { ...(await maakUitnodiging(req, g.id, ik.id)), wie: g.wie } : null
    return json({ ok: true, recht: r.recht, uitnodiging })
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
             CASE WHEN tr.eind_datum IS NULL THEN NULL ELSE (tr.eind_datum - current_date) END AS dagen_resterend,
             vs.gebruikt AS verlengingen, vs.maximum AS verlengingen_max, vs.aanvragen_tot::text, vs.prijs_excl_btw AS verlenging_prijs
      FROM v_geldige_rechten tr
      JOIN v_verlenging_stand vs ON vs.toegangsrecht_id = tr.id
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
    if (!vp) return fout("Dit is geen toegangsrecht van een onderneming.")
    if (n < vp.gebruikt) return fout(`Er zijn al ${vp.gebruikt} plaatsen toegewezen. Trek eerst plaatsen in.`)
    await sql()`UPDATE toegangsrechten SET aantal_plaatsen = ${n} WHERE id = ${rid}`
    await sql()`SELECT log_actie('plaatsen_gewijzigd', 'toegangsrecht', ${rid}::uuid, ${JSON.stringify({ aantal: n, factuur: tekst(b.factuurnummer, 60) })}::jsonb)`
    return json({ ok: true })
  },

  /** Rechtstreeks een toegangsrecht toekennen (bv. na een telefonische bestelling). Loopt via een aanvraag, zodat dezelfde regels gelden. */
  "POST rechten": async ({ b }) => {
    // Onderneming = aanvraagtype 'centrale' in de databank
    const type = b.type === "centrale" || b.type === "onderneming" ? "centrale" : "individueel"
    const email = tekst(b.email, 254)
    const product = id(b.product_id)
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    if (!product) return fout("Kies een product.")
    const plaatsen = type === "centrale" ? geheel(b.aantal_plaatsen, 1, 500) : 1
    if (!plaatsen) return fout("Vul het aantal plaatsen in.")
    // Een persoon kan op naam van een bedrijf gefactureerd worden; een onderneming heeft altijd een naam.
    const bedrijf = tekst(b.organisatie_naam, 160)
    const { btw, fout: btwFout } = btwVeld(b.btw_nummer)
    if (type === "centrale" && !bedrijf) return fout("Vul de naam van de onderneming in.")
    if (btwFout) return fout(btwFout)
    if (btw && !bedrijf) return fout("Vul ook de naam van het bedrijf in.")
    const aid = crypto.randomUUID()
    const f = tekst(b.factuurnummer, 60)
    const start = datum(b.start_datum)
    const [, [r]] = await sql().transaction([
      sql()`INSERT INTO aanvragen (id, type, voornaam, achternaam, email, telefoon, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, opmerking, factuurnummer)
            VALUES (${aid}, ${type}, ${tekst(b.voornaam, 80)}, ${tekst(b.achternaam, 80)}, ${email}, ${tekst(b.telefoon, 40)},
                    ${bedrijf}, ${btw},
                    ${tekst(b.adres, 300)}, ${product}, ${plaatsen}, ${"Rechtstreeks toegekend door beheerder"}, ${f})`,
      sql()`SELECT activeer_aanvraag(${aid}::uuid, ${f}, COALESCE(${start}::date, current_date)) AS recht`,
    ])
    return json({ ok: true, recht: (r as any).recht })
  },

  // ---------- Centrales ----------
  "GET centrales": async () => {
    const rijen = await sql()`
      SELECT o.id, o.naam, o.btw_nummer, o.contact_naam, o.contact_email, o.telefoon,
             (SELECT count(*)::int FROM gebruikers g JOIN organisaties x ON x.id = g.organisatie_id WHERE x.id = o.id OR x.ouder_id = o.id) AS personen,
             (SELECT count(*)::int FROM organisaties l WHERE l.ouder_id = o.id) AS locaties,
             (SELECT count(*)::int FROM v_geldige_rechten tr WHERE tr.organisatie_id = o.id AND tr.geldig) AS actieve_rechten,
             (SELECT COALESCE(sum(vp.aantal_plaatsen), 0)::int FROM v_plaatsen vp JOIN v_geldige_rechten tr ON tr.id = vp.toegangsrecht_id WHERE vp.organisatie_id = o.id AND tr.geldig) AS plaatsen,
             (SELECT COALESCE(sum(vp.gebruikt), 0)::int FROM v_plaatsen vp JOIN v_geldige_rechten tr ON tr.id = vp.toegangsrecht_id WHERE vp.organisatie_id = o.id AND tr.geldig) AS plaatsen_gebruikt
      FROM organisaties o WHERE o.ouder_id IS NULL ORDER BY o.naam`
    return json({ centrales: rijen })
  },

  "GET centrales/detail": async ({ id: oid }) => {
    const [centrale] = await sql()`SELECT * FROM organisaties WHERE id = ${oid}`
    if (!centrale) return fout("Onderneming niet gevonden.", 404)
    const personen = await sql()`
      SELECT g.id, g.email, g.voornaam, g.achternaam, g.rol, g.actief, g.aangemaakt_op, g.organisatie_id,
             (g.wachtwoord_hash IS NOT NULL) AS account_actief, lo.naam AS locatie,
             COALESCE(json_agg(json_build_object('toewijzing', pt.id, 'recht', pt.toegangsrecht_id, 'product', p.naam))
                      FILTER (WHERE pt.id IS NOT NULL), '[]') AS plaatsen
      FROM gebruikers g
      LEFT JOIN plaats_toewijzingen pt ON pt.gebruiker_id = g.id AND pt.ingetrokken_op IS NULL
      LEFT JOIN toegangsrechten tr ON tr.id = pt.toegangsrecht_id
      LEFT JOIN producten p ON p.id = tr.product_id
      JOIN organisaties lo ON lo.id = g.organisatie_id
      WHERE lo.id = ${oid} OR lo.ouder_id = ${oid}
      GROUP BY g.id, lo.naam ORDER BY g.rol DESC, g.achternaam, g.voornaam`
    const locaties = await sql()`SELECT id, naam, adres FROM organisaties WHERE ouder_id = ${oid} ORDER BY naam`
    const rechten = await sql()`
      SELECT tr.id, p.naam AS product, tr.status, tr.geldig, tr.start_datum::text, tr.eind_datum::text, tr.factuurnummer,
             tr.aantal_plaatsen, COALESCE(vp.gebruikt, 0)::int AS gebruikt
      FROM v_geldige_rechten tr JOIN producten p ON p.id = tr.product_id
      LEFT JOIN v_plaatsen vp ON vp.toegangsrecht_id = tr.id
      WHERE tr.organisatie_id = ${oid} ORDER BY tr.geldig DESC, tr.eind_datum DESC NULLS FIRST`
    return json({ centrale, personen, rechten, locaties })
  },

  "POST centrales/wijzig": async ({ b, id: oid }) => {
    const naam = tekst(b.naam, 160)
    if (!naam) return fout("Naam is verplicht.")
    const { btw, fout: btwFout } = btwVeld(b.btw_nummer)
    if (btwFout) return fout(btwFout)
    const r = await sql()`
      UPDATE organisaties SET naam = ${naam}, btw_nummer = ${btw},
             adres = ${tekst(b.adres, 300)}, contact_naam = ${tekst(b.contact_naam, 160)}, contact_email = ${tekst(b.contact_email, 254)},
             telefoon = ${tekst(b.telefoon, 40)}, opmerking = ${tekst(b.opmerking, 1000)}
      WHERE id = ${oid} RETURNING id`
    if (!r.length) return fout("Onderneming niet gevonden.", 404)
    return json({ ok: true })
  },

  "POST centrales/cursist": async ({ b, id: oid, req, ik }) => {
    const email = tekst(b.email, 254)
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    const voornaam = tekst(b.voornaam, 80)
    if (!voornaam) return fout("Vul minstens de voornaam in.")
    const locatie = id(b.locatie_id)
    let doel = oid
    if (locatie) {
      const [l] = await sql()`SELECT id FROM organisaties WHERE id = ${locatie} AND ouder_id = ${oid}`
      if (!l) return fout("Onbekende locatie.")
      doel = locatie
    }
    const [g] = await sql()`SELECT voeg_cursist_toe(${doel}::uuid, ${email}, ${voornaam}, ${tekst(b.achternaam, 80)}) AS id`
    const recht = id(b.recht_id)
    if (recht) await sql()`SELECT wijs_plaats_toe(${recht}::uuid, ${g.id}::uuid)`
    if (b.verantwoordelijke === true || b.verantwoordelijke === "on")
      await sql()`UPDATE gebruikers SET rol = 'centrale_verantwoordelijke' WHERE id = ${g.id} AND rol = 'cursist'`
    const uitnodiging = await maakUitnodiging(req, g.id, ik.id)
    return json({ ok: true, gebruiker: g.id, uitnodiging })
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
             (g.wachtwoord_hash IS NOT NULL) AS account_actief,
             (SELECT count(DISTINCT module_id)::int FROM v_module_toegang v WHERE v.gebruiker_id = g.id) AS modules_toegang,
             (SELECT count(*)::int FROM attesten a WHERE a.gebruiker_id = g.id AND a.ingetrokken_op IS NULL) AS attesten
      FROM gebruikers g LEFT JOIN organisaties o ON o.id = g.organisatie_id
      WHERE g.rol IN ('cursist','centrale_verantwoordelijke')
        AND (${patroon}::text IS NULL OR g.email ILIKE ${patroon} OR concat_ws(' ', g.voornaam, g.achternaam) ILIKE ${patroon} OR o.naam ILIKE ${patroon})
      ORDER BY g.aangemaakt_op DESC LIMIT 500`
    // lessen en punten uit de cursusapps
    const lijnen = new Map((await leerlijn(await laadDeelnemers({ ids: rijen.map((r: any) => r.id) }))).map((d) => [d.id, d]))
    return json({
      cursisten: rijen.map((r: any) => ({ ...r, lessen_af: lijnen.get(r.id)?.totaal.lessen_af ?? 0, punten: lijnen.get(r.id)?.totaal.punten ?? 0 })),
    })
  },

  "POST cursisten/actief": async ({ b, id: gid }) => {
    const r = await sql()`UPDATE gebruikers SET actief = ${b.actief === true} WHERE id = ${gid} AND rol IN ('cursist','centrale_verantwoordelijke') RETURNING id`
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

  // ---------- Locaties en verantwoordelijken ----------
  "POST centrales/locatie": async ({ b, id: oid }) => {
    const naam = tekst(b.naam, 160)
    if (!naam) return fout("Vul de naam van de locatie in.")
    const [o] = await sql()`SELECT id FROM organisaties WHERE id = ${oid} AND ouder_id IS NULL`
    if (!o) return fout("Locaties horen bij een hoofdbedrijf.")
    const [l] = await sql()`INSERT INTO organisaties (naam, adres, ouder_id) VALUES (${naam}, ${tekst(b.adres, 300)}, ${oid}) RETURNING id`
    await sql()`SELECT log_actie('locatie_toegevoegd', 'organisatie', ${l.id}::uuid, ${JSON.stringify({ naam })}::jsonb)`
    return json({ ok: true, id: l.id })
  },

  "POST cursisten/rol": async ({ b, id: gid }) => {
    const rol = b.rol === "centrale_verantwoordelijke" ? "centrale_verantwoordelijke" : b.rol === "cursist" ? "cursist" : null
    if (!rol) return fout("Ongeldige rol.")
    const r = await sql()`UPDATE gebruikers SET rol = ${rol}::gebruiker_rol WHERE id = ${gid} AND organisatie_id IS NOT NULL AND rol IN ('cursist','centrale_verantwoordelijke') RETURNING id`
    if (!r.length) return fout("Persoon niet gevonden of niet verbonden aan een onderneming.")
    await sql()`SELECT log_actie('rol_gewijzigd', 'gebruiker', ${gid}::uuid, ${JSON.stringify({ rol })}::jsonb)`
    return json({ ok: true })
  },

  "POST cursisten/uitnodiging": async ({ id: gid, req, ik }) => {
    const [g] = await sql()`SELECT id FROM gebruikers WHERE id = ${gid} AND actief AND rol IN ('cursist','centrale_verantwoordelijke')`
    if (!g) return fout("Persoon niet gevonden of niet actief.")
    return json({ ok: true, uitnodiging: await maakUitnodiging(req, gid!, ik.id) })
  },

  // ---------- Verlenging ----------
  "POST rechten/verlenging": async ({ b, id: rid }) => {
    const [r] = await sql()`SELECT vraag_verlenging(${rid}::uuid, ${tekst(b.opmerking, 300)}) AS id`
    return json({ ok: true, aanvraag: r.id })
  },

  // ---------- Versies ----------
  "GET versies": async () => {
    const rijen = await sql()`
      SELECT m.id AS module_id, m.code, m.titel, c.titel AS cursus, m.traject,
             COALESCE(json_agg(json_build_object(
               'id', mv.id, 'label', mv.label, 'status', mv.status, 'gepubliceerd_op', mv.gepubliceerd_op,
               'nota', mv.wijzigingsnota,
               'lessen', (SELECT count(*) FROM lessen l WHERE l.module_versie_id = mv.id),
               'volgers', (SELECT count(*) FROM cursist_moduleversie cm WHERE cm.module_versie_id = mv.id),
               'te_beoordelen', (SELECT count(*) FROM v_versie_verschil d WHERE d.versie_id = mv.id AND d.soort = 'te_beoordelen'),
               'proefgroep', (SELECT count(*) FROM versie_proefgroep pg WHERE pg.module_versie_id = mv.id)
             ) ORDER BY mv.aangemaakt_op DESC) FILTER (WHERE mv.id IS NOT NULL), '[]') AS versies,
             (SELECT count(*)::int FROM module_versies a WHERE a.module_id = m.id AND a.status = 'archief') AS gearchiveerd
      FROM modules m JOIN cursussen c ON c.id = m.cursus_id
      LEFT JOIN module_versies mv ON mv.module_id = m.id AND mv.status <> 'archief'
      GROUP BY m.id, c.titel, c.volgorde ORDER BY c.volgorde, m.volgorde`
    return json({ modules: rijen })
  },

  "GET versies/detail": async ({ id: vid }) => {
    const [versie] = await sql()`
      SELECT mv.id, mv.label, mv.status, mv.wijzigingsnota, mv.gepubliceerd_op, mv.module_id,
             m.code, m.titel AS module, vo.label AS vorige_label
      FROM module_versies mv JOIN modules m ON m.id = mv.module_id LEFT JOIN module_versies vo ON vo.id = mv.vorige_versie_id
      WHERE mv.id = ${vid}`
    if (!versie) return fout("Versie niet gevonden.", 404)
    const verschil = await sql()`
      SELECT onderdeel, sleutel, titel, toets, nieuw_id, soort, nota FROM v_versie_verschil
      WHERE versie_id = ${vid} AND soort <> 'ongewijzigd'
      ORDER BY CASE soort WHEN 'te_beoordelen' THEN 0 WHEN 'nieuw' THEN 1 WHEN 'inhoudelijk' THEN 2 WHEN 'weggevallen' THEN 3 WHEN 'redactioneel' THEN 4 ELSE 5 END,
               onderdeel, volgorde_nieuw NULLS LAST`
    const [{ ongewijzigd }] = await sql()`SELECT count(*)::int AS ongewijzigd FROM v_versie_verschil WHERE versie_id = ${vid} AND soort = 'ongewijzigd'`
    const proefgroep = await sql()`
      SELECT pg.id, coalesce(o.naam, nullif(concat_ws(' ', g.voornaam, g.achternaam), ''), g.email::text) AS naam,
             CASE WHEN pg.organisatie_id IS NOT NULL THEN 'onderneming' ELSE 'persoon' END AS soort
      FROM versie_proefgroep pg LEFT JOIN organisaties o ON o.id = pg.organisatie_id LEFT JOIN gebruikers g ON g.id = pg.gebruiker_id
      WHERE pg.module_versie_id = ${vid} ORDER BY naam`
    const [actueel] = await sql()`SELECT * FROM versie_impact(${vid}::uuid, 'actueel')`
    const [proef] = await sql()`SELECT * FROM versie_impact(${vid}::uuid, 'proef')`
    return json({ versie, verschil, ongewijzigd, proefgroep, impact: { actueel, proef } })
  },

  "POST versies": async ({ b }) => {
    const mid = id(b.module_id)
    const label = tekst(b.label, 30)
    if (!mid || !label) return fout("Kies een module en geef de versie een naam, bv. 2027.1.")
    const [r] = await sql()`SELECT nieuwe_versie(${mid}::uuid, ${label}, ${tekst(b.nota, 1000)}) AS id`
    return json({ ok: true, id: r.id })
  },

  "POST versies/beoordeel": async ({ b }) => {
    const soort = b.soort === "inhoudelijk" || b.soort === "redactioneel" ? b.soort : null
    const oid = id(b.onderdeel_id)
    if (!soort || !oid || !["les", "vraag"].includes(b.onderdeel)) return fout("Kies inhoudelijk of redactioneel.")
    await sql()`SELECT beoordeel_wijziging(${b.onderdeel}, ${oid}::uuid, ${soort}::wijziging_soort, ${tekst(b.nota, 500)})`
    return json({ ok: true })
  },

  "POST versies/publiceer": async ({ b, id: vid }) => {
    const status = b.status === "proef" ? "proef" : b.status === "actueel" ? "actueel" : null
    if (!status) return fout("Kies proef of actueel.")
    const [r] = await sql()`SELECT publiceer_versie(${vid}::uuid, ${status}::versie_status) AS n`
    return json({ ok: true, overgezet: r.n })
  },

  "POST versies/nota": async ({ b, id: vid }) => {
    await sql()`UPDATE module_versies SET wijzigingsnota = ${tekst(b.nota, 1000)} WHERE id = ${vid}`
    return json({ ok: true })
  },

  "POST versies/proefgroep": async ({ b, id: vid }) => {
    const gebruiker = id(b.gebruiker_id)
    const organisatie = id(b.organisatie_id)
    if (!gebruiker === !organisatie) return fout("Kies een persoon of een onderneming.")
    await sql()`INSERT INTO versie_proefgroep (module_versie_id, gebruiker_id, organisatie_id) VALUES (${vid}, ${gebruiker}, ${organisatie}) ON CONFLICT DO NOTHING`
    return json({ ok: true })
  },

  "POST proefgroep/verwijder": async ({ id: pid }) => {
    await sql()`DELETE FROM versie_proefgroep WHERE id = ${pid}`
    return json({ ok: true })
  },

  "GET keuzelijsten": async () => {
    const centrales = await sql()`SELECT id, naam FROM organisaties WHERE ouder_id IS NULL ORDER BY naam`
    const personen = await sql()`
      SELECT id, coalesce(nullif(concat_ws(' ', voornaam, achternaam), ''), email::text) AS naam, email::text AS email
      FROM gebruikers WHERE rol IN ('cursist','centrale_verantwoordelijke') ORDER BY naam LIMIT 2000`
    return json({ centrales, personen })
  },

  // ---------- Instellingen ----------
  "GET instellingen": async () => {
    const rijen = await sql()`SELECT sleutel, waarde, omschrijving, gewijzigd_op FROM instellingen ORDER BY sleutel`
    return json({ instellingen: rijen })
  },

  "POST instellingen": async ({ b }) => {
    const grenzen: Record<string, [number, number]> = {
      verlenging_maanden: [1, 12],
      verlenging_prijs_pct: [0, 100],
      verlenging_max: [0, 12],
      verlenging_venster_maanden: [1, 24],
      btw_pct: [0, 30],
    }
    const wijzigingen: [string, number][] = []
    for (const [k, [min, max]] of Object.entries(grenzen)) {
      if (b[k] === undefined || b[k] === "") continue
      const n = Number(String(b[k]).replace(",", "."))
      if (!Number.isFinite(n) || n < min || n > max) return fout(`Ongeldige waarde voor ${k.replaceAll("_", " ")} (${min} tot ${max}).`)
      wijzigingen.push([k, n])
    }
    for (const [k, n] of wijzigingen)
      await sql()`UPDATE instellingen SET waarde = ${JSON.stringify(n)}::jsonb, gewijzigd_op = now() WHERE sleutel = ${k}`
    await sql()`SELECT log_actie('instellingen_gewijzigd', 'instellingen', NULL, ${JSON.stringify(Object.fromEntries(wijzigingen))}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Beheerders ----------
  "GET beheerders": async () => {
    const rijen = await sql()`
      SELECT id, gebruikersnaam::text, email::text, voornaam, achternaam, rol::text, actief, laatst_aangemeld_op
      FROM gebruikers WHERE rol IN ('beheerder','superadmin') ORDER BY rol DESC, gebruikersnaam`
    return json({ beheerders: rijen })
  },

  "POST beheerders": async ({ b }) => {
    const gebruikersnaam = tekst(b.gebruikersnaam, 40)
    const email = tekst(b.email, 254)
    const rol = b.rol === "superadmin" ? "superadmin" : "beheerder"
    if (!gebruikersnaam || !/^[a-z0-9._-]{3,40}$/i.test(gebruikersnaam))
      return fout("Gebruikersnaam: 3 tot 40 letters, cijfers, punt, streep of liggend streepje.")
    if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
    const f = wachtwoordFout(b.wachtwoord)
    if (f) return fout(f)
    const [g] = await sql()`
      INSERT INTO gebruikers (email, gebruikersnaam, voornaam, achternaam, rol, wachtwoord_hash)
      VALUES (${email}, ${gebruikersnaam}, ${tekst(b.voornaam, 80)}, ${tekst(b.achternaam, 80)}, ${rol}::gebruiker_rol, ${await hashWachtwoord(b.wachtwoord)})
      RETURNING id`
    await sql()`SELECT log_actie('beheerder_toegevoegd', 'gebruiker', ${g.id}::uuid, ${JSON.stringify({ gebruikersnaam, rol })}::jsonb)`
    return json({ ok: true })
  },

  "POST beheerders/actief": async ({ b, id: gid, ik }) => {
    if (gid === ik.id) return fout("Je kunt je eigen account niet uitschakelen.")
    const r = await sql()`UPDATE gebruikers SET actief = ${b.actief === true} WHERE id = ${gid} AND rol IN ('beheerder','superadmin') RETURNING id`
    if (!r.length) return fout("Beheerder niet gevonden.", 404)
    await sql()`SELECT log_actie('beheerder_actief', 'gebruiker', ${gid}::uuid, ${JSON.stringify({ actief: b.actief === true })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Cursussen: online, structuur, cijfers ----------
  "GET cursussen": async () => {
    const [cursussen, structuren] = await Promise.all([laadCursussen(), laadStructuren()])
    const cijfers = await sql()`
      SELECT c.code,
             (SELECT count(*)::int FROM modules m WHERE m.cursus_id = c.id) AS modules,
             (SELECT count(*)::int FROM modules m WHERE m.cursus_id = c.id AND m.gepubliceerd) AS modules_klaar,
             (SELECT string_agg(b.pad, ', ' ORDER BY b.pad) FROM cursus_bestanden b WHERE b.cursus = c.code AND b.pad LIKE '%.html') AS bestanden,
             (SELECT max(b.bijgewerkt_op) FROM cursus_bestanden b WHERE b.cursus = c.code) AS bestanden_op,
             (SELECT json_agg(json_build_object('code', p.code, 'prijs', p.prijs_excl_btw, 'actief', p.actief) ORDER BY p.code)
                FROM producten p WHERE p.id IN (SELECT pm.product_id FROM product_modules pm JOIN modules m ON m.id = pm.module_id WHERE m.cursus_id = c.id)) AS producten,
             (SELECT count(DISTINCT mt.gebruiker_id)::int FROM v_module_toegang mt JOIN modules m ON m.id = mt.module_id WHERE m.cursus_id = c.id) AS met_toegang,
             (SELECT count(*)::int FROM cursus_gegevens cg WHERE cg.cursus = c.code AND cg.pad LIKE 'data/users/%/progress') AS gestart,
             (SELECT count(*)::int FROM attesten a WHERE a.cursus_id = c.id AND a.ingetrokken_op IS NULL) AS attesten
      FROM cursussen c`
    const per = new Map(cijfers.map((r: any) => [r.code, r]))
    return json({
      cursussen: cursussen.map((c) => {
        const s = structuren.get(c.code)
        const x: any = per.get(c.code) ?? {}
        return {
          ...c, ...x,
          structuur: s ? { bevestigd: s.bevestigd, bijgewerkt_op: s.bijgewerkt_op, lessen: s.structuur.modules.filter((m) => m.avail).reduce((t, m) => t + m.lessen.length, 0),
            toetsen: s.structuur.modules.filter((m) => m.avail).reduce((t, m) => t + m.lessen.filter((l) => l.soort === "toets").length, 0),
            modules: s.structuur.modules.filter((m) => m.avail && m.lessen.length).length, verouderd: !!(x.bestanden_op && s.bijgewerkt_op && new Date(x.bestanden_op) > new Date(s.bijgewerkt_op)) } : null,
        }
      }),
    })
  },

  "POST cursussen/online": async ({ b, id: cid, ik }) => {
    const online = b.online === true
    const r = await sql()`UPDATE cursussen SET gepubliceerd = ${online} WHERE id = ${cid} RETURNING code`
    if (!r.length) return fout("Cursus niet gevonden.", 404)
    await sql()`SELECT log_actie(${online ? "cursus_online" : "cursus_offline"}, 'cursus', ${cid}::uuid, ${JSON.stringify({ cursus: r[0].code, door: ik.id })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Leerlijn van alle deelnemers ----------
  "GET leerlijn": async ({ q }) => {
    const org = id(q.get("organisatie"))
    const orgs = org ? (await sql()`SELECT id FROM organisaties WHERE id = ${org} OR ouder_id = ${org}`).map((r: any) => r.id) : undefined
    const zoek = (tekst(q.get("zoek"), 80) || "").toLowerCase()
    let deelnemers = await laadDeelnemers({ orgs })
    if (zoek) deelnemers = deelnemers.filter((d) => `${volleNaam(d)} ${d.email} ${d.bedrijf ?? ""} ${d.locatie ?? ""}`.toLowerCase().includes(zoek))
    const lijnen = await leerlijn(deelnemers.slice(0, 400))
    const bedrijven = await sql()`SELECT id, naam FROM organisaties WHERE ouder_id IS NULL ORDER BY naam`
    return json({
      bedrijven,
      meer: deelnemers.length > 400,
      deelnemers: lijnen.map((d) => ({
        id: d.id, naam: volleNaam(d), email: d.email, bedrijf: d.bedrijf, locatie: d.locatie, actief: d.actief,
        totaal: { punten: d.totaal.punten, niveau: d.totaal.niveau, lessen_af: d.totaal.lessen_af, modules_af: d.totaal.modules_af, cursussen_af: d.totaal.cursussen_af, gem_score: d.totaal.gem_score, laatst: d.totaal.laatst, badges: d.totaal.badges },
        cursussen: d.cursussen.map(({ dagen, ...c }) => c),
        attesten: d.attesten,
      })),
    })
  },

  // ---------- Attesten ----------
  "POST attesten": async ({ b, ik }) => {
    // handmatig uitreiken (bv. na een examen buiten de academie, of opnieuw na intrekken)
    const gid = id(b.gebruiker_id)
    const code = tekst(b.cursus, 20)
    if (!gid || !code) return fout("Kies een deelnemer en een cursus.")
    const [d] = await laadDeelnemers({ ids: [gid] })
    const c = (await laadCursussen()).find((x) => x.code === code)
    if (!d || !c) return fout("Deelnemer of cursus niet gevonden.", 404)
    const [v] = await sql()`SELECT data FROM cursus_gegevens WHERE gebruiker_id = ${gid} AND cursus = ${code} AND pad = ${"data/users/" + gid + "/progress"}`
    const s = stand(c.code, c.titel, (await laadStructuren()).get(code) ?? null, v?.data ?? null)
    const a = await reikAttestUit(d, c, s, ik.id)
    if (!a) return fout("Deze deelnemer heeft al een geldig attest voor deze cursus.")
    return json({ ok: true, attest: a })
  },

  "POST attesten/intrek": async ({ b, id: aid, ik }) => {
    const r = await sql()`UPDATE attesten SET ingetrokken_op = now() WHERE id = ${aid} AND ingetrokken_op IS NULL RETURNING id, nummer`
    if (!r.length) return fout("Attest niet gevonden of al ingetrokken.", 404)
    await sql()`SELECT log_actie('attest_ingetrokken', 'attest', ${aid}::uuid, ${JSON.stringify({ nummer: r[0].nummer, reden: tekst(b.reden, 300), door: ik.id })}::jsonb)`
    return json({ ok: true })
  },

  // ---------- Logboek ----------
  "GET logboek": async () => {
    const rijen = await sql()`SELECT id, actie, entiteit, entiteit_id, details, tijdstip FROM auditlog ORDER BY tijdstip DESC LIMIT 200`
    return json({ logboek: rijen })
  },
}

export default async (req: Request, context: Context) => {
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  let ik: Gebruiker | null
  try {
    ik = await aangemeld(context)
  } catch (err) {
    return dbFout(err)
  }
  if (!ik) return fout("Niet aangemeld.", 401)
  if (!isBeheer(ik)) return fout("Geen toegang.", 403)

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
  if (SUPERADMIN.has(sleutel) && ik.rol !== "superadmin") return fout("Enkel de superadmin mag dit wijzigen.", 403)

  let b: any = {}
  if (req.method === "POST") {
    try {
      b = await req.json()
    } catch {
      b = {}
    }
  }
  try {
    return await h({ b, q: url.searchParams, id: rid, ik, req })
  } catch (err) {
    return dbFout(err)
  }
}

export const config: Config = {
  // Databank staat in Frankfurt (Neon, aws-eu-central-1): functies dicht bij de data en in de EU.
  region: "fra",
  path: "/api/beheer/*",
}
