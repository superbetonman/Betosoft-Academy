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
