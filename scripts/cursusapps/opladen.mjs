// Laadt de gebouwde cursusbestanden op in cursus_bestanden (vervangt bestaande rijen per cursus).
// Gebruik: DATABASE_URL=… node opladen.mjs <uitmap van bouw.mjs>
import { neon } from "@neondatabase/serverless"
import fs from "node:fs"
import path from "node:path"
const sql = neon(process.env.DATABASE_URL)
const uit = process.argv[2]
const cursussen = JSON.parse(fs.readFileSync(path.join(uit, "cursussen.json"), "utf8"))
for (const c of cursussen) {
  const map = path.join(uit, c.code)
  const bestanden = fs.readdirSync(map)
  const q = [sql`DELETE FROM cursus_bestanden WHERE cursus = ${c.code}`]
  let totaal = 0
  for (const f of bestanden) {
    const inhoud = fs.readFileSync(path.join(map, f), "utf8")
    totaal += inhoud.length
    const type = f.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8"
    q.push(sql`INSERT INTO cursus_bestanden (cursus, pad, type, inhoud, bron) VALUES (${c.code}, ${f}, ${type}, ${inhoud}, ${"https://claude.ai/artifact/" + c.url})`)
  }
  await sql.transaction(q)
  console.log(c.code, bestanden.length, "bestanden,", Math.round(totaal / 1024), "KB")
}
