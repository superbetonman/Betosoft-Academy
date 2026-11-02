import type { Config, Context } from "@netlify/functions"
import { db, json, fout, dbFout } from "../lib/db.mts"
import { aangemeld, eigenAanvraag, isBeheer } from "../lib/sessie.mts"
import { CURSUSCODE, magCursus } from "../lib/cursustoegang.mts"

/**
 * Leeromgeving:
 *   GET    /api/leren/cursussen                 cursussen voor de aangemelde gebruiker (beheerders: alle, als tester)
 *   GET    /api/leren/gegevens/<CODE>?pad=…      één document van de cursusapp (bv. de voortgang)
 *   GET    /api/leren/gegevens/<CODE>?map=…      alle documenten direct onder een map
 *   PUT    /api/leren/gegevens/<CODE>            { pad, data } bewaren
 *   DELETE /api/leren/gegevens/<CODE>?pad=…      één document wissen
 */

const MAX_BYTES = 256 * 1024
const PAD = /^[A-Za-z0-9_\-./]{1,200}$/

export default async (req: Request, context: Context) => {
  if (!eigenAanvraag(req)) return fout("Ongeldige aanvraag.", 403)
  const g = await aangemeld(context)
  if (!g) return fout("Niet aangemeld.", 401)
  const url = new URL(req.url)
  const delen = url.pathname.replace(/^\/api\/leren\/?/, "").split("/").filter(Boolean)
  const sql = db()

  try {
    if (delen[0] === "cursussen" && req.method === "GET") {
      const rijen = await sql`
        SELECT c.code, c.titel, c.beschrijving, c.volgorde,
               EXISTS (SELECT 1 FROM cursus_bestanden b WHERE b.cursus = c.code AND b.pad = 'demo.html') AS demo,
               (SELECT count(*) FROM modules m WHERE m.cursus_id = c.id)::int AS modules,
               (SELECT count(DISTINCT mt.module_id) FROM v_module_toegang mt JOIN modules m ON m.id = mt.module_id
                 WHERE mt.gebruiker_id = ${g.id} AND m.cursus_id = c.id)::int AS modules_toegang,
               (SELECT min(mt.eind_datum)::text FROM v_module_toegang mt JOIN modules m ON m.id = mt.module_id
                 WHERE mt.gebruiker_id = ${g.id} AND m.cursus_id = c.id) AS eind_datum,
               (SELECT cg.data FROM cursus_gegevens cg WHERE cg.gebruiker_id = ${g.id} AND cg.cursus = c.code AND cg.pad LIKE '%/progress'
                 ORDER BY cg.bijgewerkt_op DESC LIMIT 1) AS voortgang,
               (SELECT max(cg.bijgewerkt_op) FROM cursus_gegevens cg WHERE cg.gebruiker_id = ${g.id} AND cg.cursus = c.code) AS laatst
        FROM cursussen c
        WHERE EXISTS (SELECT 1 FROM cursus_bestanden b WHERE b.cursus = c.code AND b.pad = 'index.html')
        ORDER BY c.volgorde, c.code`
      const beheer = isBeheer(g)
      const cursussen = rijen
        .map((r: any) => {
          const toegang = beheer || (r.modules > 0 && r.modules_toegang === r.modules)
          const done = r.voortgang && typeof r.voortgang.done === "object" ? Object.keys(r.voortgang.done).length : 0
          return {
            code: r.code,
            titel: r.titel,
            beschrijving: r.beschrijving,
            demo: r.demo,
            toegang,
            als_tester: beheer && !(r.modules > 0 && r.modules_toegang === r.modules),
            deels: !toegang && r.modules_toegang > 0,
            eind_datum: r.eind_datum,
            lessen_af: done,
            laatst: r.laatst,
          }
        })
        .filter((c: any) => c.toegang || c.deels)
      return json({ cursussen, beheer })
    }

    if (delen[0] === "gegevens" && delen[1]) {
      const code = delen[1].toUpperCase()
      if (!CURSUSCODE.test(code)) return fout("Onbekende cursus.", 404)
      if (!(await magCursus(g, code))) return fout("Geen toegang tot deze cursus.", 403)

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
