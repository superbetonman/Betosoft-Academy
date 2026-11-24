// Maakt een SCORM 1.2-pakket (zip) van een cursusapp, om in een LMS zoals TalentLMS op te laden
// (eenheid "SCORM | xAPI | cmi5"; TalentLMS aanvaardt enkel SCORM 1.2).
// In het pakket: de cursistenversie van de app (index.html uit cursus_bestanden, zonder opnamebriefings en prompts),
// met scorm-brug.js in de plaats van /cursus-academie.js, eventuele losse modulescripts (m2.js ...) en imsmanifest.xml.
// Wat de brug aan het LMS doorgeeft (voortgang, status, score): zie scorm-brug.js.
//
// Gebruik:  DATABASE_URL=… node scripts/scorm/maak-scorm.mjs LAB <uitmap>
//      of:  node scripts/scorm/maak-scorm.mjs LAB <uitmap> --bron <index.html>   (titel uit <title>)
// Resultaat: <uitmap>/<CODE>-scorm12.zip. Dat bevat de cursusinhoud: NIET in deze publieke repo zetten.
// Getest met LAB. Afgeleide cursussen (BMC, BPB) en BT1/BT2 (zonder COURSE) worden geweigerd.
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { fileURLToPath } from "node:url"

const hier = path.dirname(fileURLToPath(import.meta.url))
const [code, uit, ...rest] = process.argv.slice(2)
if (!code || !uit) {
  console.error("Gebruik: node maak-scorm.mjs <CODE> <uitmap> [--bron index.html]")
  process.exit(1)
}
const bronArg = rest[0] === "--bron" ? rest[1] : null

// ---------- Bestanden van de cursus ----------
let html, titel, extra = []
if (bronArg) {
  html = fs.readFileSync(bronArg, "utf8")
} else {
  const { neon } = await import("@neondatabase/serverless")
  const sql = neon(process.env.DATABASE_URL)
  const [c] = await sql`SELECT code, titel, bron FROM cursussen WHERE code = ${code}`
  if (!c) throw new Error(`${code}: cursus niet gevonden`)
  if (c.bron) throw new Error(`${code} is afgeleid van ${c.bron}: niet ondersteund (de app moet dan modules filteren)`)
  titel = c.titel
  const rijen = await sql`SELECT pad, inhoud FROM cursus_bestanden WHERE cursus = ${code} AND (pad = 'index.html' OR pad LIKE '%.js')`
  const index = rijen.find((r) => r.pad === "index.html")
  if (!index) throw new Error(`${code}: geen index.html in cursus_bestanden`)
  html = index.inhoud
  extra = rijen.filter((r) => r.pad.endsWith(".js")).map((r) => ({ pad: r.pad, inhoud: r.inhoud }))
}
if (!titel) titel = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || code

if (!html.includes("window.ACADEMIE_COURSE")) throw new Error(`${code}: geen lessenlijst (ACADEMIE_COURSE): de brug kan de status niet bepalen`)
const sleutel = (html.match(/const LS_KEY\s*=\s*"([^"]+)"/) || [])[1] || null
if (!sleutel) console.warn(`${code}: geen LS_KEY gevonden; wijzigingen vlak voor het afsluiten kunnen verloren gaan`)

// ---------- De brug in de plaats van cursus-academie.js ----------
const cfg = JSON.stringify({ cursus: code, sleutel })
const tag = `<script>window.SCORM_PAKKET=${cfg};</script><script src="scorm-brug.js"></script>`
const academie = /<script>window\.ACADEMIE=\{[^<]*\};<\/script><script src="\/cursus-academie\.js"><\/script>/
if (academie.test(html)) html = html.replace(academie, tag)
else {
  const m = html.match(/<meta charset=[^>]*>/i)
  if (!m) throw new Error(`${code}: geen meta charset`)
  html = html.replace(m[0], m[0] + tag)
}
if (html.includes("/cursus-academie.js")) throw new Error(`${code}: verwijzing naar cursus-academie.js blijft staan`)

// ---------- Manifest (SCORM 1.2, één SCO) ----------
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const bestanden = ["index.html", "scorm-brug.js", ...extra.map((e) => e.pad)]
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="betosoft-academy-${xml(code)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-${xml(code)}">
    <organization identifier="org-${xml(code)}">
      <title>${xml(titel)}</title>
      <item identifier="item-${xml(code)}" identifierref="res-${xml(code)}" isvisible="true">
        <title>${xml(titel)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-${xml(code)}" type="webcontent" adlcp:scormtype="sco" href="index.html">
${bestanden.map((f) => `      <file href="${xml(f)}"/>`).join("\n")}
    </resource>
  </resources>
</manifest>
`

// ---------- Zip (deflate, zonder extra pakketten) ----------
function zip(items) {
  const lokaal = [], centraal = []
  let pos = 0
  const nu = new Date()
  const tijd = (nu.getHours() << 11) | (nu.getMinutes() << 5) | (nu.getSeconds() >> 1)
  const datum = ((nu.getFullYear() - 1980) << 9) | ((nu.getMonth() + 1) << 5) | nu.getDate()
  for (const { naam, data } of items) {
    const n = Buffer.from(naam, "utf8")
    const z = zlib.deflateRawSync(data, { level: 9 })
    const crc = zlib.crc32(data)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt16LE(tijd, 10); h.writeUInt16LE(datum, 12); h.writeUInt32LE(crc, 14)
    h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10)
    c.writeUInt16LE(tijd, 12); c.writeUInt16LE(datum, 14); c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(z.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28)
    c.writeUInt32LE(pos, 42)
    lokaal.push(h, n, z)
    centraal.push(c, n)
    pos += h.length + n.length + z.length
  }
  const cd = Buffer.concat(centraal)
  const e = Buffer.alloc(22)
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(items.length, 8); e.writeUInt16LE(items.length, 10)
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(pos, 16)
  return Buffer.concat([...lokaal, cd, e])
}

const items = [
  { naam: "imsmanifest.xml", data: Buffer.from(manifest, "utf8") },
  { naam: "index.html", data: Buffer.from(html, "utf8") },
  { naam: "scorm-brug.js", data: fs.readFileSync(path.join(hier, "scorm-brug.js")) },
  ...extra.map((e) => ({ naam: e.pad, data: Buffer.from(e.inhoud, "utf8") })),
]
fs.mkdirSync(uit, { recursive: true })
const doel = path.join(uit, `${code}-scorm12.zip`)
fs.writeFileSync(doel, zip(items))
console.log(`${doel}: ${items.map((i) => i.naam).join(", ")} (${Math.round(fs.statSync(doel).size / 1024)} KB), titel "${titel}", sleutel ${sleutel}`)
