// Weergave van een attest (A4 liggend). Gebruikt door netlify/functions/attest.mts.
export const esc = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
export const datum = (v: unknown) => {
  if (!v) return "—"
  const d = new Date(String(v))
  return new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric" }).format(d).replace(/\//g, ".")
}
const langeDatum = (v: unknown) =>
  v ? new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", day: "numeric", month: "long", year: "numeric" }).format(new Date(String(v))) : "—"

export type Attest = {
  id: string
  nummer: string
  gebruiker_id: string
  organisatie_id: string | null
  email: string
  voornaam: string | null
  naam: string
  cursus: string
  cursus_titel: string
  score: number | null
  modules: { n: string; titel: string; status?: string }[]
  lessen: number | null
  toetsen: number | null
  gestart_op: string | null
  afgerond_op: string | null
  uitgereikt_op: string
  ingetrokken_op: string | null
  gemaild_op: string | null
  bedrijf: string | null
}

export function pagina(a: Attest, opties: { url: string; magMailen: boolean; voorbeeld?: boolean; terug: string }) {
  const geldig = !a.ingetrokken_op
  const mods = a.modules.filter((m) => m && m.titel)
  const resultaat = [
    a.lessen ? `<div><dt>Lessen</dt><dd>${a.lessen}</dd></div>` : "",
    a.toetsen ? `<div><dt>Toetsen geslaagd</dt><dd>${a.toetsen}</dd></div>` : "",
    a.score !== null && a.score !== undefined ? `<div><dt>Gemiddelde toetsscore</dt><dd>${Math.round(a.score)}&#8239;%</dd></div>` : "",
    a.gestart_op ? `<div><dt>Periode</dt><dd>${datum(a.gestart_op)} – ${datum(a.afgerond_op || a.uitgereikt_op)}</dd></div>` : "",
  ].join("")
  const titel = `Attest ${a.nummer} · ${a.naam}`
  return `<!doctype html><html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(titel)} · Betosoft Academie</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,500;1,400&display=swap" rel="stylesheet">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="/thema.js"></script><link rel="stylesheet" href="/stijl.css">
<style>
  .werkbalk { max-width: 1120px; margin: 0 auto; padding: 16px; display: flex; gap: 10px 16px; flex-wrap: wrap; align-items: center; }
  .werkbalk .groei { flex: 1 1 260px; }
  .werkbalk a.knop { text-decoration: none; display: inline-flex; align-items: center; }
  .geldig { font-weight: 600; } .geldig.ja { color: var(--conform); } .geldig.nee { color: var(--afwijking); }
  .papier { padding: 0 16px 40px; overflow-x: auto; }
  .blad {
    --i: #223840; --p: #1E5A66; --k: #B25C31; --l: #DCD4C7; --z: #5a6b70;
    width: 297mm; min-height: 210mm; margin: 0 auto; background: #fff; color: var(--i); position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08); font-family: "IBM Plex Sans", Arial, sans-serif;
    display: grid; grid-template-rows: auto 1fr auto; padding: 16mm 18mm 12mm; box-sizing: border-box; overflow: hidden;
  }
  .blad::before { content: ""; position: absolute; inset: 7mm; border: 1px solid var(--l); pointer-events: none; }
  .blad::after { content: ""; position: absolute; left: 7mm; top: 7mm; bottom: 7mm; width: 3mm; background: var(--p); }
  .bkop { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; padding-left: 6mm; }
  .bmerk { display: flex; align-items: center; gap: 4mm; }
  .bmerk .vak { background: #223840; border-radius: 2mm; padding: 2.5mm 3mm; display: grid; place-items: center; }
  .bmerk img { width: 12mm; height: 10.6mm; display: block; }
  .bmerk b { font-size: 6mm; letter-spacing: -.01em; } .bmerk b em { font-style: normal; color: var(--k); }
  .bmerk small { display: block; font-size: 3.2mm; color: var(--z); margin-top: .8mm; }
  .bnr { text-align: right; font: 500 3.4mm "IBM Plex Mono", monospace; color: var(--z); line-height: 1.6; }
  .bnr strong { color: var(--i); font-weight: 500; }
  .bkern { padding: 12mm 6mm 0 6mm; }
  .blabel { font-size: 3.4mm; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--p); }
  .bnaam { font: 500 13mm/1.1 "IBM Plex Serif", Georgia, serif; margin: 5mm 0 4mm; }
  .bzin { font-size: 4.6mm; color: var(--z); margin: 0; }
  .bcursus { font: 700 8mm/1.2 "IBM Plex Sans", Arial, sans-serif; color: var(--p); margin: 2.5mm 0 2.5mm; }
  .bres { display: flex; gap: 0; margin: 8mm 0 0; border-top: 1px solid var(--l); border-bottom: 1px solid var(--l); }
  .bres div { padding: 3mm 7mm 3mm 0; margin-right: 7mm; border-right: 1px solid var(--l); }
  .bres div:last-child { border-right: 0; }
  .bres dt { font-size: 2.8mm; text-transform: uppercase; letter-spacing: .1em; color: var(--z); font-weight: 600; }
  .bres dd { margin: .8mm 0 0; font: 500 5mm "IBM Plex Mono", monospace; }
  .bmods { margin: 6mm 0 0; padding: 0; list-style: none; columns: 3; column-gap: 8mm; font-size: 3.1mm; line-height: 1.45; color: var(--i); }
  .bmods li { break-inside: avoid; display: flex; gap: 2mm; } .bmods .n { font-family: "IBM Plex Mono", monospace; color: var(--p); min-width: 7mm; }
  .bmods li.nog { color: var(--z); }
  .bvoet { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; padding: 8mm 0 0 6mm; font-size: 3mm; color: var(--z); }
  .bvoet .hand { border-top: 1px solid var(--i); padding-top: 2mm; min-width: 62mm; color: var(--i); font-size: 3.4mm; }
  .bvoet .hand small { display: block; color: var(--z); font-size: 2.8mm; }
  .bvoet .contr { text-align: right; max-width: 175mm; }
  .bvoet .contr code { font: 400 2.7mm "IBM Plex Mono", monospace; color: var(--i); white-space: nowrap; }
  .bvoet .disc { margin-top: 2mm; font-size: 2.6mm; }
  .stempel { position: absolute; right: 24mm; top: 44mm; transform: rotate(-12deg); font: 700 14mm "IBM Plex Sans", sans-serif; letter-spacing: .1em;
    color: rgba(142,50,43,.22); border: 1.2mm solid rgba(142,50,43,.22); padding: 2mm 6mm; border-radius: 3mm; pointer-events: none; }
  .mailvak { max-width: 1120px; margin: 0 auto 12px; padding: 0 16px; }
  .mailvak form { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
  .mailvak label { flex: 1 1 260px; margin: 0; }
  @page { size: A4 landscape; margin: 0; }
  @media print {
    body { background: #fff !important; }
    .kop, .werkbalk, .mailvak, .voet, .toast, [data-foutknop], #foutknop { display: none !important; }
    .papier { padding: 0; overflow: visible; }
    .blad { box-shadow: none; margin: 0; width: 297mm; height: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
<header class="kop"><div class="kop-in"><a class="logo" href="/" aria-label="Betosoft Academie, startpagina"><img src="/logo.svg" alt="" width="34" height="30"><span class="logo-tekst">Betosoft <em>Academie</em></span><span class="kop-context">· attest</span></a>
<div class="rechts"><a class="kop-link" href="${esc(opties.terug)}">${opties.terug === "/leren/" ? "Mijn leerlijn" : "Terug"}</a></div></div></header>
<div class="werkbalk">
  <div class="groei">${opties.voorbeeld ? `<strong>Voorbeeld.</strong> Zo ziet het attest van deze cursus eruit.` : geldig ? `<span class="geldig ja">● Geldig attest</span> <span class="zacht klein">uitgereikt op ${datum(a.uitgereikt_op)} door de Betosoft Academie</span>` : `<span class="geldig nee">■ Ingetrokken</span> <span class="zacht klein">op ${datum(a.ingetrokken_op)}. Dit attest is niet meer geldig.</span>`}</div>
  ${geldig || opties.voorbeeld ? `<button class="knop" type="button" id="afdrukken">Afdrukken of bewaren als PDF</button>` : ""}
  ${opties.magMailen && geldig && !opties.voorbeeld ? `<button class="knop licht" type="button" id="mailen">Mailen</button>` : ""}
</div>
${opties.magMailen && geldig && !opties.voorbeeld ? `<div class="mailvak verborgen" id="mailvak"><div class="paneel"><form id="mailform">
  <label class="veld"><span class="label">Naar welk e-mailadres?</span><input type="email" name="naar" required value="${esc(a.email)}" autocomplete="email"></label>
  <button class="knop" type="submit">Versturen</button><button class="knop stil" type="button" id="mailannuleer">Annuleren</button>
</form><p class="klein zacht" style="margin:8px 0 0">De mail bevat de link naar dit attest. De ontvanger kan het openen, afdrukken en de geldigheid controleren.</p></div></div>` : ""}
<div class="papier"><article class="blad" aria-label="${esc(titel)}">
  ${!geldig ? `<div class="stempel">INGETROKKEN</div>` : opties.voorbeeld ? `<div class="stempel">VOORBEELD</div>` : ""}
  <div class="bkop">
    <div class="bmerk"><span class="vak"><img src="/logo.svg" alt=""></span><div><b>Betosoft <em>Academie</em></b><small>Opleidingen voor de betonsector</small></div></div>
    <div class="bnr">Attest <strong>${esc(a.nummer)}</strong><br>Uitgereikt <strong>${datum(a.uitgereikt_op)}</strong></div>
  </div>
  <div class="bkern">
    <div class="blabel">Attest van deelname en slagen</div>
    <div class="bnaam">${esc(a.naam)}</div>
    <p class="bzin">${a.bedrijf ? `${esc(a.bedrijf)} · ` : ""}heeft de opleiding</p>
    <div class="bcursus">${esc(a.cursus_titel)}</div>
    <p class="bzin">met succes afgerond op ${esc(langeDatum(a.afgerond_op || a.uitgereikt_op))}: alle lessen doorlopen en alle toetsen geslaagd.</p>
    ${resultaat ? `<dl class="bres">${resultaat}</dl>` : ""}
    ${mods.length ? `<ul class="bmods">${mods.map((m) => `<li${m.status && m.status !== "af" ? ' class="nog"' : ""}><span class="n">${esc(m.n)}</span><span>${esc(m.titel)}</span></li>`).join("")}</ul>` : ""}
  </div>
  <div class="bvoet">
    <div class="hand">Betosoft Academie<small>betosoft.be</small></div>
    <div class="contr">Controleer dit attest: <code>${esc(opties.url)}</code>
      <div class="disc">De cursussen zijn met de grootste zorg samengesteld. Raadpleeg in geval van twijfel altijd de normatieve documenten en reglementen; die blijven de referentie.</div></div>
  </div>
</article></div>
<footer class="voet"><p>Betosoft Academie · <a href="/">startpagina</a> · <a href="https://betosoft.be">betosoft.be</a></p></footer>
<script type="module">
  const $ = (s) => document.querySelector(s)
  $("#afdrukken")?.addEventListener("click", () => window.print())
  const vak = $("#mailvak")
  $("#mailen")?.addEventListener("click", () => { vak.classList.remove("verborgen"); vak.querySelector("input").focus() })
  $("#mailannuleer")?.addEventListener("click", () => vak.classList.add("verborgen"))
  const mailHash = () => { if (location.hash === "#mail" && vak) { vak.classList.remove("verborgen"); vak.querySelector("input").focus() } }
  mailHash()
  window.addEventListener("hashchange", mailHash)
  function toast(t, f) {
    let el = document.querySelector(".toast")
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el) }
    el.textContent = t; el.classList.toggle("fout", !!f); el.classList.remove("verborgen")
    clearTimeout(window.__t); window.__t = setTimeout(() => el.classList.add("verborgen"), f ? 6000 : 3500)
  }
  $("#mailform")?.addEventListener("submit", async (e) => {
    e.preventDefault()
    const knop = e.submitter; if (knop) knop.disabled = true
    const naar = new FormData(e.target).get("naar")
    try {
      const r = await fetch(${JSON.stringify(`/api/attest/${a.id}/mail`)}, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-academie": "1" }, body: JSON.stringify({ naar }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.fout || "Versturen mislukt.")
      if (d.verstuurd) { toast("Verstuurd naar " + naar); vak.classList.add("verborgen") }
      else if (d.mailto) { location.href = d.mailto; toast("Je mailprogramma opent met het bericht klaar.") }
    } catch (err) { toast(err.message, true) } finally { if (knop) knop.disabled = false }
  })
</script>
<script src="/fout.js" type="module"></script>
</body></html>`
}

