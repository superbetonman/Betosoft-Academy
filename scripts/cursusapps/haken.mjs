// Haken in een cursusapp, gedeeld door bouw.mjs en haak-filter.mjs.
//
// Filterhaak: direct na de declaratie `const COURSE = [...]` roept de app window.ACADEMIE_FILTER(COURSE, META) op
// (gedefinieerd in public/cursus-academie.js). Een afgeleide cursus (bv. BMC uit de bron BMC-BPB) laat zo de
// modules van het andere traject weg en zet haar eigen titel, vóór de app iets toont. Zonder ACADEMIE.modules
// verandert er niets. De haak staat na de declaratie (niet ervoor), want COURSE bestaat pas dan.
import * as acorn from "acorn"
import * as walk from "acorn-walk"

export const FILTERHAAK =
  '\ntry { if (typeof window.ACADEMIE_FILTER === "function") window.ACADEMIE_FILTER(COURSE, (function () { try { return META; } catch (e) { return null; } })()); } catch (e) {}'

/** Zet de filterhaak in de html. Geeft de html ongewijzigd terug als er geen COURSE is of de haak er al staat. */
export function metFilter(html, label = "") {
  if (html.includes("window.ACADEMIE_FILTER(")) return html
  const pc = html.indexOf("const COURSE")
  if (pc < 0) return html
  const begin = html.lastIndexOf("<script", pc)
  const open = html.indexOf(">", begin) + 1
  const einde = html.indexOf("</script>", pc)
  if (begin < 0 || einde < 0) throw new Error(`${label}: script rond COURSE niet gevonden`)
  const code = html.slice(open, einde)
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true })
  let decl = null
  walk.full(ast, (n) => {
    if (!decl && n.type === "VariableDeclaration" && n.declarations.some((d) => d.id.type === "Identifier" && d.id.name === "COURSE")) decl = n
  })
  if (!decl) throw new Error(`${label}: declaratie van COURSE niet gevonden`)
  const na = open + decl.end
  return html.slice(0, na) + FILTERHAAK + html.slice(na)
}

// Knoppenhaak: onderaan elke les drie even grote knoppen (vorige, voltooid, volgende), de titel van de vorige of volgende
// les eronder; een juist antwoord op de controlevraag zet de les op voltooid. De artifacts hebben nog de oude opmaak.
// Geeft de html ongewijzigd terug als de knoppen er al zo staan of de app deze voet niet heeft.
const KNOP_CSS_OUD = [
  ".nav-next { display: flex; flex-direction: column; text-align: right; }",
  ".nav-next { text-align: right; }\n.nav-next small, .nav-prev small { display: block; margin-top: 2px; }",
]
const KNOP_CSS = [
  '.l-foot { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: "prev done next"; gap: 12px; align-items: start; }',
  ".l-foot .grow { display: none; }",
  ".nav-cel { display: flex; flex-direction: column; gap: 6px; min-width: 0; }",
  ".c-prev { grid-area: prev; } .c-done { grid-area: done; } .c-next { grid-area: next; }",
  ".nav-cel > .btn { width: 100%; min-height: 46px; justify-content: center; text-align: center; box-sizing: border-box; }",
  ".nav-sub { font: 400 12px/1.35 var(--ui); color: var(--muted); }",
  ".c-prev .nav-sub { text-align: left; } .c-next .nav-sub { text-align: right; }",
  '@media (max-width: 600px) { .l-foot { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "done done" "prev next"; } }',
].join("\n")
const CHECK = "const k = +b.dataset.k; const right = k === l.check.a;"
export function metKnoppen(html) {
  if (html.includes('class="nav-cel') || !html.includes("nav-next")) return html
  let h = html
  for (const oud of KNOP_CSS_OUD) h = h.replace(oud, KNOP_CSS)
  h = h
    .replace(/<a class="btn nav-prev" href="#\$\{prev\.id\}">\$\{I\.prev\}<span>([^<]+)<small(?: style="display:block")?>\$\{prev\.code\} \$\{prev\.title\}<\/small><\/span><\/a>/,
      '<div class="nav-cel c-prev"><a class="btn nav-prev" href="#${prev.id}">${I.prev}<span>$1</span></a><small class="nav-sub">${prev.code} ${prev.title}</small></div>')
    .replace(/<a class="btn nav-next" href="#\$\{next\.id\}"><span>([^<]+)<small(?: style="display:block")?>\$\{next\.code\} \$\{next\.title\}<\/small><\/span>\$\{I\.next\}<\/a>/,
      '<div class="nav-cel c-next"><a class="btn nav-next" href="#${next.id}"><span>$1</span>${I.next}</a><small class="nav-sub">${next.code} ${next.title}</small></div>')
    .replace(/`<a class="btn" href="#start">\$\{I\.prev\}([^<`]+)<\/a>`/, '`<div class="nav-cel c-prev"><a class="btn nav-prev" href="#start">${I.prev}$1</a></div>`')
    .replace(/`<a class="btn" href="#start">([^<`$]+)\$\{I\.next\}<\/a>`/, '`<div class="nav-cel c-next"><a class="btn nav-next" href="#start">$1${I.next}</a></div>`')
    .replace('<button class="btn" id="doneBtn" type="button"></button>', '<div class="nav-cel c-done"><button class="btn" id="doneBtn" type="button"></button></div>')
    .replace(CHECK, CHECK + "\n      if (right && !isDone(l)) { P.done[l.id] = Date.now(); persist(); syncDoneBtn(l); renderToc(l.id); renderTop(); }")
  return h
}
