import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, geheel, btwVeld, EMAIL, UUID } from "../lib/db.mts"

export default async (req: Request, context: Context) => {
  const pad = new URL(req.url).pathname
  const sql = db()

  try {
    if (pad === "/api/producten" && req.method === "GET") {
      // cursus: de code van de cursus als alle modules van het product tot één cursus behoren (abonnementen: leeg)
      const producten = await sql`
        SELECT p.id, p.code, p.naam, p.type, p.periode, p.geldigheid_maanden, p.prijs_excl_btw, p.beschrijving, p.alle_modules,
               x.cursus, x.cursus_titel, COALESCE(x.modules, 0)::int AS modules
        FROM producten p
        LEFT JOIN LATERAL (
          SELECT CASE WHEN count(DISTINCT c.id) = 1 THEN min(c.code) END AS cursus,
                 CASE WHEN count(DISTINCT c.id) = 1 THEN min(c.titel) END AS cursus_titel,
                 count(*) AS modules
          FROM product_modules pm JOIN modules m ON m.id = pm.module_id JOIN cursussen c ON c.id = m.cursus_id
          WHERE pm.product_id = p.id
        ) x ON true
        WHERE p.actief AND product_te_koop(p.id)
        ORDER BY CASE p.type WHEN 'abonnement' THEN 1 WHEN 'traject' THEN 2 ELSE 3 END, p.code`
      // Cursussen die publiek verschijnen (Beheer → Cursussen): 'voorbereiding' of 'inschrijven'. 'niet_tonen' blijft weg.
      const cursussen = await sql`SELECT code, startpagina FROM cursussen WHERE startpagina <> 'niet_tonen' ORDER BY volgorde, code`
      // Publieke regels voor de startpagina (verlenging en btw); enkel getallen uit de tabel instellingen.
      const rijen = await sql`
        SELECT sleutel, waarde #>> '{}' AS waarde FROM instellingen
        WHERE sleutel IN ('verlenging_maanden', 'verlenging_prijs_pct', 'verlenging_max', 'verlenging_venster_maanden', 'btw_pct')`
      const regels: Record<string, number> = {}
      for (const r of rijen) {
        const n = Number(r.waarde)
        if (Number.isFinite(n)) regels[r.sleutel] = n
      }
      return json({ producten, regels, cursussen })
    }

    if (pad === "/api/aanvraag" && req.method === "POST") {
      let b: any
      try {
        b = await req.json()
      } catch {
        return fout("Ongeldige aanvraag.")
      }
      // Valkuil voor robots: echte bezoekers zien dit veld niet.
      if (tekst(b.website)) return json({ ok: true })

      // Een onderneming heet in de databank nog 'centrale' (aanvraagtype); het formulier mag beide sturen.
      const type = b.type === "onderneming" || b.type === "centrale" ? "centrale" : b.type === "individueel" ? "individueel" : null
      const email = tekst(b.email, 254)
      const voornaam = tekst(b.voornaam, 80)
      const achternaam = tekst(b.achternaam, 80)
      const product = tekst(b.product_id, 36)
      if (!type) return fout("Kies of je inschrijft als persoon of als onderneming.")
      if (!voornaam || !achternaam) return fout(type === "centrale" ? "Vul de voornaam en achternaam van de contactpersoon in." : "Vul je voornaam en achternaam in.")
      if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
      if (!product || !UUID.test(product)) return fout("Kies een cursusonderdeel.")
      if (b.akkoord !== true) return fout("Bevestig dat je de voorwaarden en de privacyverklaring aanvaardt.")

      // Facturatie: een onderneming altijd op naam en btw-nummer; een persoon kan kiezen voor een factuur op een bedrijf.
      const opBedrijf = type === "centrale" || b.factuur_bedrijf === true
      const bedrijf = opBedrijf ? tekst(b.organisatie_naam, 160) : null
      const { btw, fout: btwFout } = opBedrijf ? btwVeld(b.btw_nummer) : { btw: null }
      const plaatsen = type === "centrale" ? geheel(b.aantal_plaatsen, 1, 500) : 1
      if (opBedrijf) {
        if (!bedrijf) return fout(type === "centrale" ? "Vul de naam van de onderneming in." : "Vul de naam van het bedrijf in voor de factuur.")
        if (!btw) return fout("Vul het btw-nummer in, bv. BE0123456749.")
        if (btwFout) return fout(btwFout)
      }
      if (!plaatsen) return fout("Vul het aantal plaatsen in (1 tot 500).")

      const [p] = await sql`SELECT id FROM producten WHERE id = ${product} AND product_te_koop(id)`
      if (!p) return fout("Dit cursusonderdeel is niet beschikbaar.")

      // Max. 5 open aanvragen per e-mailadres per dag tegen misbruik.
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM aanvragen WHERE email = ${email} AND ingediend_op > now() - interval '1 day'`
      if (n >= 5) return fout("Je hebt vandaag al meerdere aanvragen ingediend. We nemen contact met je op.", 429)

      await sql`
        INSERT INTO aanvragen (type, voornaam, achternaam, email, telefoon, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, opmerking)
        VALUES (${type}, ${voornaam}, ${achternaam}, ${email}, ${tekst(b.telefoon, 40)},
                ${bedrijf}, ${btw}, ${tekst(b.adres, 300)},
                ${product}, ${plaatsen}, ${tekst(b.opmerking, 1000)})`
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
  path: ["/api/producten", "/api/aanvraag"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
}
