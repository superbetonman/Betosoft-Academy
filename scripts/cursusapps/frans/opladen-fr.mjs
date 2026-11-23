// Laadt de Franse demo op als demo-fr.html bij de bron (BMC-BPB). Geserveerd op /fr/demo/BMC/ (netlify/functions/cursus.mts).
// Gebruik: DATABASE_URL=… node opladen-fr.mjs <demo-fr.html> [bron=BMC-BPB]
import { neon } from "@neondatabase/serverless"
import fs from "node:fs"
const sql = neon(process.env.DATABASE_URL)
const [bestand, bron = "BMC-BPB"] = process.argv.slice(2)
const inhoud = fs.readFileSync(bestand, "utf8")
await sql.transaction([
  sql`DELETE FROM cursus_bestanden WHERE cursus = ${bron} AND pad = 'demo-fr.html'`,
  sql`INSERT INTO cursus_bestanden (cursus, pad, type, inhoud, bron) VALUES (${bron}, 'demo-fr.html', 'text/html; charset=utf-8', ${inhoud}, 'vertaling demo.html (FR)')`,
])
console.log(bron, "demo-fr.html", Math.round(inhoud.length / 1024), "KB")
