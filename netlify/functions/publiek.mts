import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout, tekst, geheel, EMAIL, UUID } from "../lib/db.mts"

export default async (req: Request, context: Context) => {
  const pad = new URL(req.url).pathname
  const sql = db()

  try {
    if (pad === "/api/producten" && req.method === "GET") {
      const producten = await sql`
        SELECT p.id, p.code, p.naam, p.type, p.periode, p.geldigheid_maanden, p.prijs_excl_btw, p.beschrijving
        FROM producten p WHERE p.actief
        ORDER BY CASE p.type WHEN 'abonnement' THEN 1 WHEN 'traject' THEN 2 ELSE 3 END, p.code`
      // Publieke regels voor de startpagina (verlenging en btw); enkel getallen uit de tabel instellingen.
      const rijen = await sql`
        SELECT sleutel, waarde #>> '{}' AS waarde FROM instellingen
        WHERE sleutel IN ('verlenging_maanden', 'verlenging_prijs_pct', 'verlenging_max', 'verlenging_venster_maanden', 'btw_pct')`
      const regels: Record<string, number> = {}
      for (const r of rijen) {
        const n = Number(r.waarde)
        if (Number.isFinite(n)) regels[r.sleutel] = n
      }
      return json({ producten, regels })
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

      const type = b.type === "centrale" ? "centrale" : b.type === "individueel" ? "individueel" : null
      const email = tekst(b.email, 254)
      const voornaam = tekst(b.voornaam, 80)
      const achternaam = tekst(b.achternaam, 80)
      const product = tekst(b.product_id, 36)
      if (!type) return fout("Kies of je inschrijft als persoon of als centrale.")
      if (!voornaam || !achternaam) return fout("Vul je voornaam en achternaam in.")
      if (!email || !EMAIL.test(email)) return fout("Vul een geldig e-mailadres in.")
      if (!product || !UUID.test(product)) return fout("Kies een cursusonderdeel.")
      if (b.akkoord !== true) return fout("Bevestig dat je de voorwaarden en de privacyverklaring aanvaardt.")

      const centrale = tekst(b.organisatie_naam, 160)
      const btw = tekst(b.btw_nummer, 20)?.replace(/[\s.]/g, "").toUpperCase() ?? null
      const plaatsen = type === "centrale" ? geheel(b.aantal_plaatsen, 1, 500) : 1
      if (type === "centrale") {
        if (!centrale) return fout("Vul de naam van de centrale in.")
        if (!btw || !/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(btw)) return fout("Vul een geldig btw-nummer in, bv. BE0123456789.")
        if (!plaatsen) return fout("Vul het aantal plaatsen in (1 tot 500).")
      }

      const [p] = await sql`SELECT id FROM producten WHERE id = ${product} AND actief`
      if (!p) return fout("Dit cursusonderdeel is niet beschikbaar.")

      // Max. 5 open aanvragen per e-mailadres per dag tegen misbruik.
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM aanvragen WHERE email = ${email} AND ingediend_op > now() - interval '1 day'`
      if (n >= 5) return fout("Je hebt vandaag al meerdere aanvragen ingediend. We nemen contact met je op.", 429)

      await sql`
        INSERT INTO aanvragen (type, voornaam, achternaam, email, telefoon, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, opmerking)
        VALUES (${type}, ${voornaam}, ${achternaam}, ${email}, ${tekst(b.telefoon, 40)},
                ${type === "centrale" ? centrale : null}, ${type === "centrale" ? btw : null}, ${tekst(b.adres, 300)},
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
