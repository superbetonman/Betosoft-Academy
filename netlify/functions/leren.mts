import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, UUID } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, isBeheer, type Gebruiker } from "../lib/sessie.mts"
import { CURSUSCODE, magCursus, magGegevens } from "../lib/cursustoegang.mts"
import { laadDeelnemers, leerlijn, valideerStructuur, telLessen, telToetsen, korteNaam, volleNaam, NIVEAUS, PUNTEN, BADGES } from "../lib/leerlijn.mts"

/**
 * Leeromgeving:
 *   GET    /api/leren/leerlijn                  mijn leerlijn: cursussen, voortgang per module, punten, badges, attesten
 *   GET    /api/leren/scores[?bedrijf=<id>]      klassement algemeen, per bedrijf en binnen het eigen bedrijf
 *   GET    /api/leren/cursussen                 cursussen voor de aangemelde gebruiker (beheerders: alle, als tester)
 *   PUT    /api/leren/structuur/<CODE>          lessenlijst van de cursusapp (door cursus-academie.js)
 *   GET    /api/leren/gegevens/<CODE>?pad=…      één document van de cursusapp (bv. de voortgang)
 *   GET    /api/leren/gegevens/<CODE>?map=…      alle documenten direct onder een map
 *   PUT    /api/leren/gegevens/<CODE>            { pad, data } bewaren
 *   DELETE /api/leren/gegevens/<CODE>?pad=…      één document wissen
 */

const MAX_BYTES = 256 * 1024
const PAD = /^[A-Za-z0-9_\-./]{1,200}$/

async function mijnLeerlijn(g: Gebruiker) {
  const [ik] = await laadDeelnemers({ ids: [g.id] })
  const [l] = await leerlijn([ik], { alleCursussen: () => isBeheer(g) })
  return l
}

/** Het bedrijf (hoofdorganisatie) van de gebruiker, en of hij het beheert. */
async function bedrijfVan(g: Gebruiker): Promise<{ id: string | null; beheert: boolean }> {
  if (!g.organisatie_id) return { id: null, beheert: false }
  const [r] = await db()`SELECT hoofdorganisatie(${g.organisatie_id}::uuid) AS id`
  return { id: r?.id ?? null, beheert: g.rol === "centrale_verantwoordelijke" }
}

export default async (req: Request, context: Context) => {
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  const url = new URL(req.url)
  const delen = url.pathname.replace(/^\/api\/leren\/?/, "").split("/").filter(Boolean)
  const sql = db()

  try {
    const g = await aangemeld(context)
    if (!g) return fout("Niet aangemeld.", 401)
    const beheer = isBeheer(g)

    // ---------- Mijn leerlijn ----------
    if (delen[0] === "leerlijn" && req.method === "GET") {
      const l = await mijnLeerlijn(g)
      return json({
        ik: { id: g.id, naam: volleNaam(g), voornaam: g.voornaam, rol: g.rol, bedrijf: l.bedrijf, locatie: l.locatie },
        beheer,
        cursussen: l.cursussen.filter((c) => beheer || c.toegang || c.deels || c.af > 0),
        totaal: l.totaal,
        attesten: l.attesten,
        regels: { punten: PUNTEN, niveaus: NIVEAUS },
      })
    }

    // ---------- Scores ----------
    if (delen[0] === "scores" && req.method === "GET") {
      const deelnemers = await laadDeelnemers({ enkelActief: true })
      const lijnen = await leerlijn(deelnemers)
      const mijn = await bedrijfVan(g)
      const rijen = lijnen
        .map((d) => ({
          id: d.id, naam: korteNaam(d), volle_naam: volleNaam(d), bedrijf_id: d.bedrijf_id, bedrijf: d.bedrijf, locatie: d.locatie,
          punten: d.totaal.punten, niveau: d.totaal.niveau.naam, badges: d.totaal.aantal_badges, lessen_af: d.totaal.lessen_af,
          cursussen_af: d.totaal.cursussen_af, attesten: d.attesten.filter((a) => !a.ingetrokken_op).length,
          toegang: d.cursussen.some((c) => c.toegang || c.deels),
        }))
        .sort((a, b) => b.punten - a.punten || b.cursussen_af - a.cursussen_af || b.lessen_af - a.lessen_af)
      const actief = rijen.filter((r) => r.punten > 0)
      const rang = (lijst: typeof rijen, id: string) => {
        const i = lijst.findIndex((r) => r.id === id)
        return i < 0 ? null : i + 1
      }
      // bedrijven: deelnemers = medewerkers met een opleiding of met punten
      const perBedrijf = new Map<string, { id: string; bedrijf: string; deelnemers: number; actief: number; punten: number; cursussen_af: number; attesten: number }>()
      for (const r of rijen) {
        if (!r.bedrijf_id || !(r.toegang || r.punten > 0)) continue
        const b = perBedrijf.get(r.bedrijf_id) ?? { id: r.bedrijf_id, bedrijf: r.bedrijf || "", deelnemers: 0, actief: 0, punten: 0, cursussen_af: 0, attesten: 0 }
        b.deelnemers++
        if (r.punten > 0) b.actief++
        b.punten += r.punten
        b.cursussen_af += r.cursussen_af
        b.attesten += r.attesten
        perBedrijf.set(r.bedrijf_id, b)
      }
      const bedrijven = [...perBedrijf.values()]
        .filter((b) => b.punten > 0)
        .map((b) => ({ ...b, gemiddeld: Math.round(b.punten / b.deelnemers) }))
        .sort((a, b) => b.gemiddeld - a.gemiddeld || b.punten - a.punten)
        .map((b, i) => ({ ...b, rang: i + 1, ik: b.id === mijn.id }))
      // eigen bedrijf (beheerders kunnen er een kiezen)
      const gekozen = beheer ? (UUID.test(url.searchParams.get("bedrijf") || "") ? url.searchParams.get("bedrijf") : null) : mijn.id
      const volleNamen = beheer || mijn.beheert
      const bedrijfRijen = gekozen ? rijen.filter((r) => r.bedrijf_id === gekozen && (r.toegang || r.punten > 0)) : []
      const ikRij = rijen.find((r) => r.id === g.id)
      const zicht = (r: (typeof rijen)[number], i: number, eigen: boolean) => ({
        rang: i + 1, naam: eigen && volleNamen ? r.volle_naam : r.naam, bedrijf: r.bedrijf, locatie: eigen ? r.locatie : null,
        punten: r.punten, niveau: r.niveau, badges: r.badges, lessen_af: r.lessen_af, cursussen_af: r.cursussen_af, ik: r.id === g.id,
      })
      const mijnLijn = beheer ? null : (lijnen.find((d) => d.id === g.id) ?? (await mijnLeerlijn(g)))
      return json({
        ik: mijnLijn
          ? {
              naam: volleNaam(g), bedrijf: mijnLijn.bedrijf, totaal: mijnLijn.totaal,
              rang_algemeen: ikRij && ikRij.punten > 0 ? rang(actief, g.id) : null, deelnemers_algemeen: actief.length,
              rang_bedrijf: ikRij && ikRij.punten > 0 ? rang(bedrijfRijen.filter((r) => r.punten > 0), g.id) : null,
            }
          : null,
        beheer,
        algemeen: actief.slice(0, 100).map((r, i) => zicht(r, i, r.bedrijf_id !== null && r.bedrijf_id === gekozen)),
        bedrijven,
        bedrijf: gekozen
          ? { id: gekozen, naam: bedrijven.find((b) => b.id === gekozen)?.bedrijf ?? bedrijfRijen[0]?.bedrijf ?? lijnen.find((d) => d.bedrijf_id === gekozen)?.bedrijf ?? "", deelnemers: bedrijfRijen.map((r, i) => zicht(r, i, true)) }
          : null,
        keuze: beheer ? [...perBedrijf.values()].map((b) => ({ id: b.id, naam: b.bedrijf })).sort((a, b) => a.naam.localeCompare(b.naam)) : [],
        regels: { punten: PUNTEN, niveaus: NIVEAUS, badges: BADGES.map((b) => ({ code: b.code, naam: b.naam, uitleg: b.uitleg })) },
      })
    }

    // ---------- Lessenlijst van een cursusapp ----------
    if (delen[0] === "structuur" && delen[1] && req.method === "PUT") {
      const code = delen[1].toUpperCase()
      if (!CURSUSCODE.test(code)) return fout("Onbekende cursus.", 404)
      if (!(await magCursus(g, code))) return fout("Geen toegang tot deze cursus.", 403)
      const tekst = await req.text()
      if (tekst.length > MAX_BYTES) return fout("Te groot.", 413)
      let s
      try {
        s = valideerStructuur(JSON.parse(tekst))
      } catch {
        s = null
      }
      if (!s) return fout("Ongeldige structuur.")
      const lessen = telLessen(s)
      const toetsen = telToetsen(s)
      const [oud] = await sql`SELECT structuur, bevestigd FROM cursus_structuur WHERE cursus = ${code}`
      const zelfde = oud && JSON.stringify(oud.structuur) === JSON.stringify(s)
      if (beheer) {
        // een beheerder bevestigt de structuur door de cursus te openen
        if (zelfde && oud.bevestigd) return json({ ok: true, gewijzigd: false })
        await sql`
          INSERT INTO cursus_structuur (cursus, structuur, lessen, toetsen, bevestigd, door, bijgewerkt_op)
          VALUES (${code}, ${JSON.stringify(s)}::jsonb, ${lessen}, ${toetsen}, true, ${g.id}, now())
          ON CONFLICT (cursus) DO UPDATE SET structuur = EXCLUDED.structuur, lessen = EXCLUDED.lessen, toetsen = EXCLUDED.toetsen,
            bevestigd = true, door = EXCLUDED.door, bijgewerkt_op = now()`
        if (!zelfde) await sql`SELECT log_actie('structuur_bijgewerkt', 'cursus', (SELECT id FROM cursussen WHERE code = ${code}), ${JSON.stringify({ cursus: code, lessen, toetsen, door: g.id })}::jsonb)`
        return json({ ok: true, gewijzigd: !zelfde })
      }
      // een cursist levert enkel een eerste, voorlopige versie aan (tot een beheerder de cursus opent)
      if (oud) return json({ ok: true, gewijzigd: false })
      await sql`
        INSERT INTO cursus_structuur (cursus, structuur, lessen, toetsen, bevestigd, door)
        VALUES (${code}, ${JSON.stringify(s)}::jsonb, ${lessen}, ${toetsen}, false, ${g.id})
        ON CONFLICT (cursus) DO NOTHING`
      return json({ ok: true, gewijzigd: true })
    }

    // ---------- Cursussen (kort) ----------
    if (delen[0] === "cursussen" && req.method === "GET") {
      const l = await mijnLeerlijn(g)
      const cursussen = l.cursussen
        .filter((c) => c.toegang || c.deels)
        .map((c) => ({
          code: c.code, titel: c.titel, toegang: c.toegang, als_tester: beheer, deels: c.deels, eind_datum: c.eind,
          lessen_af: c.af, lessen: c.lessen, pct: c.pct, laatst: c.laatst,
        }))
      return json({ cursussen, beheer })
    }

    // ---------- Gegevens van een cursusapp ----------
    // BMC en BPB bewaren hun voortgang bij de bron BMC-BPB (gedeelde basis): magGegevens laat dat toe.
    if (delen[0] === "gegevens" && delen[1]) {
      const code = delen[1].toUpperCase()
      if (!CURSUSCODE.test(code)) return fout("Onbekende cursus.", 404)
      if (!(await magGegevens(g, code))) return fout("Geen toegang tot deze cursus.", 403)

      if (req.method === "GET") {
        const map = url.searchParams.get("map")
        if (map !== null) {
          if (!PAD.test(map)) return fout("Ongeldig pad.")
          const rijen = await sql`
            SELECT pad, data FROM cursus_gegevens
            WHERE gebruiker_id = ${g.id} AND cursus = ${code} AND pad LIKE ${map.replace(/[%_]/g, "\\$&") + "/%"}
              AND position('/' in substr(pad, ${map.length + 2})) = 0
            ORDER BY pad`
          return json({ docs: rijen.map((r: any) => ({ id: r.pad.split("/").pop(), data: r.data })) })
        }
        const pad = url.searchParams.get("pad") ?? ""
        if (!PAD.test(pad)) return fout("Ongeldig pad.")
        const [r] = await sql`SELECT data FROM cursus_gegevens WHERE gebruiker_id = ${g.id} AND cursus = ${code} AND pad = ${pad}`
        return json(r ? { bestaat: true, data: r.data } : { bestaat: false, data: null })
      }

      if (req.method === "PUT") {
        const tekst = await req.text()
        if (tekst.length > MAX_BYTES) return fout("Te groot.", 413)
        let b: any
        try {
          b = JSON.parse(tekst)
        } catch {
          return fout("Ongeldige gegevens.")
        }
        const pad = typeof b?.pad === "string" ? b.pad : ""
        if (!PAD.test(pad)) return fout("Ongeldig pad.")
        if (b.data === undefined) return fout("Geen gegevens.")
        await sql`
          INSERT INTO cursus_gegevens (gebruiker_id, cursus, pad, data, bijgewerkt_op)
          VALUES (${g.id}, ${code}, ${pad}, ${JSON.stringify(b.data)}::jsonb, now())
          ON CONFLICT (gebruiker_id, cursus, pad) DO UPDATE SET data = EXCLUDED.data, bijgewerkt_op = now()`
        return json({ ok: true })
      }

      if (req.method === "DELETE") {
        const pad = url.searchParams.get("pad") ?? ""
        if (!PAD.test(pad)) return fout("Ongeldig pad.")
        await sql`DELETE FROM cursus_gegevens WHERE gebruiker_id = ${g.id} AND cursus = ${code} AND pad = ${pad}`
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
  path: "/api/leren/*",
}
