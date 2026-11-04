// Zet de filterhaak (zie haken.mjs) in de opgeslagen bestanden van een cursus in de databank.
// Eenmalig nodig voor apps die vóór de haak gebouwd werden (BMC-BPB, migratie 007); bouw.mjs zet ze voortaan zelf.
// Gebruik: npm i acorn@8 acorn-walk@8 @neondatabase/serverless (in een aparte map), dan
//   DATABASE_URL=... node haak-filter.mjs BMC-BPB [--droog]
// De tijdstempel van de bestanden blijft ongewijzigd: de inhoud en de lessenlijst veranderen niet.
import { neon } from "@neondatabase/serverless"
import { metFilter } from "./haken.mjs"

const [cursus, optie] = process.argv.slice(2)
if (!cursus) throw new Error("Geef de cursuscode mee, bv. BMC-BPB")
const sql = neon(process.env.DATABASE_URL)
const rijen = await sql`SELECT pad, inhoud FROM cursus_bestanden WHERE cursus = ${cursus} AND pad LIKE '%.html' ORDER BY pad`
for (const r of rijen) {
  const nieuw = metFilter(r.inhoud, `${cursus}/${r.pad}`)
  if (nieuw === r.inhoud) {
    console.log(`${r.pad}: ongewijzigd`)
    continue
  }
  if (optie !== "--droog") await sql`UPDATE cursus_bestanden SET inhoud = ${nieuw} WHERE cursus = ${cursus} AND pad = ${r.pad}`
  console.log(`${r.pad}: haak gezet${optie === "--droog" ? " (droog)" : ""}`)
}
