// Startpagina: cursusoverzicht (uit /cursussen.js), prijzen en voorwaarden (uit de databank via /prijs.js).
// Welke cursussen verschijnen en of je kunt inschrijven, komt uit de databank (Beheer → Cursussen): tot die geladen is,
// staat er geen enkele cursus, zodat een cursus die niet getoond mag worden ook niet even opduikt.
import { esc, getal } from "/gemeen.js"
import { laadProducten, productenVan, tegelPrijs, prijsTekst, voorwaardenItems, isPakket } from "/prijs.js"
import { CURSUSSEN, GROEPEN } from "/cursussen.js"

const $ = (s) => document.querySelector(s)
let AANBOD = null // Map code → "voorbereiding" | "inschrijven", uit de databank
const zichtbaar = () => (AANBOD ? CURSUSSEN.filter((c) => AANBOD.has(c.code)) : [])
const som = (lijst, veld) => lijst.reduce((t, c) => t + (Number(c[veld]) || 0), 0)
const uren = (min) => Math.round(min / 60)

// ---------- Aangemeld? Dan gaat de knop naar de eigen omgeving ----------
async function sessie() {
  try {
    const res = await fetch("/api/sessie", { credentials: "same-origin" })
    const s = await res.json()
    if (!s.aangemeld) return
    const knop = $("#aanmeldknop")
    const rol = s.gebruiker?.rol
    knop.textContent = rol === "superadmin" || rol === "beheerder" ? "Naar beheer" : rol === "centrale_verantwoordelijke" ? "Naar mijn onderneming" : "Mijn leerlijn"
    knop.href = s.bestemming || "/leren/"
    const extra = rol === "cursist" ? [["/scores/", "Scores"]] : [["/leren/", "Mijn leerlijn"], ["/scores/", "Scores"]]
    knop.insertAdjacentHTML("beforebegin", extra.map(([h, t]) => `<a class="kop-link" href="${h}">${t}</a>`).join(""))
  } catch {}
}

// ---------- Kerncijfers in de band ----------
function kerncijfers(toegangMaanden) {
  const lijst = zichtbaar()
  const n = (v) => (AANBOD ? getal(v) : "–")
  // BMC en BPB delen de basis (zelfde bron): die telt maar één keer
  const perBron = {}
  for (const c of lijst) if (c.bron && c.gedeeld) perBron[c.bron] = [...(perBron[c.bron] || []), c]
  const dubbel = (veld) => Object.values(perBron).reduce((t, l) => t + (l.length - 1) * (Number(l[0].gedeeld[veld]) || 0), 0)
  const cijfers = [
    ["Cursussen", n(lijst.length)],
    ["Modules klaar", n(som(lijst, "modules_klaar") - dubbel("modules"))],
    ["Lessen", n(som(lijst, "lessen") - dubbel("lessen"))],
    ["Toegang", `${getal(toegangMaanden)}<small>maanden</small>`],
  ]
  $("#kerncijfers").innerHTML = cijfers.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")
}

// ---------- Cursussen ----------
let filterGroep = "alle"

function filterknoppen() {
  const gebruikt = GROEPEN.filter((g) => zichtbaar().some((c) => c.groep === g.id))
  if (!gebruikt.some((g) => g.id === filterGroep)) filterGroep = "alle"
  const knoppen = [{ id: "alle", naam: "Alle functies" }, ...gebruikt]
  $("#filter").innerHTML = knoppen
    .map((g) => `<button type="button" data-groep="${g.id}" aria-pressed="${g.id === filterGroep}">${esc(g.naam)}</button>`)
    .join("")
  $("#filter").onclick = (e) => {
    const b = e.target.closest("button[data-groep]")
    if (!b) return
    filterGroep = b.dataset.groep
    filterknoppen()
    cursussen()
  }
}

const STATUS = {
  open: `<span class="status s-conform">inschrijven mogelijk</span>`,
  deels: `<span class="status s-aandacht">eerste modules online · inschrijven mogelijk</span>`,
  binnenkort: `<span class="status s-indicatief">inhoud klaar · opent binnenkort</span>`,
  voorbereiding: `<span class="status s-concept">in voorbereiding</span>`,
}
const VOLGORDE = { open: 0, deels: 1, binnenkort: 2, voorbereiding: 3 }
const kanInschrijven = (st) => st === "open" || st === "deels"
let PRODUCTEN = []

// Voorbereiding = zo gekozen in Beheer → Cursussen: met de demo, zonder prijs en zonder inschrijven.
// Open = inschrijven mogelijk en er is een product te koop. Deels = idem, maar een deel van de modules is nog in opbouw.
// Binnenkort = inschrijven mogelijk, maar er is (nog) geen actief product.
function status(c) {
  if (AANBOD?.get(c.code) !== "inschrijven") return "voorbereiding"
  if (productenVan(PRODUCTEN, c.code).length) return c.modules?.some((m) => m.klaar === false) ? "deels" : "open"
  return "binnenkort"
}

function modulelijst(c) {
  let niveau = null
  return c.modules
    .map((m) => {
      let kop = ""
      if (m.niveau && m.niveau !== niveau) {
        niveau = m.niveau
        kop = `<li class="niv">${esc(niveau)}</li>`
      }
      const nog = m.klaar === false ? `<span class="status s-concept">in voorbereiding</span>` : ""
      return `${kop}<li${m.klaar === false ? ' class="nog"' : ""}><span class="mono">${esc(m.code)}</span><span>${esc(m.titel)}</span>${nog}</li>`
    })
    .join("")
}

function kaart(c) {
  const st = status(c)
  const cijfers = [
    [c.modules_klaar < c.modules_aantal ? `${c.modules_klaar}/${c.modules_aantal}` : c.modules_aantal, c.modules_klaar < c.modules_aantal ? "modules klaar" : "modules"],
    [c.lessen ?? "—", "lessen"],
    [c.toetsen, "toetsen"],
    [c.studieminuten ? `±${uren(c.studieminuten)}` : "—", "uur"],
  ]
  const tp = kanInschrijven(st) ? tegelPrijs(PRODUCTEN, c.code) : null
  const knoppen = [
    kanInschrijven(st) && tp ? `<a class="knop" href="/aanvragen/?product=${encodeURIComponent(tp.product.code)}">Inschrijven</a>` : "",
    c.demo ? `<a class="knop licht" href="/demo/${encodeURIComponent(c.code)}/">Bekijk de demo</a>` : "",
  ].join("")
  return `<article class="cursus${kanInschrijven(st) ? " uitgelicht" : ""}" data-groep="${esc(c.groep)}">
    <div class="ckop"><span class="tag">${esc(c.code)}</span>${STATUS[st] || ""}</div>
    <h3>${esc(c.titel)}</h3>
    <p class="voor">${esc(c.doelgroep)}</p>
    <p class="oms">${esc(c.omschrijving)}</p>
    ${c.opmerking ? `<p class="opm">${esc(c.opmerking)}</p>` : ""}
    <div class="cijferrij">${cijfers.map(([v, l]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join("")}</div>
    ${c.modules?.length ? `<details><summary>Bekijk de modules</summary><ol class="modlijst">${modulelijst(c)}</ol></details>` : ""}
    <div class="tegelprijs">${tp ? `${tp.tekst}${tp.prijs ? ` <span class="zacht">excl. btw</span>` : ""}` : `<span class="zacht">${kanInschrijven(st) ? "" : "Prijs bij de opening"}</span>`}</div>
    <div class="cvoet">${knoppen || `<span class="zacht">Inschrijven kan bij de opening.</span>`}</div>
  </article>`
}

function cursussen() {
  if (!AANBOD) return ($("#cursusrooster").innerHTML = `<p class="zacht">De cursussen worden geladen…</p>`)
  const lijst = zichtbaar()
    .filter((c) => filterGroep === "alle" || c.groep === filterGroep)
    .sort((a, b) => (VOLGORDE[status(a)] ?? 9) - (VOLGORDE[status(b)] ?? 9))
  $("#cursusrooster").innerHTML = lijst.length ? lijst.map(kaart).join("") : `<p class="zacht">Binnenkort verschijnen hier de cursussen.</p>`
}

// ---------- Prijzen in het kort (de volledige lijst staat op /prijzen/) ----------
function prijsoverzicht(producten, regels) {
  const btw = regels.btw_pct ?? 21
  const rij = (titel, code, lijst) => {
    const vol = lijst.find((p) => p.code.startsWith("CRS-")) || lijst[0]
    const delen = lijst.filter((p) => p !== vol && p.type !== "module" && !isPakket(p))
    const pakket = lijst.some((p) => p !== vol && isPakket(p))
    const mods = lijst.filter((p) => p.type === "module")
    const deel = delen.length ? `${delen.length} ${delen.length === 1 ? "traject" : "trajecten of niveaus"}` : ""
    const los = mods.length ? `${mods.length} losse modules` : ""
    return `<tr><td><strong>${esc(titel)}</strong><span class="zacht">${[deel, pakket ? "ook in een pakket" : "", los].filter(Boolean).join(" · ") || "volledige cursus"}</span></td>
      <td class="num">${prijsTekst(vol)}</td>
      <td class="num"><a href="/prijzen/#${encodeURIComponent(code)}">Details</a></td></tr>`
  }
  const abo = producten.filter((p) => p.type === "abonnement")
  // enkel cursussen waarvoor je kunt inschrijven: een gedeelde basismodule maakt een cursus in voorbereiding niet te koop
  const perCursus = zichtbaar()
    .filter((c) => AANBOD.get(c.code) === "inschrijven")
    .map((c) => [c, productenVan(producten, c.code)])
    .filter(([, l]) => l.length)
  $("#prijsinleiding").innerHTML = `Alle prijzen zijn exclusief <span class="mono">${getal(btw)}&#8239;%</span> btw en gelden per persoon; een onderneming betaalt per plaats. Voor de cursussen in voorbereiding volgt de prijs bij de opening.`
  $("#prijstabellen").innerHTML = `<div class="scroll-x"><table class="prijzen">
    <colgroup><col class="c-product"><col class="c-toegang"><col class="c-prijs"></colgroup>
    <thead><tr><th>Cursus</th><th class="num">Volledige cursus</th><th class="num"></th></tr></thead>
    <tbody>${perCursus.map(([c, l]) => rij(c.titel, c.code, l)).join("")}
    ${abo.map((p) => `<tr><td><strong>${esc(p.naam)}</strong><span class="zacht">alle cursussen</span></td><td class="num">${prijsTekst(p)}</td><td class="num"><a href="/prijzen/#abonnement">Details</a></td></tr>`).join("")}
    </tbody></table></div>
    <div class="knoppen" style="margin-top:14px"><a class="knop" href="/prijzen/">Alle prijzen en trajecten</a></div>`
}

async function laad() {
  try {
    const { producten, regels, aanbod } = await laadProducten()
    PRODUCTEN = producten
    AANBOD = aanbod
    const v = voorwaardenItems(producten, regels)
    $("#voorwaardenlijst").innerHTML = v.items.map(([k, t]) => `<div><dt>${k}</dt><dd>${t}</dd></div>`).join("")
    kerncijfers(v.toegangMnd)
    prijsoverzicht(producten, regels)
    filterknoppen()
    cursussen()
  } catch (e) {
    $("#prijstabellen").innerHTML = `<p class="melding fout">${esc(e.message)}</p>`
    $("#cursusrooster").innerHTML = `<p class="melding fout">De cursussen konden niet geladen worden. Probeer het later opnieuw.</p>`
  }
}

kerncijfers(3)
filterknoppen()
cursussen()
laad()
sessie()
