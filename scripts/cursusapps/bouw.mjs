// Bouwt de cursusbestanden voor de academy uit de artifacts:
//  - beheer.html: de cursus zoals gebouwd, met opnamebriefings, AI-prompts en mediaplan (enkel voor beheerders)
//  - index.html: cursistenversie: zonder briefings, prompts en mediaplan; de beeldvakken blijven als placeholder
//    (die teksten zitten ook niet in de broncode die de cursist ontvangt)
//  - demo.html: ingekorte teaser: de start (module 0) en vier lessen, elk uit een ander hoofdstuk en verspreid over
//    de cursus (zie `demo` per cursus hieronder). De inhoud van de andere lessen zit NIET in het bestand, zodat ze ook
//    niet in de broncode van de demo te lezen is. Uit een los modulescript (m2.js ...) gaat enkel de gekozen les mee,
//    ingebouwd in demo.html.
// Gebruik: npm i acorn@8 acorn-walk@8 (in een aparte map) en dan node bouw.mjs <uitmap>.
// Met ENKEL=LAB,DSP bouw je enkel die cursussen.
// Het resultaat (de cursusinhoud) hoort NIET in deze publieke repo: laad het op met opladen.mjs.
import fs from "node:fs"
import path from "node:path"
import * as acorn from "acorn"
import * as walk from "acorn-walk"
import { metFilter } from "./haken.mjs"

// Bronmappen: T = de opgehaalde artifact-HTML (Artifact read), S = map met de losse modulescripts (m2.js ...).
// Pas de paden aan of geef ze mee via de omgeving.
const T = process.env.ARTIFACTS || "/root/.claude/projects/-home-user-Betosoft-Academy/6be09980-8e69-5402-8d43-7c5de17d33cb/tool-results"
const S = process.env.EXTRA || "/tmp/claude-0/-home-user-Betosoft-Academy/6be09980-8e69-5402-8d43-7c5de17d33cb/scratchpad"
// demo: de lessen (id) die naast de start in de demo zitten, elk uit een ander hoofdstuk.
// snoei: in de demo ook de animaties van de andere lessen weglaten (enkel de demolessen en "traject" blijven).
// BMC-BPB is de bron van de cursussen BMC en BPB (migratie 007): die gebruiken deze app en tonen enkel hun modules
// (cursussen.app_modules); ze hebben dus geen eigen bestanden. De demo bevat lessen uit beide trajecten.
const CURSUSSEN = [
  { code: "BMC-BPB", bron: "artifact-7e35f0fe-1793531118-8407.html", url: "Gaw4cbxy6jAehrHgXMw6ne", product: null, demo: ["m1-l1", "m3-l1", "mM3-l1", "mP3-l1"] },
  { code: "LAB", bron: "artifact-5efec2a4-1793473462-1fe2.html", url: "CjN6BJSmqUf85MaMU9LsQQ", product: "CRS-LAB", demo: ["m1-l1", "m4-l1", "m8-l1", "m11-l1"] },
  { code: "DSP", bron: "artifact-8ab271c4-1793442580-7f98.html", url: "J8MuGWkqX4ni5uPrkxdvAL", product: "CRS-DSP", extra: `${S}/catalogus/src/disp1`, demo: ["m1-l1", "m4-l1", "m8-l1", "m11-l1"] },
  { code: "MENG", bron: "artifact-547fde33-1793613707-f46c.html", url: "BSCBBERNUMJyooSUPWd2GE", product: "CRS-MENG", demo: ["m1-l1", "m3-l1", "m5-l1", "m7-l1"] },
  { code: "AI", bron: "artifact-98c62fa3-1793375140-79bc.html", url: "KsBYuRJkqZWpfnDsuPwZLV", product: "CRS-AI", extra: `${S}/catalogus-b/ai-files`, demo: ["m1-l1", "m3-l1", "m4-l1", "m6-l1"] },
  { code: "VRK", bron: "artifact-8b3a1d5d-1793822959-0be0.html", url: "JCA3nRWgGv6EijjX6f38tV", product: "CRS-VRK", snoei: true, demo: ["m1-l1", "m5-l1", "g2-l1", "m11-l1"] },
  { code: "PLM", bron: "artifact-f01e8662-1793822924-3723.html", url: "WekncP6rDyR8oodKmCPyKs", product: "CRS-PLM", snoei: true, demo: ["m1-l1", "m6-l1", "g1-l1", "m9-l1"] },
  { code: "CSC", bron: "artifact-e15fd538-1793518100-8161.html", url: "Uq9k6jXZzjhKuLKRa1Pndt", product: "CRS-CSC", demo: ["m1-l1", "m2-l1", "m4-l1", "m5-l1"] },
  { code: "BT1", bron: "artifact-08dad6d7-1793529805-b0cb.html", url: "26RJzcCHX37ZgetFiXgW4N", product: "CRS-BT1", geenDemo: true },
  { code: "BT2", bron: "artifact-64340363-1793540992-38ab.html", url: "DNfWM52JYcJrsW3xDNET5P", product: "CRS-BT2", geenDemo: true },
  { code: "BT3", bron: "artifact-6a366dcd-1793822933-7ae6.html", url: "E7hqGQ3vZKnpXPfoXP7wfD", product: "CRS-BT3", snoei: true, demo: ["m1-l1", "m3-l1", "m6-l1", "m7-l1"] },
]

// Haak: de app geeft haar lessenlijst (COURSE) door aan de academy; cursus-academie.js leest window.ACADEMIE_COURSE()
// en meldt modules en lessen aan /api/leren/structuur (leerlijn, scores, attesten). COURSE zit in een afgesloten functie,
// dus de haak komt vooraan in die functie (na "use strict";). BT1 en BT2 hebben geen COURSE: de brug leest de pagina.
// Dezelfde haak werd in migratie 004 in de opgeslagen bestanden gezet.
const HAAK = "window.ACADEMIE_COURSE = function () { try { return COURSE; } catch (e) { return null; } };"
function metHaak(html, c) {
  const pc = html.indexOf("const COURSE")
  if (pc < 0 || html.includes("ACADEMIE_COURSE")) return html
  const begin = '(function () {\n"use strict";'
  const pi = html.lastIndexOf(begin, pc)
  if (pi < 0 || html.slice(pi, pc).includes("})();")) throw new Error(c.code + ": functie rond COURSE niet gevonden")
  return html.slice(0, pi + begin.length) + "\n" + HAAK + html.slice(pi + begin.length)
}

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
const waarde = (p) => (p && p.value.type === "Literal" ? p.value.value : undefined)
const ontleed = (code) => acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true })

// Vervangingen [begin, einde, tekst] toepassen. Een vervanging binnen een groter vervangen stuk valt weg.
// De tekst is een string, of een object met `tekst` (een ingebouwd modulescript).
function pas(code, vervang) {
  const buiten = vervang.filter(([a, b]) => !vervang.some(([x, y]) => (x < a && b <= y) || (x <= a && b < y)))
  buiten.sort((p, q) => q[0] - p[0] || q[1] - p[1])
  let uit = code
  for (const [a, b, t] of buiten) uit = uit.slice(0, a) + (typeof t === "string" ? t : t.tekst) + uit.slice(b)
  return uit
}

// Een inline script van de cursus inkorten. ctx: keuze (lessen in de demo), extern (modules met een los script),
// externKeuze (module -> aantal onderdelen, voor de losse scripts waaruit een les meegaat).
function korteScript(code, label, ctx) {
  let ast
  try {
    ast = ontleed(code)
  } catch (e) {
    return { vervang: [], modules: 0, gezien: [], gehouden: [], fout: `${label}: niet te parsen (${e.message})` }
  }
  // modules met inhoud (in dit script of in een los script) en modules met een gekozen les
  const metInhoud = new Set(ctx.extern)
  const metKeuze = new Set(ctx.externKeuze.keys())
  walk.full(ast, (n) => {
    if (n.type !== "ObjectExpression") return
    const id = waarde(prop(n, "id")), lessen = prop(n, "lessons")
    if (typeof id !== "string" || !lessen || lessen.value.type !== "ArrayExpression" || !lessen.value.elements.length) return
    metInhoud.add(id)
    if (lessen.value.elements.some((el) => el && el.type === "ObjectExpression" && ctx.keuze.has(waarde(prop(el, "id"))))) metKeuze.add(id)
  })
  const vervang = []
  const gezien = []
  const gehouden = []
  let modules = 0
  // lessen die achteraf worden toegevoegd of aangevuld (mengselontwerp: ins("m3", "m3-l3", [...]) en
  // const t3 = les("m3-ts"); t3.quiz.push(...)): enkel voor de start en de gekozen lessen
  const inDemo = (id) => typeof id === "string" && (id.startsWith("m0-") || ctx.keuze.has(id))
  const aanvulling = [] // { naam, les, begin, einde }: de variabele geldt binnen het blok waarin ze staat
  walk.fullAncestor(ast, (n, _st, voorouders) => {
    if (n.type !== "VariableDeclarator" || n.id.type !== "Identifier" || !n.init || n.init.type !== "CallExpression") return
    const f = n.init
    if (f.callee.type !== "Identifier" || f.callee.name !== "les" || !f.arguments[0] || typeof f.arguments[0].value !== "string") return
    const blok = [...voorouders].reverse().find((a) => a.type === "BlockStatement" || a.type === "Program")
    aanvulling.push({ naam: n.id.name, les: f.arguments[0].value, begin: blok.start, einde: blok.end })
  })
  const lesVan = (naam, pos) => aanvulling.filter((a) => a.naam === naam && a.begin <= pos && pos <= a.einde).sort((p, q) => q.begin - p.begin)[0]
  walk.full(ast, (n) => {
    if (n.type !== "CallExpression") return
    const args = n.arguments
    if (n.callee.type === "Identifier" && n.callee.name === "ins" && args.length === 3 && args[2].type === "ArrayExpression") {
      const houd = args[2].elements.filter((el) => el && el.type === "ObjectExpression" && inDemo(waarde(prop(el, "id"))))
      houd.forEach((el) => { if (ctx.keuze.has(waarde(prop(el, "id")))) gehouden.push(waarde(prop(el, "id"))) })
      if (houd.length < args[2].elements.length) vervang.push([args[2].start, args[2].end, "[" + houd.map((el) => code.slice(el.start, el.end)).join(",\n") + "]"])
      return
    }
    const c = n.callee
    if (c.type !== "MemberExpression" || c.property.type !== "Identifier" || !["push", "unshift", "splice"].includes(c.property.name) || !args.length) return
    const doel = c.object.type === "MemberExpression" ? c.object.object : null
    const a = doel && doel.type === "Identifier" ? lesVan(doel.name, n.start) : null
    if (!a || inDemo(a.les)) return
    if (c.property.name === "splice") { if (args.length > 2) vervang.push([args[1].end, args[args.length - 1].end, ""]) }
    else vervang.push([args[0].start, args[args.length - 1].end, ""])
  })
  // module niet in de demo: geen lessen, niet beschikbaar, label "volledige cursus"
  const markeer = (n, zonderLessen) => {
    const avail = prop(n, "avail")
    if (avail) vervang.push([avail.value.start, avail.value.end, "false"])
    const ex = zonderLessen ? ["lessons: []"] : []
    if (!avail) ex.push("avail: false")
    ex.push("demo: true")
    if (!prop(n, "preview")) ex.push('preview: "Zit in de volledige cursus."')
    vervang.push([n.start + 1, n.start + 1, " " + ex.join(", ") + ","])
  }
  walk.full(ast, (n) => {
    // inhoud van proef- en werkfiches (FICHE_DATA, FD) hoort niet in de demo
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && /^(FICHE_DATA\d*|FD)$/.test(n.id.name) && n.init && n.init.type === "ObjectExpression") {
      vervang.push([n.init.start, n.init.end, "{}"])
      return
    }
    // fiches die een latere module aanvult: Object.assign(FD, { "f-...": {...} }) (CSC, modules 6–10)
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.type === "Identifier" && n.callee.object.name === "Object" &&
        n.callee.property.name === "assign" && n.arguments.length > 1 && n.arguments[0].type === "Identifier" && /^(FICHE_DATA\d*|FD)$/.test(n.arguments[0].name)) {
      vervang.push([n.arguments[1].start, n.arguments[n.arguments.length - 1].end, "{}"])
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
    if (!lessen) {
      // module zonder lessen hier: inhoud elders (los script of tweede definitie), of echt in voorbereiding
      if (!metInhoud.has(mid)) {
        if (waarde(prop(n, "avail")) === true) markeer(n, true) // beschikbaar, maar de lessen komen pas later binnen
        return // in voorbereiding, ook in de volledige cursus
      }
      // de gekozen les komt uit een los script: aantal onderdelen van de volledige module meegeven
      if (ctx.externKeuze.has(mid)) vervang.push([n.start + 1, n.start + 1, ` demoVan: ${ctx.externKeuze.get(mid)},`])
      else if (!metKeuze.has(mid)) markeer(n, true)
      return
    }
    const els = lessen.value.elements.filter(Boolean)
    const houd = els.filter((el) => el.type === "ObjectExpression" && ctx.keuze.has(waarde(prop(el, "id"))))
    if (houd.length) {
      // enkel de gekozen les (geen praktijkopdracht of toets)
      for (const el of houd) {
        const soort = waarde(prop(el, "kind")) || "les"
        if (soort !== "les") throw new Error(`${label}: ${waarde(prop(el, "id"))} is geen les maar ${soort}`)
        gehouden.push(waarde(prop(el, "id")))
      }
      vervang.push([lessen.value.start, lessen.value.end, "[" + houd.map((el) => code.slice(el.start, el.end)).join(",\n") + "]"])
      vervang.push([n.start + 1, n.start + 1, ` demoVan: ${els.length},`])
      return
    }
    // alle andere modules: lessen weg, niet beschikbaar, gemarkeerd als demo
    vervang.push([lessen.value.start, lessen.value.end, "[]"])
    markeer(n, false)
  })
  // snoei (per cursus aan te zetten): enkel de animaties van de lessen in de demo blijven, plus "traject" (startpagina).
  // Zo staan de titels en samenvattingen van de animaties van de andere lessen niet in de broncode van de demo.
  let animsWeg = 0
  if (ctx.snoei) {
    const nodig = new Set(["traject"])
    walk.full(ast, (n) => {
      if (n.type !== "ObjectExpression") return
      const id = waarde(prop(n, "id")), anim = waarde(prop(n, "anim"))
      if (typeof id === "string" && typeof anim === "string" && inDemo(id)) nodig.add(anim)
    })
    const isRegister = (x) => x && x.type === "Identifier" && /^(SHARED_)?ANIMS$/.test(x.name)
    const registers = []
    walk.full(ast, (n) => {
      if (n.type === "VariableDeclarator" && isRegister(n.id) && n.init) {
        if (n.init.type === "ObjectExpression") registers.push(n.init)
        else if (n.init.type === "CallExpression") n.init.arguments.filter((a) => a.type === "ObjectExpression").forEach((a) => registers.push(a))
      }
      if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.type === "Identifier" && n.callee.object.name === "Object" &&
          n.callee.property.name === "assign" && isRegister(n.arguments[0]))
        n.arguments.slice(1).filter((a) => a.type === "ObjectExpression").forEach((a) => registers.push(a))
    })
    for (const o of registers) {
      const sleutel = (p) => (p.key.type === "Identifier" ? p.key.name : p.key.value)
      const houd = o.properties.filter((p) => p.type !== "Property" || p.computed || nodig.has(sleutel(p)))
      if (houd.length === o.properties.length) continue
      animsWeg += o.properties.length - houd.length
      vervang.push([o.start, o.end, "{\n" + houd.map((p) => code.slice(p.start, p.end)).join(",\n") + "\n}"])
    }
  }
  return { vervang, modules, gezien, gehouden, animsWeg }
}

// Een los modulescript (m2.js ...) inkorten tot de gekozen les, met enkel de animaties die die les gebruikt.
function korteExtern(code, keuze, label) {
  const ast = ontleed(code)
  const vervang = []
  const gehouden = []
  const gebruikt = new Set()
  let totaal = 0
  walk.full(ast, (n) => {
    if (!(n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.id.name === "lessons" && n.init && n.init.type === "ArrayExpression")) return
    const els = n.init.elements.filter(Boolean)
    totaal = els.length
    const houd = els.filter((el) => el.type === "ObjectExpression" && keuze.has(waarde(prop(el, "id"))))
    for (const el of houd) {
      const soort = waarde(prop(el, "kind")) || "les"
      if (soort !== "les") throw new Error(`${label}: ${waarde(prop(el, "id"))} is geen les maar ${soort}`)
      gehouden.push(waarde(prop(el, "id")))
      walk.full(el, (k) => { if (k.type === "Literal" && typeof k.value === "string") gebruikt.add(k.value) })
    }
    vervang.push([n.init.start, n.init.end, "[" + houd.map((el) => code.slice(el.start, el.end)).join(",\n") + "]"])
  })
  if (!gehouden.length) return { vervang, gehouden, totaal }
  // Object.assign(KL.anims, { ... }): enkel de animaties van de gekozen les
  walk.full(ast, (n) => {
    if (n.type !== "CallExpression" || n.callee.type !== "MemberExpression" || n.arguments.length !== 2) return
    const doel = n.arguments[0], lijst = n.arguments[1]
    if (n.callee.object.name !== "Object" || n.callee.property.name !== "assign" || lijst.type !== "ObjectExpression") return
    if (doel.type !== "MemberExpression" || doel.property.name !== "anims") return
    const houd = lijst.properties.filter((p) => p.type === "Property" && gebruikt.has(p.key.type === "Identifier" ? p.key.name : p.key.value))
    vervang.push([lijst.start, lijst.end, "{\n" + houd.map((p) => code.slice(p.start, p.end)).join(",\n") + "\n}"])
  })
  const uit = pas(code, vervang)
  if (/\bt:\s*"media"/.test(uit)) throw new Error(`${label}: de les heeft beeldvakken; die worden in een los script niet opgeschoond`)
  if (/<\/script/i.test(uit)) throw new Error(`${label}: </script> in het script`)
  return { vervang, gehouden, totaal }
}

// ---------- Cursistenversie: geen opnamebriefings, AI-prompts of mediaplan ----------
// Deze functies worden leeggemaakt (hun teksten verdwijnen zo ook uit de broncode).
const LEEG = { briefHtml: 'return "";', fichePrompt: 'return "";', renderMedia: 'location.replace("#start");' }
const PRODUCTIEZIN = /[^.]*(referentiebeeld|in elk shot|AI-animatie die|opnamedag|draaiboek)[^.]*\.\s*/gi

function zonderProductie(code, label) {
  let ast
  try {
    ast = ontleed(code)
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

// Weergave in de demo: labels voor ingekorte modules
const DEMO_WEERGAVE = [
  // mengselontwerp vult enkele lessen achteraf aan; in de demo bestaan die lessen niet meer
  [
    "const les = id => { for (const m of COURSE) { const l = m.lessons.find(x => x.id === id); if (l) return l; } return null; };",
    "const les = id => { for (const m of COURSE) { const l = m.lessons.find(x => x.id === id); if (l) return l; } return new Proxy({ blocks: [], quiz: [], tasks: [] }, { get: (t, k) => (k in t ? t[k] : []) }); };",
  ],
  // inhoudstafel en modulekaarten: "in de volledige cursus" in plaats van "in voorbereiding" voor ingekorte modules
  ["${m.sub} · in voorbereiding", '${m.sub} · ${m.demo ? "in de volledige cursus" : "in voorbereiding"}'],
  ['<span class="pill">In voorbereiding</span>', '<span class="pill">${m.demo ? "Volledige cursus" : "In voorbereiding"}</span>'],
  // modulekaart met één les uit de module: "1 van 7 onderdelen in de demo"
  [
    '${s.total} ${s.total === 1 ? "onderdeel" : "onderdelen"}',
    '${m.demoVan ? s.total + " van " + m.demoVan + " onderdelen in de demo" : s.total + " " + (s.total === 1 ? "onderdeel" : "onderdelen")}',
  ],
]

// De demo als vervangingen op de cursistenversie. externe: de losse modulescripts { "m2.js": inhoud }.
function maakDemo(html, c, externe = {}) {
  const keuze = new Set(c.demo || [])
  const vervang = []
  const verslag = []
  const gehouden = []
  const extern = new Set()
  const externKeuze = new Map()
  // losse modulescripts: uit het script met een gekozen les gaat enkel die les mee, ingebouwd; de andere vallen weg
  for (const m of html.matchAll(/<script src="(m\d+)\.js"><\/script>\s*/g)) {
    extern.add(m[1])
    const naam = m[1] + ".js"
    const r = externe[naam] === undefined ? null : korteExtern(externe[naam], keuze, `${c.code} ${naam}`)
    if (r && r.gehouden.length) {
      externKeuze.set(m[1], r.totaal)
      gehouden.push(...r.gehouden)
      const voor = "<script>\n", na = "\n</script>\n"
      vervang.push([m.index, m.index + m[0].length, { bron: naam, vervang: r.vervang, voor, na, tekst: voor + pas(externe[naam], r.vervang) + na }])
      verslag.push(`${naam}: ${r.gehouden.join(",")} ingebouwd`)
    } else vervang.push([m.index, m.index + m[0].length, ""])
  }
  for (const m of html.matchAll(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g)) {
    const inhoud = m[2]
    if (inhoud.length < 2000 || !/lessons/.test(inhoud)) continue
    const begin = m.index + m[1].length
    const r = korteScript(inhoud, c.code, { keuze, extern, externKeuze, snoei: !!c.snoei })
    if (r.fout) verslag.push(r.fout)
    if (r.modules) verslag.push(`${r.modules} modules (${r.gezien.join(",")})`)
    if (r.animsWeg) verslag.push(`${r.animsWeg} animaties van andere lessen weggelaten`)
    gehouden.push(...r.gehouden)
    for (const [a, b, t] of r.vervang) vervang.push([begin + a, begin + b, t])
  }
  for (const [oud, nieuw] of DEMO_WEERGAVE) {
    const i = html.indexOf(oud)
    if (i >= 0) vervang.push([i, i + oud.length, nieuw])
  }
  // elke gekozen les precies één keer, elk uit een ander hoofdstuk
  const ontbreekt = [...keuze].filter((id) => !gehouden.includes(id))
  if (ontbreekt.length) throw new Error(`${c.code}: demoles niet gevonden: ${ontbreekt.join(", ")}`)
  if (gehouden.length !== keuze.size) throw new Error(`${c.code}: demoles meer dan eens gevonden: ${gehouden.join(", ")}`)
  const hoofdstukken = [...keuze].map((id) => id.replace(/-[^-]+$/, ""))
  if (new Set(hoofdstukken).size !== hoofdstukken.length) throw new Error(`${c.code}: twee demolessen uit hetzelfde hoofdstuk`)
  verslag.push(`demo: start + ${[...keuze].join(", ")}`)
  return { html: pas(html, vervang), verslag, vervang }
}

const uit = process.argv[2]
fs.mkdirSync(uit, { recursive: true })
const enkel = process.env.ENKEL ? process.env.ENKEL.split(",") : null
const gekozen = CURSUSSEN.filter((c) => !enkel || enkel.includes(c.code))
const overzicht = []
for (const c of gekozen) {
  // twee haken: de lessenlijst naar de academy (metHaak) en het filter voor afgeleide cursussen (metFilter, haken.mjs)
  const bronHtml = metFilter(metHaak(fs.readFileSync(path.join(T, c.bron), "utf8"), c), c.code)
  const map = path.join(uit, c.code)
  fs.mkdirSync(map, { recursive: true })
  fs.writeFileSync(path.join(map, "beheer.html"), injecteer(bronHtml, c, { beheer: true }))
  const cv = cursistVersie(bronHtml, c)
  fs.writeFileSync(path.join(map, "index.html"), injecteer(cv.html, c))
  const extra = c.extra ? fs.readdirSync(c.extra).filter((f) => /^m\d+\.js$/.test(f)) : []
  const externe = {}
  for (const f of extra) {
    fs.copyFileSync(path.join(c.extra, f), path.join(map, f))
    externe[f] = fs.readFileSync(path.join(c.extra, f), "utf8")
  }
  let demo = null
  if (!c.geenDemo) {
    const d = maakDemo(cv.html, c, externe)
    fs.writeFileSync(path.join(map, "demo.html"), injecteer(d.html, c, { demo: true }))
    demo = { grootte: d.html.length, verslag: d.verslag }
  }
  overzicht.push({ code: c.code, volledig: bronHtml.length, cursist: cv.verslag, extra, demo })
}
fs.writeFileSync(path.join(uit, "cursussen.json"), JSON.stringify(gekozen, null, 1))
console.log(JSON.stringify(overzicht, null, 1))
