// Startpagina: cursusoverzicht (uit /cursussen.js), prijzen en voorwaarden (uit de databank via /api/producten).
import { esc, euro, getal } from "/gemeen.js"
import { CURSUSSEN, GROEPEN } from "/cursussen.js"

const $ = (s) => document.querySelector(s)
const som = (veld) => CURSUSSEN.reduce((t, c) => t + (Number(c[veld]) || 0), 0)
const uren = (min) => Math.round(min / 60)

// ---------- Aangemeld? Dan gaat de knop naar de eigen omgeving ----------
async function sessie() {
  try {
    const res = await fetch("/api/sessie", { credentials: "same-origin" })
    const s = await res.json()
    if (!s.aangemeld) return
    const knop = $("#aanmeldknop")
    const rol = s.gebruiker?.rol
    knop.textContent = rol === "superadmin" || rol === "beheerder" ? "Naar beheer" : rol === "centrale_verantwoordelijke" ? "Naar mijn centrale" : "Mijn opleidingen"
    knop.href = s.bestemming || "/leren/"
  } catch {}
}

// ---------- Kerncijfers in de band ----------
function kerncijfers(toegangMaanden) {
  const cijfers = [
    ["Cursussen", getal(CURSUSSEN.length)],
    ["Modules klaar", getal(som("modules_klaar"))],
    ["Lessen", getal(som("lessen"))],
    ["Toegang", `${getal(toegangMaanden)}<small>maanden</small>`],
  ]
  $("#kerncijfers").innerHTML = cijfers.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")
}

// ---------- Cursussen ----------
let filterGroep = "alle"

function filterknoppen() {
  const gebruikt = GROEPEN.filter((g) => CURSUSSEN.some((c) => c.groep === g.id))
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
  binnenkort: `<span class="status s-indicatief">inhoud klaar · opent binnenkort</span>`,
  voorbereiding: `<span class="status s-concept">in opbouw</span>`,
}
const VOLGORDE = { open: 0, binnenkort: 1, voorbereiding: 2 }

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
  const cijfers = [
    [c.modules_klaar < c.modules_aantal ? `${c.modules_klaar}/${c.modules_aantal}` : c.modules_aantal, c.modules_klaar < c.modules_aantal ? "modules klaar" : "modules"],
    [c.lessen ?? "—", "lessen"],
    [c.toetsen, "toetsen"],
    [c.studieminuten ? `±${uren(c.studieminuten)}` : "—", "uur"],
  ]
  const actie =
    c.status === "open"
      ? `<a class="knop" href="/aanvragen/?product=${encodeURIComponent(c.product)}">Inschrijven</a>`
      : `<span class="zacht">Inschrijven kan bij de opening.</span>`
  return `<article class="cursus${c.status === "open" ? " uitgelicht" : ""}" data-groep="${esc(c.groep)}">
    <div class="ckop"><span class="tag">${esc(c.code)}</span>${STATUS[c.status] || ""}</div>
    <h3>${esc(c.titel)}</h3>
    <p class="voor">${esc(c.doelgroep)}</p>
    <p class="oms">${esc(c.omschrijving)}</p>
    ${c.opmerking ? `<p class="opm">${esc(c.opmerking)}</p>` : ""}
    <div class="cijferrij">${cijfers.map(([v, l]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join("")}</div>
    ${c.normen?.length ? `<div class="normen">${c.normen.map((n) => `<span class="tag">${esc(n)}</span>`).join("")}</div>` : ""}
    ${c.modules?.length ? `<details><summary>Bekijk de modules</summary><ol class="modlijst">${modulelijst(c)}</ol></details>` : ""}
    <div class="cvoet">${actie}</div>
  </article>`
}

function cursussen() {
  const lijst = CURSUSSEN.filter((c) => filterGroep === "alle" || c.groep === filterGroep).sort(
    (a, b) => (VOLGORDE[a.status] ?? 9) - (VOLGORDE[b.status] ?? 9),
  )
  $("#cursusrooster").innerHTML = lijst.map(kaart).join("")
}

// ---------- Prijzen en voorwaarden ----------
const PRIJSGROEPEN = [
  ["abonnement", "Abonnement", "toegang tot alle cursussen"],
  ["traject", "Volledige cursus of traject", "alle modules van een functie"],
  ["module", "Losse modules", "één module naar keuze"],
]

function toegang(p) {
  if (p.periode === "maand") return "per maand, loopt zolang je betaalt"
  if (p.geldigheid_maanden) return `${getal(p.geldigheid_maanden)} maanden vanaf activatie`
  return "—"
}

function prijs(p) {
  if (p.prijs_excl_btw === null || p.prijs_excl_btw === undefined) return `<span class="opaanvraag">op aanvraag</span>`
  return `${euro(p.prijs_excl_btw)}${p.periode === "maand" ? " / maand" : ""}`
}

function prijstabel(rijen) {
  return `<div class="scroll-x"><table class="prijzen">
    <colgroup><col class="c-product"><col class="c-toegang"><col class="c-prijs"></colgroup>
    <thead><tr><th>Product</th><th>Toegang</th><th class="num">Prijs excl. btw</th></tr></thead>
    <tbody>${rijen
      .map(
        (p) => `<tr><td><strong>${esc(p.naam)}</strong>${p.beschrijving ? `<span class="zacht">${esc(p.beschrijving)}</span>` : ""}</td>
        <td class="toegang">${esc(toegang(p))}</td><td class="num">${prijs(p)}</td></tr>`,
      )
      .join("")}</tbody></table></div>`
}

function prijzen(producten, regels) {
  const btw = regels.btw_pct ?? 21
  const groepen = PRIJSGROEPEN.map(([type, titel, sub]) => {
    const rijen = producten.filter((p) => p.type === type)
    if (!rijen.length) return ""
    const tabel = prijstabel(rijen)
    const kop = `<h3>${esc(titel)} <span class="zacht">${esc(sub)} · ${rijen.length} ${rijen.length === 1 ? "product" : "producten"}</span></h3>`
    return type === "module"
      ? `<div class="prijsgroep"><details><summary>${kop}</summary>${tabel}</details></div>`
      : `<div class="prijsgroep">${kop}${tabel}</div>`
  }).join("")
  const zonderPrijs = producten.length > 0 && producten.every((p) => p.prijs_excl_btw === null)
  $("#prijsinleiding").innerHTML =
    `Alle prijzen zijn exclusief <span class="mono">${getal(btw)}&#8239;%</span> btw. Een centrale betaalt de prijs per plaats.` +
    (zonderPrijs ? " De prijzen worden vastgelegd tijdens de testfase; tot dan vermelden we ‘op aanvraag’." : "") +
    " Cursussen in voorbereiding krijgen hun prijs bij de opening."
  $("#prijstabellen").innerHTML = groepen || `<p class="zacht">Er zijn nog geen producten gepubliceerd.</p>`
}

function meestVoorkomend(getallen, standaard) {
  const n = {}
  for (const g of getallen) if (g) n[g] = (n[g] || 0) + 1
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]
  return top ? Number(top[0]) : standaard
}

function voorwaarden(producten, regels) {
  const m = (v) => `<span class="mono">${getal(v)}</span>`
  const toegangMnd = meestVoorkomend(producten.filter((p) => p.type !== "abonnement").map((p) => p.geldigheid_maanden), 3)
  const vm = regels.verlenging_maanden ?? 1
  const items = [
    ["Toegang", `Losse modules en trajecten: ${m(toegangMnd)} maanden vanaf de activatie. Updates in die periode zijn inbegrepen.`],
    ["Abonnement", "Jaarabonnement: 12 maanden toegang tot alle cursussen. Maandabonnement: loopt per maand zolang je betaalt."],
    [
      "Verlengen",
      `Telkens ${m(vm)} ${vm === 1 ? "maand" : "maanden"} voor ${m(regels.verlenging_prijs_pct ?? 25)}&#8239;% van de oorspronkelijke prijs, maximaal ${m(regels.verlenging_max ?? 3)} keer, aan te vragen binnen ${m(regels.verlenging_venster_maanden ?? 3)} maanden na de start.`,
    ],
    ["Na de einddatum", "De toegang stopt. Je voortgang en resultaten blijven bewaard."],
    ["Betalen", `Toegang na betaling van de factuur. De prijs ligt vast op het moment van je aanvraag. Prijzen exclusief ${m(regels.btw_pct ?? 21)}&#8239;% btw.`],
    ["Centrales", "Prijs per plaats. Elke plaats wordt toegewezen aan één medewerker."],
    ["Nieuwe versies", "Wijzigt een module tijdens je toegang, dan krijg je de nieuwe versie. Afgeronde lessen en geslaagde toetsen blijven gelden, tenzij de inhoud ervan wezenlijk wijzigde."],
  ]
  $("#voorwaardenlijst").innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")
  return toegangMnd
}

async function laadProducten() {
  let producten = []
  let regels = {}
  try {
    const res = await fetch("/api/producten")
    if (!res.ok) throw new Error()
    const d = await res.json()
    producten = d.producten || []
    regels = d.regels || {}
  } catch {
    $("#prijstabellen").innerHTML = `<p class="melding fout">De prijzen konden niet geladen worden. Probeer later opnieuw.</p>`
  }
  const toegangMnd = voorwaarden(producten, regels)
  kerncijfers(toegangMnd)
  if (producten.length) prijzen(producten, regels)
}

kerncijfers(3)
filterknoppen()
cursussen()
laadProducten()
sessie()
