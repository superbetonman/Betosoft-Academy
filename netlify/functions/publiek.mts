import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, geheel, btwVeld, EMAIL, UUID } from "../lib/db.mts"

export default async (req: Request, context: Context) => {
  const pad = new URL(req.url).pathname
  const sql = db()

  try {
    if (pad === "/api/producten" && req.method === "GET") {
      // cursussen: de cursussen waarvan het product een deel is, of die het helemaal omvat (een pakket); product_cursussen()
      //   in de databank. Een basismodule van BMC en BPB hoort bij beide. Abonnementen: leeg.
      // cursus: de code als het product bij precies één cursus hoort.
      const producten = await sql`
        SELECT p.id, p.code, p.naam, p.type, p.periode, p.geldigheid_maanden, p.prijs_excl_btw, p.beschrijving, p.alle_modules,
               x.cursussen, CASE WHEN cardinality(x.cursussen) = 1 THEN x.cursussen[1] END AS cursus,
               (SELECT count(*)::int FROM product_modules pm WHERE pm.product_id = p.id) AS modules
        FROM producten p, LATERAL (SELECT product_cursussen(p.id) AS cursussen) x
        WHERE p.actief AND product_te_koop(p.id)
        ORDER BY CASE p.type WHEN 'abonnement' THEN 1 WHEN 'traject' THEN 2 ELSE 3 END, p.code`
      // Cursussen die publiek verschijnen (Beheer → Cursussen): 'voorbereiding' of 'inschrijven'. 'niet_tonen' blijft weg.
      const cursussen = await sql`SELECT code, startpagina FROM cursussen WHERE startpagina <> 'niet_tonen' AND NOT is_bron(code) ORDER BY volgorde, code`
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
