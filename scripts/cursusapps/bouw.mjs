// Bouwt de cursusbestanden voor de academie uit de artifacts:
//  - beheer.html: de cursus zoals gebouwd, met opnamebriefings, AI-prompts en mediaplan (enkel voor beheerders)
//  - index.html: cursistenversie: zonder briefings, prompts en mediaplan; de beeldvakken blijven als placeholder
//    (die teksten zitten ook niet in de broncode die de cursist ontvangt)
//  - demo.html: ingekorte teaser (module 0 + de eerste twee lessen van module 1); de inhoud van de andere modules
//    zit NIET in het bestand, zodat ze ook niet in de broncode van de demo te lezen is.
// Gebruik: npm i acorn@8 acorn-walk@8 (in een aparte map) en dan node bouw.mjs <uitmap>.
// Het resultaat (de cursusinhoud) hoort NIET in deze publieke repo: laad het op met opladen.mjs.
import fs from "node:fs"
import path from "node:path"
import * as acorn from "acorn"
import * as walk from "acorn-walk"

// Bronmappen: T = de opgehaalde artifact-HTML (Artifact read), S = map met de losse modulescripts (m2.js ...).
// Pas de paden aan of geef ze mee via de omgeving.
const T = process.env.ARTIFACTS || "/root/.claude/projects/-home-user-Betosoft-Academy/6be09980-8e69-5402-8d43-7c5de17d33cb/tool-results"
const S = process.env.EXTRA || "/tmp/claude-0/-home-user-Betosoft-Academy/6be09980-8e69-5402-8d43-7c5de17d33cb/scratchpad"
const CURSUSSEN = [
  { code: "BMC-BPB", bron: "artifact-7e35f0fe-1793531118-8407.html", url: "Gaw4cbxy6jAehrHgXMw6ne", product: "CRS-BMC-BPB" },
  { code: "LAB", bron: "artifact-5efec2a4-1793473462-1fe2.html", url: "CjN6BJSmqUf85MaMU9LsQQ", product: "CRS-LAB" },
  { code: "DSP", bron: "artifact-8ab271c4-1793442580-7f98.html", url: "J8MuGWkqX4ni5uPrkxdvAL", product: "CRS-DSP", extra: `${S}/catalogus/src/disp1` },
  { code: "MENG", bron: "artifact-547fde33-1793613707-f46c.html", url: "BSCBBERNUMJyooSUPWd2GE", product: "CRS-MENG" },
  { code: "AI", bron: "artifact-98c62fa3-1793375140-79bc.html", url: "KsBYuRJkqZWpfnDsuPwZLV", product: "CRS-AI", extra: `${S}/catalogus-b/ai-files` },
  { code: "VRK", bron: "artifact-8b3a1d5d-1793520934-ff36.html", url: "JCA3nRWgGv6EijjX6f38tV" },
  { code: "PLM", bron: "artifact-f01e8662-1793520932-eb9b.html", url: "WekncP6rDyR8oodKmCPyKs" },
  { code: "CSC", bron: "artifact-e15fd538-1793518100-8161.html", url: "Uq9k6jXZzjhKuLKRa1Pndt" },
  { code: "BT1", bron: "artifact-08dad6d7-1793529805-b0cb.html", url: "26RJzcCHX37ZgetFiXgW4N", geenDemo: true },
  { code: "BT2", bron: "artifact-64340363-1793540992-38ab.html", url: "DNfWM52JYcJrsW3xDNET5P", geenDemo: true },
]
const LESSEN_IN_DEMO = 2

function injecteer(html, c, { demo = false, beheer = false } = {}) {
  const cfg = JSON.stringify({ cursus: c.code, demo, beheer, product: c.product || null })
  const tag = `<script>window.ACADEMIE=${cfg};</script><script src="/cursus-academie.js"></script>`
  const m = html.match(/<meta charset=[^>]*>/i)
  if (!m) throw new Error(c.code + ": geen meta charset")
  return html.replace(m[0], m[0] + tag)
}

function prop(obj, naam) {
  return obj.properties.find((p) => p.type === "Property" && !p.computed && ((p.key.type === "Identifier" && p.key.name === naam) || (p.key.type === "Literal" && p.key.value === naam)))
}

function korteScript(code, label, extern = new Set()) {
  let ast
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true })
  } catch (e) {
    return { code, modules: 0, fout: `${label}: niet te parsen (${e.message})` }
  }
  const vervang = []
  let modules = 0
  const gezien = []
  walk.full(ast, (n) => {
    // inhoud van proef- en werkfiches (FICHE_DATA, FD) hoort niet in de demo
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && /^(FICHE_DATA\d*|FD)$/.test(n.id.name) && n.init && n.init.type === "ObjectExpression") {
      vervang.push([n.init.start, n.init.end, "{}"])
      return
    }
    if (n.type !== "ObjectExpression") return
    const id = prop(n, "id"), lessen = prop(n, "lessons"), titel = prop(n, "title"), nr = prop(n, "n")
    // een fiche met inhoud in de lijst zelf: enkel de kenmerken houden, niet beschikbaar
    if (id && titel && prop(n, "norm") && prop(n, "group")) {
      const houd = ["id", "group", "icon", "title", "norm", "mod", "code"].map((k) => prop(n, k)).filter(Boolean).map((p) => code.slice(p.start, p.end))
      // lege velden, zodat code die fiches achteraf aanvult niet struikelt
      const leeg = "avail: false, steps: Array.from({ length: 12 }, () => ({ items: [], lines: [] })), side: Array.from({ length: 6 }, () => ({ items: [], lines: [] })), facts: [], errors: []"
      vervang.push([n.start, n.end, "{ " + houd.concat([leeg]).join(", ") + " }"])
      return
    }
    if (!id || !titel || id.value.type !== "Literal" || typeof id.value.value !== "string") return
    if (!lessen && !nr) return // geen module
    if (lessen && lessen.value.type !== "ArrayExpression") return
    modules++
    const mid = id.value.value
    gezien.push(mid)
    if (mid === "m0") return // de start blijft volledig
    const avail0 = prop(n, "avail")
    if (!lessen) {
      // module zonder lessen in dit bestand (inhoud in een los script, of nog in voorbereiding)
      if (avail0 && avail0.value.type === "Literal" && avail0.value.value === false) {
        // inhoud komt uit een los script (m2.js ...) dat niet in de demo zit: markeren als "in de volledige cursus"
        if (extern.has(mid)) vervang.push([n.start + 1, n.start + 1, " demo: true,"])
        return // anders echt in voorbereiding: laten
      }
      if (avail0) vervang.push([avail0.value.start, avail0.value.end, "false"])
      const ex = ["lessons: []", "demo: true"]
      if (!avail0) ex.push("avail: false")
      if (!prop(n, "preview")) ex.push('preview: "Zit in de volledige cursus."')
      vervang.push([n.start + 1, n.start + 1, " " + ex.join(", ") + ","])
      return
    }
    const els = lessen.value.elements.filter(Boolean)
    if (mid === "m1") {
      // enkel de eerste lessen (geen praktijkopdracht of toets)
      const houd = []
      for (const el of els) {
        if (houd.length >= LESSEN_IN_DEMO) break
        if (el.type !== "ObjectExpression") continue
        const kind = prop(el, "kind")
        const k = kind && kind.value.type === "Literal" ? kind.value.value : "les"
        if (k === "les") houd.push(code.slice(el.start, el.end))
      }
      vervang.push([lessen.value.start, lessen.value.end, "[" + houd.join(",\n") + "]"])
      return
    }
    // alle andere modules: lessen weg, niet beschikbaar, gemarkeerd als demo
    vervang.push([lessen.value.start, lessen.value.end, "[]"])
    const avail = prop(n, "avail")
    if (avail) vervang.push([avail.value.start, avail.value.end, "false"])
    const extra = []
    if (!avail) extra.push("avail: false")
    extra.push("demo: true")
    const prev = prop(n, "preview")
    if (!prev) extra.push('preview: "Zit in de volledige cursus."')
    vervang.push([n.start + 1, n.start + 1, " " + extra.join(", ") + ","])
  })
  // geneste vervangingen binnen een groter vervangen stuk vallen weg
  const buiten = vervang.filter(([a, b]) => !vervang.some(([x, y]) => (x < a && b <= y) || (x <= a && b < y)))
  vervang.length = 0
  vervang.push(...buiten)
  vervang.sort((a, b) => b[0] - a[0] || b[1] - a[1])
  let uit = code
  for (const [a, b, t] of vervang) uit = uit.slice(0, a) + t + uit.slice(b)
  return { code: uit, modules, gezien }
}

// ---------- Cursistenversie: geen opnamebriefings, AI-prompts of mediaplan ----------
// Deze functies worden leeggemaakt (hun teksten verdwijnen zo ook uit de broncode).
const LEEG = { briefHtml: 'return "";', fichePrompt: 'return "";', renderMedia: 'location.replace("#start");' }
const PRODUCTIEZIN = /[^.]*(referentiebeeld|in elk shot|AI-animatie die|opnamedag|draaiboek)[^.]*\.\s*/gi

function zonderProductie(code, label) {
  let ast
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true })
  } catch (e) {
    return { code, fout: `${label}: niet te parsen (${e.message})`, n: 0 }
  }
  const vervang = []
  let n = 0
  walk.full(ast, (k) => {
    // functies die briefings, prompts of het mediaplan opbouwen: de hele inhoud weg
    if (k.type === "FunctionDeclaration" && k.id && LEEG[k.id.name] !== undefined) {
      vervang.push([k.body.start, k.body.end, "{ " + LEEG[k.id.name] + " }"]); n++
      return
    }
    // AI-stijl en personages voor de beeldprompts (const AI_STYLE = "...")
    if (k.type === "VariableDeclarator" && k.id.type === "Identifier" && /^AI_[A-Z_]+$/.test(k.id.name) && k.init) {
      vervang.push([k.init.start, k.init.end, '""']); n++
      return
    }
    if (k.type !== "ObjectExpression") return
    const t = prop(k, "t")
    if (t && t.value.type === "Literal" && t.value.value === "media") {
      // beeldvak: briefing (shot) en prompt (ai) weg; de placeholder toont "Volgt binnenkort" in plaats van de opnameduur
      const shot = prop(k, "shot"), ai = prop(k, "ai"), cap = prop(k, "cap")
      if (ai) { vervang.push([ai.start, ai.end, 'ai: ""']); n++ }
      if (shot) { vervang.push([shot.start, shot.end, 'shot: { duur: "Volgt binnenkort" }']); n++ }
      if (cap && cap.value.type === "Literal" && typeof cap.value.value === "string" && PRODUCTIEZIN.test(cap.value.value)) {
        PRODUCTIEZIN.lastIndex = 0
        const schoon = cap.value.value.replace(PRODUCTIEZIN, "").trim()
        vervang.push([cap.value.start, cap.value.end, JSON.stringify(schoon)]); n++
      }
      PRODUCTIEZIN.lastIndex = 0
      return
    }
    // posterprompt bij een fiche
    const pr = prop(k, "prompt")
    const tekst = !pr ? "" : pr.value.type === "Literal" ? String(pr.value.value) : pr.value.type === "TemplateLiteral" ? pr.value.quasis.map((q) => q.value.cooked).join(" ") : ""
    if (pr && /poster|ontwerp/i.test(tekst)) {
      vervang.push([pr.value.start, pr.value.end, '""']); n++
    }
  })
  vervang.sort((a, b) => b[0] - a[0])
  let uit = code
  for (const [a, b, t] of vervang) uit = uit.slice(0, a) + t + uit.slice(b)
  return { code: uit, n }
}

// Tekstvervangingen in de weergave (in elke cursus die ze heeft)
const WEERGAVE = [
  ['<a href="#media">Mediaplan</a>', ""],
  ['<a class="btn" href="#media">${I.video}Mediaplan</a>', ""],
  ['<a class="btn" href="#fPrompt">Prompt voor een andere AI</a>', ""],
  ['<section class="prompt" id="fPrompt">', '<section class="prompt" id="fPrompt" hidden>'],
  ['<button class="btn" type="button" data-copy="fp-${b.id}">Kopieer posterprompt</button>', ""],
  ['<button class="btn" type="button" data-copy="fp2-${id}">Kopieer posterprompt</button>', ""],
  [", of laat ze als poster ontwerpen met de tekst onderaan.", "."],
  ["Open de cursus op claude.ai, of kopieer de prompt hieronder.", "Probeer het opnieuw in een andere browser."],
]

function cursistVersie(html, c) {
  const verslag = []
  let h = html.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g, (alles, open, inhoud, sluit) => {
    if (inhoud.length < 2000) return alles
    const r = zonderProductie(inhoud, c.code)
    if (r.fout) verslag.push(r.fout)
    if (r.n) verslag.push(`${r.n} productievelden`)
    return open + r.code + sluit
  })
  for (const [a, b] of WEERGAVE) {
    const n = h.split(a).length - 1
    if (n) { h = h.split(a).join(b); verslag.push(`${n}× ${a.slice(0, 28)}`) }
  }
  return { html: h, verslag }
}

function maakDemo(html, c) {
  // losse modulescripts (m2.js ...) horen niet bij de demo
  const extern = new Set([...html.matchAll(/<script src="(m\d+)\.js"><\/script>/g)].map((x) => x[1]))
  let h = html.replace(/<script src="m\d+\.js"><\/script>\s*/g, "")
  const verslag = []
  h = h.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g, (alles, open, inhoud, sluit) => {
    if (inhoud.length < 2000 || !/lessons/.test(inhoud)) return alles
    const r = korteScript(inhoud, c.code, extern)
    if (r.fout) verslag.push(r.fout)
    if (r.modules) verslag.push(`${r.modules} modules (${r.gezien.join(",")})`)
    return open + r.code + sluit
  })
  // mengselontwerp vult enkele lessen achteraf aan; in de demo bestaan die lessen niet meer
  h = h.replace(
    "const les = id => { for (const m of COURSE) { const l = m.lessons.find(x => x.id === id); if (l) return l; } return null; };",
    "const les = id => { for (const m of COURSE) { const l = m.lessons.find(x => x.id === id); if (l) return l; } return new Proxy({ blocks: [], quiz: [], tasks: [] }, { get: (t, k) => (k in t ? t[k] : []) }); };",
  )
  // labels in de inhoudstafel: "in de volledige cursus" in plaats van "in voorbereiding" voor ingekorte modules
  h = h.replace("${m.sub} · in voorbereiding", '${m.sub} · ${m.demo ? "in de volledige cursus" : "in voorbereiding"}')
  h = h.replace('<span class="pill">In voorbereiding</span>', '<span class="pill">${m.demo ? "Volledige cursus" : "In voorbereiding"}</span>')
  return { html: h, verslag }
}

const uit = process.argv[2]
fs.mkdirSync(uit, { recursive: true })
const overzicht = []
for (const c of CURSUSSEN) {
  const bronHtml = fs.readFileSync(path.join(T, c.bron), "utf8")
  const map = path.join(uit, c.code)
  fs.mkdirSync(map, { recursive: true })
  fs.writeFileSync(path.join(map, "beheer.html"), injecteer(bronHtml, c, { beheer: true }))
  const cv = cursistVersie(bronHtml, c)
  fs.writeFileSync(path.join(map, "index.html"), injecteer(cv.html, c))
  const extra = c.extra ? fs.readdirSync(c.extra).filter((f) => /^m\d+\.js$/.test(f)) : []
  for (const f of extra) fs.copyFileSync(path.join(c.extra, f), path.join(map, f))
  let demo = null
  if (!c.geenDemo) {
    const d = maakDemo(cv.html, c)
    fs.writeFileSync(path.join(map, "demo.html"), injecteer(d.html, c, { demo: true }))
    demo = { grootte: d.html.length, verslag: d.verslag }
  }
  overzicht.push({ code: c.code, volledig: bronHtml.length, cursist: cv.verslag, extra, demo })
}
fs.writeFileSync(path.join(uit, "cursussen.json"), JSON.stringify(CURSUSSEN, null, 1))
console.log(JSON.stringify(overzicht, null, 1))
