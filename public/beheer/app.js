// Betosoft Academie — beheerscherm
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]

const esc = (v) =>
  v === null || v === undefined ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

// ---------- Opmaak (Belgische notatie) ----------
const euro = (n) => (n === null || n === undefined ? "prijs niet ingesteld" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n)))
function datum(v) {
  if (!v) return "—"
  const s = String(v).slice(0, 10)
  const [j, m, d] = s.split("-")
  return `${d}.${m}.${j}`
}
function tijdstip(v) {
  if (!v) return "—"
  const d = new Date(v)
  const p = (n) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const vandaag = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const periodeTekst = (p, maanden) =>
  p === "maand" ? "per maand" : p === "jaar" ? "per jaar" : maanden ? `eenmalig, ${maanden} maanden toegang` : "eenmalig, onbeperkt"
const typeTekst = { module: "module", traject: "traject", abonnement: "abonnement" }

function rechtStatus(r) {
  if (r.status === "ingetrokken") return `<span class="status s-afwijking">ingetrokken</span>`
  if (r.status === "gepauzeerd") return `<span class="status s-indicatief">gepauzeerd</span>`
  if (r.start_datum > vandaag()) return `<span class="status s-concept">start ${datum(r.start_datum)}</span>`
  if (r.eind_datum && r.eind_datum < vandaag()) return `<span class="status s-afwijking">verlopen</span>`
  if (r.dagen_resterend !== null && r.dagen_resterend !== undefined && r.dagen_resterend <= 14)
    return `<span class="status s-aandacht">loopt af over <span class="mono">${r.dagen_resterend}</span> d</span>`
  return `<span class="status s-conform">actief</span>`
}
function aanvraagStatus(s) {
  return {
    nieuw: `<span class="status s-concept">nieuw</span>`,
    gefactureerd: `<span class="status s-aandacht">gefactureerd, wacht op activatie</span>`,
    geactiveerd: `<span class="status s-conform">geactiveerd</span>`,
    geweigerd: `<span class="status s-afwijking">geweigerd</span>`,
  }[s] ?? esc(s)
}

// ---------- Communicatie ----------
async function api(pad, { methode = "GET", data } = {}) {
  const opties = { method: methode, credentials: "same-origin", headers: {} }
  if (methode !== "GET") {
    opties.headers["content-type"] = "application/json"
    opties.headers["x-academie"] = "1"
    opties.body = JSON.stringify(data ?? {})
  }
  const res = await fetch(pad, opties)
  let body = {}
  try {
    body = await res.json()
  } catch {}
  if (res.status === 401 && pad.startsWith("/api/beheer")) {
    toonAanmelden()
    throw new Error("Niet aangemeld")
  }
  if (!res.ok) throw new Error(body.fout || `Fout ${res.status}`)
  return body
}

let toastTimer
function toast(tekst, isFout = false) {
  let el = $(".toast")
  if (!el) {
    el = document.createElement("div")
    el.className = "toast"
    el.setAttribute("role", "status")
    document.body.append(el)
  }
  el.textContent = tekst
  el.classList.toggle("fout", isFout)
  el.classList.remove("verborgen")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add("verborgen"), isFout ? 6000 : 3000)
}

// ---------- Dialoog ----------
const dlg = $("#dialoog")
let dlgHandler = null
function dialoog({ titel, inhoud, knop = "Bevestigen", klasse = "knop", bij }) {
  $("#dialoogtitel").textContent = titel
  $("#dialooginhoud").innerHTML = inhoud
  $("#dialoogvoet").innerHTML = `
    <button class="knop stil" value="annuleer" formnovalidate>Annuleren</button>
    ${bij ? `<button class="${klasse}" value="ok">${esc(knop)}</button>` : ""}`
  dlgHandler = bij
  dlg.showModal()
  const eerste = $("#dialooginhoud input:not([type=hidden]), #dialooginhoud select")
  if (eerste) eerste.focus()
}
$("#dialoogform").addEventListener("submit", async (e) => {
  const knop = e.submitter
  if (!knop || knop.value !== "ok" || !dlgHandler) return
  e.preventDefault()
  const fd = Object.fromEntries(new FormData(e.target))
  knop.disabled = true
  try {
    const ok = await dlgHandler(fd, e.target)
    if (ok !== false) dlg.close()
  } catch (err) {
    toast(err.message, true)
  } finally {
    knop.disabled = false
  }
})

// ---------- Aanmelden ----------
function toonAanmelden() {
  $("#app").classList.add("verborgen")
  $("#afmelden").classList.add("verborgen")
  $("#aanmeldscherm").classList.remove("verborgen")
  $("#aanmeldform input").focus()
}
function toonApp() {
  $("#aanmeldscherm").classList.add("verborgen")
  $("#app").classList.remove("verborgen")
  $("#afmelden").classList.remove("verborgen")
  kiesTab(location.hash.slice(1) || "overzicht")
}
$("#aanmeldform").addEventListener("submit", async (e) => {
  e.preventDefault()
  const foutEl = $("#aanmeldfout")
  foutEl.classList.add("verborgen")
  try {
    await api("/api/aanmelden", { methode: "POST", data: { wachtwoord: e.target.wachtwoord.value } })
    e.target.reset()
    toonApp()
  } catch (err) {
    foutEl.textContent = err.message
    foutEl.classList.remove("verborgen")
  }
})
$("#afmelden").addEventListener("click", async () => {
  await api("/api/afmelden", { methode: "POST" }).catch(() => {})
  toonAanmelden()
})

// ---------- Tabs ----------
const inhoud = $("#inhoud")
let huidigeTab = null
function kiesTab(naam) {
  if (!tabs[naam]) naam = "overzicht"
  huidigeTab = naam
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === naam ? "true" : "false"))
  if (location.hash.slice(1) !== naam) history.replaceState(null, "", `#${naam}`)
  herlaad()
}
$$(".tab").forEach((t) => t.addEventListener("click", () => kiesTab(t.dataset.tab)))
async function herlaad() {
  inhoud.innerHTML = `<p class="zacht">Laden…</p>`
  try {
    await tabs[huidigeTab]()
  } catch (err) {
    if (err.message !== "Niet aangemeld") inhoud.innerHTML = `<div class="melding fout">${esc(err.message)}</div>`
  }
  vernieuwTeller()
}
async function vernieuwTeller() {
  try {
    const { cijfers } = await api("/api/beheer/overzicht")
    $("#teller-aanvragen").textContent = cijfers.nieuwe_aanvragen ? cijfers.nieuwe_aanvragen : ""
  } catch {}
}

// Klikacties via data-actie
inhoud.addEventListener("click", (e) => {
  const el = e.target.closest("[data-actie]")
  if (!el) return
  const f = acties[el.dataset.actie]
  if (f) f(el.dataset, el)
})

let productenCache = null
async function producten() {
  if (!productenCache) productenCache = (await api("/api/beheer/producten")).producten
  return productenCache
}

// =============== OVERZICHT ===============
const tabs = {}
tabs.overzicht = async () => {
  const { cijfers: c, aflopend } = await api("/api/beheer/overzicht")
  inhoud.innerHTML = `
    <p class="label" style="margin:4px 0 8px">${esc(datum(vandaag()))}</p>
    <h1>Overzicht</h1>
    <p>${c.nieuwe_aanvragen
      ? `<strong>${c.nieuwe_aanvragen} nieuwe aanvra${c.nieuwe_aanvragen === 1 ? "ag wacht" : "gen wachten"}</strong> op facturatie.`
      : "<strong>Geen nieuwe aanvragen.</strong>"}
      ${aflopend.length ? ` ${aflopend.length} toegangsrecht${aflopend.length === 1 ? "" : "en"} loopt binnen 14 dagen af.` : " Geen toegangsrechten die binnenkort aflopen."}</p>
    <div class="cijfers" style="margin-top:16px">
      <div class="cijfer ${c.nieuwe_aanvragen ? "koper" : ""}"><div class="label">Nieuwe aanvragen</div><div class="waarde">${c.nieuwe_aanvragen}</div></div>
      <div class="cijfer"><div class="label">Wacht op activatie</div><div class="waarde">${c.gefactureerd}</div></div>
      <div class="cijfer"><div class="label">Actieve rechten</div><div class="waarde">${c.actieve_rechten}</div></div>
      <div class="cijfer"><div class="label">Cursisten</div><div class="waarde">${c.cursisten}</div></div>
      <div class="cijfer"><div class="label">Centrales</div><div class="waarde">${c.centrales}</div></div>
    </div>
    <h2>01 Loopt binnen 14 dagen af</h2>
    ${aflopend.length
      ? `<div class="lijst">${aflopend.map((r) => `
        <div class="rij">
          <div>
            <div class="titel">${esc(r.klant || r.email)}</div>
            <div class="meta"><span>${esc(r.product_naam)}</span><span>einde <span class="mono">${datum(r.eind_datum)}</span></span>
              <span class="status ${r.dagen_resterend < 0 ? "s-afwijking" : "s-aandacht"}">${r.dagen_resterend < 0 ? "verlopen" : `nog <span class="mono">${r.dagen_resterend}</span> d`}</span></div>
          </div>
          <div class="knoppen"><button class="knop klein" data-actie="verleng" data-id="${r.id}" data-titel="${esc(r.klant || r.email)}">Verlengen</button></div>
        </div>`).join("")}</div>`
      : `<div class="leeg">Niets af te handelen.</div>`}
    <h2>02 Werkwijze</h2>
    <ol class="klein">
      <li>Nieuwe aanvraag binnen via het inschrijfformulier.</li>
      <li>Je maakt de factuur in je eigen boekhoudtool en noteert het factuurnummer.</li>
      <li>Na betaling (of meteen, zoals je verkiest) klik je op <em>Activeren</em>: de toegang start.</li>
      <li>Maandabonnement: na elke betaling klik je op <em>Verlengen</em> (+1 maand).</li>
    </ol>
    <p class="klein zacht">Aanvraagformulier voor klanten: <a href="/aanvragen/" target="_blank" rel="noopener">/aanvragen/</a></p>`
}

// =============== AANVRAGEN ===============
let aanvraagFilter = ""
tabs.aanvragen = async () => {
  const { aanvragen } = await api(`/api/beheer/aanvragen${aanvraagFilter ? `?status=${aanvraagFilter}` : ""}`)
  inhoud.innerHTML = `
    <h1>Aanvragen</h1>
    <div class="balk">
      <select id="aanvraagfilter" style="max-width:260px" aria-label="Filter">
        <option value="">Open (nieuw en gefactureerd)</option>
        <option value="nieuw">Nieuw</option>
        <option value="gefactureerd">Gefactureerd</option>
        <option value="geactiveerd">Geactiveerd</option>
        <option value="geweigerd">Geweigerd</option>
      </select>
    </div>
    ${aanvragen.length ? `<div class="lijst">${aanvragen.map(aanvraagRij).join("")}</div>` : `<div class="leeg">Geen aanvragen in deze lijst.</div>`}`
  const sel = $("#aanvraagfilter")
  sel.value = aanvraagFilter
  sel.addEventListener("change", () => {
    aanvraagFilter = sel.value
    herlaad()
  })
  window._aanvragen = Object.fromEntries(aanvragen.map((a) => [a.id, a]))
}
function aanvraagRij(a) {
  const naam = [a.voornaam, a.achternaam].filter(Boolean).join(" ")
  const open = a.status === "nieuw" || a.status === "gefactureerd"
  return `
  <div class="rij">
    <div>
      <div class="titel">${a.type === "centrale" ? esc(a.organisatie_naam) : esc(naam)} <span class="tag">${a.type === "centrale" ? "centrale" : "persoon"}</span></div>
      <div class="meta">
        ${a.type === "centrale" ? `<span>${esc(naam)}</span>` : ""}
        <span>${esc(a.email)}</span>
        <span>${esc(a.product)}${a.type === "centrale" ? ` · <span class="mono">${a.aantal_plaatsen}</span> plaatsen` : ""}</span>
        <span class="mono">${tijdstip(a.ingediend_op)}</span>
        ${a.factuurnummer ? `<span>factuur <span class="mono">${esc(a.factuurnummer)}</span></span>` : ""}
        ${aanvraagStatus(a.status)}
      </div>
    </div>
    <div class="knoppen">
      <button class="knop stil klein" data-actie="aanvraagDetail" data-id="${a.id}">Details</button>
      ${a.status === "nieuw" ? `<button class="knop licht klein" data-actie="factureer" data-id="${a.id}">Factuur noteren</button>` : ""}
      ${open ? `<button class="knop klein" data-actie="activeer" data-id="${a.id}">Activeren</button>` : ""}
      ${open ? `<button class="knop gevaar klein" data-actie="weiger" data-id="${a.id}">Weigeren</button>` : ""}
    </div>
  </div>`
}

// =============== TOEGANGSRECHTEN ===============
let rechtFilter = "actief"
let rechtZoek = ""
tabs.rechten = async () => {
  const q = new URLSearchParams({ filter: rechtFilter })
  if (rechtZoek) q.set("zoek", rechtZoek)
  const { rechten } = await api(`/api/beheer/rechten?${q}`)
  window._rechten = Object.fromEntries(rechten.map((r) => [r.id, r]))
  inhoud.innerHTML = `
    <h1>Toegangsrechten</h1>
    <div class="balk">
      <select id="rechtfilter" style="max-width:200px" aria-label="Filter">
        <option value="actief">Actief</option>
        <option value="aflopend">Loopt af (14 d)</option>
        <option value="verlopen">Verlopen of gestopt</option>
        <option value="alle">Alle</option>
      </select>
      <input id="rechtzoek" class="groei" type="search" placeholder="Zoek op klant, e-mail of factuurnummer" value="${esc(rechtZoek)}">
      <button class="knop" data-actie="nieuwRecht">Nieuw toegangsrecht</button>
    </div>
    ${rechten.length ? `<div class="lijst">${rechten.map(rechtRij).join("")}</div>` : `<div class="leeg">Geen toegangsrechten in deze lijst.</div>`}`
  const sel = $("#rechtfilter")
  sel.value = rechtFilter
  sel.addEventListener("change", () => { rechtFilter = sel.value; herlaad() })
  let t
  $("#rechtzoek").addEventListener("input", (e) => {
    clearTimeout(t)
    t = setTimeout(() => { rechtZoek = e.target.value.trim(); herlaad().then(() => { const z = $("#rechtzoek"); z.focus(); z.setSelectionRange(z.value.length, z.value.length) }) }, 350)
  })
}
function rechtRij(r) {
  const centrale = r.klanttype === "centrale"
  return `
  <div class="rij">
    <div>
      <div class="titel">${esc(r.klant || r.email)} <span class="tag">${centrale ? "centrale" : "persoon"}</span></div>
      <div class="meta">
        <span>${esc(r.product)}</span>
        <span><span class="mono">${datum(r.start_datum)}</span> – <span class="mono">${r.eind_datum ? datum(r.eind_datum) : "onbeperkt"}</span></span>
        ${centrale ? `<span>plaatsen <span class="mono">${r.plaatsen_gebruikt}/${r.aantal_plaatsen}</span></span>` : ""}
        ${r.factuurnummer ? `<span>factuur <span class="mono">${esc(r.factuurnummer)}</span></span>` : ""}
        ${rechtStatus(r)}
      </div>
    </div>
    <div class="knoppen">
      ${r.status !== "ingetrokken" ? `<button class="knop klein" data-actie="verleng" data-id="${r.id}" data-titel="${esc(r.klant || r.email)}">Verlengen</button>` : ""}
      ${centrale ? `<button class="knop licht klein" data-actie="openCentrale" data-id="${r.organisatie_id}">Plaatsen</button>` : ""}
      <button class="knop stil klein" data-actie="rechtMeer" data-id="${r.id}">Meer</button>
    </div>
  </div>`
}

// =============== CENTRALES ===============
let centraleOpen = null
tabs.centrales = async () => {
  if (centraleOpen) return centraleDetail(centraleOpen)
  const { centrales } = await api("/api/beheer/centrales")
  inhoud.innerHTML = `
    <h1>Centrales</h1>
    <p class="zacht klein">Een centrale ontstaat bij de activatie van een aanvraag van een centrale of via Nieuw toegangsrecht.</p>
    ${centrales.length ? `<div class="lijst">${centrales.map((o) => `
      <div class="rij">
        <div>
          <div class="titel">${esc(o.naam)}</div>
          <div class="meta">
            ${o.btw_nummer ? `<span class="mono">${esc(o.btw_nummer)}</span>` : ""}
            <span>${esc(o.contact_naam || "")} ${o.contact_email ? `· ${esc(o.contact_email)}` : ""}</span>
            <span>personen <span class="mono">${o.personen}</span></span>
            <span>plaatsen <span class="mono">${o.plaatsen_gebruikt}/${o.plaatsen}</span></span>
            <span>actieve rechten <span class="mono">${o.actieve_rechten}</span></span>
          </div>
        </div>
        <div class="knoppen"><button class="knop klein" data-actie="openCentrale" data-id="${o.id}">Openen</button></div>
      </div>`).join("")}</div>` : `<div class="leeg">Nog geen centrales.</div>`}`
}
async function centraleDetail(oid) {
  const { centrale: o, personen, rechten } = await api(`/api/beheer/centrales/${oid}`)
  window._centrale = { o, personen, rechten }
  const geldige = rechten.filter((r) => r.geldig)
  inhoud.innerHTML = `
    <p><a href="#centrales" data-actie="terugCentrales">← Alle centrales</a></p>
    <h1>${esc(o.naam)}</h1>
    <div class="meta klein zacht" style="display:flex;gap:6px 14px;flex-wrap:wrap;margin-top:6px">
      ${o.btw_nummer ? `<span class="mono">${esc(o.btw_nummer)}</span>` : ""}
      ${o.contact_naam ? `<span>${esc(o.contact_naam)}</span>` : ""}
      ${o.contact_email ? `<span>${esc(o.contact_email)}</span>` : ""}
      ${o.telefoon ? `<span class="mono">${esc(o.telefoon)}</span>` : ""}
    </div>
    <div class="knoppen" style="margin-top:12px">
      <button class="knop licht klein" data-actie="wijzigCentrale">Gegevens wijzigen</button>
      <button class="knop klein" data-actie="persoonToevoegen">Persoon toevoegen</button>
    </div>

    <h2>01 Toegangsrechten en plaatsen</h2>
    ${rechten.length ? `<div class="lijst">${rechten.map((r) => `
      <div class="rij">
        <div>
          <div class="titel">${esc(r.product)}</div>
          <div class="meta">
            <span><span class="mono">${datum(r.start_datum)}</span> – <span class="mono">${r.eind_datum ? datum(r.eind_datum) : "onbeperkt"}</span></span>
            <span>plaatsen <span class="mono">${r.gebruikt}/${r.aantal_plaatsen}</span></span>
            ${r.factuurnummer ? `<span>factuur <span class="mono">${esc(r.factuurnummer)}</span></span>` : ""}
            ${rechtStatus({ ...r, dagen_resterend: r.eind_datum ? Math.round((new Date(r.eind_datum) - new Date(vandaag())) / 864e5) : null })}
          </div>
        </div>
        <div class="knoppen">
          <button class="knop klein" data-actie="verleng" data-id="${r.id}" data-titel="${esc(o.naam)}">Verlengen</button>
          <button class="knop licht klein" data-actie="plaatsenWijzigen" data-id="${r.id}" data-aantal="${r.aantal_plaatsen}" data-gebruikt="${r.gebruikt}">Aantal plaatsen</button>
        </div>
      </div>`).join("")}</div>` : `<div class="leeg">Geen toegangsrechten.</div>`}

    <h2>02 Personen</h2>
    ${personen.length ? `<div class="lijst">${personen.map((p) => `
      <div class="rij">
        <div>
          <div class="titel">${esc([p.voornaam, p.achternaam].filter(Boolean).join(" ") || p.email)}
            ${p.rol === "centrale_verantwoordelijke" ? `<span class="tag">verantwoordelijke</span>` : ""}
            ${!p.actief ? `<span class="status s-indicatief">inactief</span>` : ""}</div>
          <div class="meta"><span>${esc(p.email)}</span>
            ${p.plaatsen.length ? p.plaatsen.map((pl) => `<span>${esc(pl.product)} <button class="knop stil klein" style="min-height:26px;padding:0 6px" data-actie="plaatsIntrekken" data-id="${pl.toewijzing}" title="Plaats intrekken">×</button></span>`).join("") : `<span class="zacht">geen plaats</span>`}
          </div>
        </div>
        <div class="knoppen">
          ${geldige.length ? `<button class="knop licht klein" data-actie="plaatsToewijzen" data-id="${p.id}" data-naam="${esc(p.voornaam || p.email)}">Plaats toewijzen</button>` : ""}
        </div>
      </div>`).join("")}</div>` : `<div class="leeg">Nog geen personen.</div>`}`
}

// =============== CURSISTEN ===============
let cursistZoek = ""
tabs.cursisten = async () => {
  const { cursisten } = await api(`/api/beheer/cursisten${cursistZoek ? `?zoek=${encodeURIComponent(cursistZoek)}` : ""}`)
  inhoud.innerHTML = `
    <h1>Cursisten</h1>
    <div class="balk"><input id="cursistzoek" class="groei" type="search" placeholder="Zoek op naam, e-mail of centrale" value="${esc(cursistZoek)}"></div>
    ${cursisten.length ? `<div class="lijst">${cursisten.map((g) => `
      <div class="rij">
        <div>
          <div class="titel">${esc([g.voornaam, g.achternaam].filter(Boolean).join(" ") || g.email)}
            ${g.centrale ? `<span class="tag">${esc(g.centrale)}</span>` : `<span class="tag">persoon</span>`}
            ${!g.actief ? `<span class="status s-indicatief">inactief</span>` : ""}</div>
          <div class="meta">
            <span>${esc(g.email)}</span>
            <span>modules <span class="mono">${g.modules_toegang}</span></span>
            <span>lessen af <span class="mono">${g.lessen_af}</span></span>
            <span>attesten <span class="mono">${g.attesten}</span></span>
            <span>punten <span class="mono">${g.punten}</span></span>
            <span>sinds <span class="mono">${datum(g.aangemaakt_op)}</span></span>
          </div>
        </div>
        <div class="knoppen"><button class="knop stil klein" data-actie="cursistActief" data-id="${g.id}" data-actief="${g.actief ? "0" : "1"}">${g.actief ? "Deactiveren" : "Activeren"}</button></div>
      </div>`).join("")}</div>` : `<div class="leeg">Geen cursisten gevonden.</div>`}`
  let t
  $("#cursistzoek").addEventListener("input", (e) => {
    clearTimeout(t)
    t = setTimeout(() => { cursistZoek = e.target.value.trim(); herlaad().then(() => { const z = $("#cursistzoek"); z.focus(); z.setSelectionRange(z.value.length, z.value.length) }) }, 350)
  })
}

// =============== PRODUCTEN ===============
tabs.producten = async () => {
  productenCache = null
  const lijst = await producten()
  window._producten = Object.fromEntries(lijst.map((p) => [p.id, p]))
  const groep = (t, titel, nr) => {
    const rijen = lijst.filter((p) => p.type === t)
    return `<h2>${nr} ${titel}</h2><div class="lijst">${rijen.map((p) => `
      <div class="rij">
        <div>
          <div class="titel">${esc(p.naam)} ${!p.actief ? `<span class="status s-indicatief">niet te koop</span>` : ""}</div>
          <div class="meta">
            <span class="mono">${esc(p.code)}</span>
            <span class="${p.prijs_excl_btw === null ? "status s-aandacht" : "mono"}">${p.prijs_excl_btw === null ? "prijs niet ingesteld" : `${euro(p.prijs_excl_btw)} excl. btw`}</span>
            <span>${esc(periodeTekst(p.periode, p.geldigheid_maanden))}</span>
            <span>${p.alle_modules ? "alle modules" : `<span class="mono">${p.modules}</span> module${p.modules === 1 ? "" : "s"}`}</span>
            <span>actieve rechten <span class="mono">${p.actieve_rechten}</span></span>
          </div>
        </div>
        <div class="knoppen"><button class="knop licht klein" data-actie="wijzigProduct" data-id="${p.id}">Wijzigen</button></div>
      </div>`).join("")}</div>`
  }
  inhoud.innerHTML = `<h1>Producten</h1>
    <p class="zacht klein">Prijzen en geldigheid gelden voor nieuwe activaties. Bestaande toegangsrechten veranderen niet.</p>
    ${groep("abonnement", "Abonnementen", "01")}${groep("traject", "Trajecten en volledige cursus", "02")}${groep("module", "Losse modules", "03")}`
}

// =============== LOGBOEK ===============
const actieNamen = {
  aanvraag_geactiveerd: "Aanvraag geactiveerd", aanvraag_gefactureerd: "Factuur genoteerd", aanvraag_geweigerd: "Aanvraag geweigerd",
  recht_verlengd: "Toegang verlengd", recht_status: "Status gewijzigd", plaats_toegewezen: "Plaats toegewezen",
  plaats_ingetrokken: "Plaats ingetrokken", cursist_toegevoegd: "Persoon toegevoegd", plaatsen_gewijzigd: "Aantal plaatsen gewijzigd",
  product_gewijzigd: "Product gewijzigd", gebruiker_actief: "Persoon (de)geactiveerd",
}
tabs.logboek = async () => {
  const { logboek } = await api("/api/beheer/logboek")
  inhoud.innerHTML = `<h1>Logboek</h1><p class="zacht klein">Laatste 200 acties.</p>
    ${logboek.length ? `<div class="scroll-x paneel" style="padding:0"><table class="eenvoudig">
      <thead><tr><th>Tijdstip</th><th>Actie</th><th>Details</th></tr></thead>
      <tbody>${logboek.map((l) => `<tr><td class="mono">${tijdstip(l.tijdstip)}</td><td>${esc(actieNamen[l.actie] || l.actie)}</td>
        <td class="mono klein">${esc(Object.entries(l.details || {}).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${v}`).join(" · "))}</td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="leeg">Nog geen acties.</div>`}`
}

// =============== ACTIES ===============
const acties = {}

acties.aanvraagDetail = ({ id }) => {
  const a = window._aanvragen[id]
  const r = (l, v, mono) => (v ? `<tr><th>${l}</th><td class="${mono ? "mono" : ""}">${esc(v)}</td></tr>` : "")
  dialoog({
    titel: "Aanvraag",
    inhoud: `<table class="eenvoudig"><tbody>
      ${r("Type", a.type === "centrale" ? "Centrale" : "Persoon")}
      ${r("Centrale", a.organisatie_naam)}${r("Btw-nummer", a.btw_nummer, true)}
      ${r("Naam", [a.voornaam, a.achternaam].filter(Boolean).join(" "))}${r("E-mail", a.email)}${r("Telefoon", a.telefoon, true)}
      ${r("Adres", a.adres)}${r("Product", a.product)}
      ${r("Prijs", a.prijs_excl_btw !== null ? `${euro(a.prijs_excl_btw)} excl. btw · ${periodeTekst(a.periode, a.geldigheid_maanden)}` : "prijs niet ingesteld")}
      ${a.type === "centrale" ? r("Plaatsen", String(a.aantal_plaatsen), true) : ""}
      ${a.type === "centrale" && a.prijs_excl_btw !== null ? r("Totaal", `${euro(a.prijs_excl_btw * a.aantal_plaatsen)} excl. btw`, true) : ""}
      ${r("Opmerking", a.opmerking)}${r("Ingediend", tijdstip(a.ingediend_op), true)}${r("Factuur", a.factuurnummer, true)}
    </tbody></table>`,
  })
}

acties.factureer = ({ id }) =>
  dialoog({
    titel: "Factuurnummer noteren",
    inhoud: `<p class="klein zacht">Maak de factuur in je boekhoudtool en noteer hier het nummer. De aanvraag krijgt de status gefactureerd.</p>
      <label class="veld"><span class="label">Factuurnummer</span><input name="factuurnummer" required maxlength="60" class="mono"></label>`,
    knop: "Opslaan",
    bij: async (fd) => {
      await api(`/api/beheer/aanvragen/${id}/factureer`, { methode: "POST", data: fd })
      toast("Factuurnummer opgeslagen")
      herlaad()
    },
  })

acties.activeer = ({ id }) => {
  const a = window._aanvragen[id]
  dialoog({
    titel: "Toegang activeren",
    inhoud: `<p><strong>${esc(a.type === "centrale" ? a.organisatie_naam : [a.voornaam, a.achternaam].join(" "))}</strong> krijgt toegang tot <strong>${esc(a.product)}</strong>${a.type === "centrale" ? ` met <span class="mono">${a.aantal_plaatsen}</span> plaatsen` : ""}.</p>
      <p class="klein zacht">Geldigheid: ${esc(periodeTekst(a.periode, a.geldigheid_maanden))}.</p>
      <div class="velden twee">
        <label class="veld"><span class="label">Factuurnummer</span><input name="factuurnummer" maxlength="60" class="mono" value="${esc(a.factuurnummer || "")}"></label>
        <label class="veld"><span class="label">Startdatum</span><input name="start_datum" type="date" value="${vandaag()}" required></label>
      </div>`,
    knop: "Activeren",
    bij: async (fd) => {
      await api(`/api/beheer/aanvragen/${id}/activeer`, { methode: "POST", data: fd })
      toast("Toegang geactiveerd")
      herlaad()
    },
  })
}

acties.weiger = ({ id }) =>
  dialoog({
    titel: "Aanvraag weigeren",
    inhoud: `<label class="veld"><span class="label">Reden (intern)</span><textarea name="reden" maxlength="300"></textarea></label>`,
    knop: "Weigeren",
    klasse: "knop gevaar",
    bij: async (fd) => {
      await api(`/api/beheer/aanvragen/${id}/weiger`, { methode: "POST", data: fd })
      toast("Aanvraag geweigerd")
      herlaad()
    },
  })

acties.verleng = ({ id, titel }) => {
  const r = window._rechten?.[id]
  const standaard = r?.periode === "maand" ? "1" : "12"
  dialoog({
    titel: `Verlengen · ${titel || ""}`,
    inhoud: `
      ${r ? `<p class="klein">Huidig einde: <span class="mono">${r.eind_datum ? datum(r.eind_datum) : "onbeperkt"}</span>. Verlenging start op het huidige einde, of vandaag als de toegang al verlopen is.</p>` : `<p class="klein">Verlenging start op het huidige einde, of vandaag als de toegang al verlopen is.</p>`}
      <div class="velden twee">
        <label class="veld"><span class="label">Verlengen met</span>
          <select name="maanden">
            ${[1, 3, 6, 12, 24].map((m) => `<option value="${m}" ${String(m) === standaard ? "selected" : ""}>${m} maand${m === 1 ? "" : "en"}</option>`).join("")}
            <option value="">Tot een datum…</option>
          </select></label>
        <label class="veld"><span class="label">Of tot datum</span><input name="eind_datum" type="date"></label>
      </div>
      <label class="veld"><span class="label">Factuurnummer</span><input name="factuurnummer" maxlength="60" class="mono"></label>
      <label class="veld"><span class="label">Opmerking</span><input name="opmerking" maxlength="300"></label>`,
    knop: "Verlengen",
    bij: async (fd) => {
      const data = { factuurnummer: fd.factuurnummer, opmerking: fd.opmerking }
      if (fd.eind_datum) data.eind_datum = fd.eind_datum
      else if (fd.maanden) data.maanden = Number(fd.maanden)
      else throw new Error("Kies een aantal maanden of een einddatum.")
      const res = await api(`/api/beheer/rechten/${id}/verleng`, { methode: "POST", data })
      toast(`Verlengd tot ${datum(res.eind_datum)}`)
      herlaad()
    },
  })
}

acties.rechtMeer = async ({ id }) => {
  const r = window._rechten[id]
  const { verlengingen } = await api(`/api/beheer/rechten/${id}/verlengingen`)
  dialoog({
    titel: r.klant || r.email,
    inhoud: `
      <p><strong>${esc(r.product)}</strong> · ${rechtStatus(r)}</p>
      <p class="klein">Periode <span class="mono">${datum(r.start_datum)}</span> – <span class="mono">${r.eind_datum ? datum(r.eind_datum) : "onbeperkt"}</span>${r.factuurnummer ? ` · factuur <span class="mono">${esc(r.factuurnummer)}</span>` : ""}</p>
      <div class="knoppen" style="margin:12px 0">
        ${r.status === "actief" ? `<button type="button" class="knop stil klein" data-status="gepauzeerd">Pauzeren</button>` : ""}
        ${r.status !== "actief" ? `<button type="button" class="knop licht klein" data-status="actief">Opnieuw activeren</button>` : ""}
        ${r.status !== "ingetrokken" ? `<button type="button" class="knop gevaar klein" data-status="ingetrokken">Intrekken</button>` : ""}
      </div>
      <h3 style="margin-top:8px">Verlengingen</h3>
      ${verlengingen.length ? `<table class="eenvoudig"><thead><tr><th>Datum</th><th>Van</th><th>Tot</th><th>Factuur</th></tr></thead><tbody>
        ${verlengingen.map((v) => `<tr><td class="mono">${tijdstip(v.verlengd_op)}</td><td class="mono">${datum(v.oude_eind_datum)}</td><td class="mono">${datum(v.nieuwe_eind_datum)}</td><td class="mono">${esc(v.factuurnummer || "")}</td></tr>`).join("")}
      </tbody></table>` : `<p class="zacht klein">Nog niet verlengd.</p>`}`,
  })
  $$("#dialooginhoud [data-status]").forEach((b) =>
    b.addEventListener("click", async () => {
      const s = b.dataset.status
      if (s === "ingetrokken" && !confirm("Toegang intrekken? De cursist(en) verliezen meteen de toegang.")) return
      try {
        await api(`/api/beheer/rechten/${id}/status`, { methode: "POST", data: { status: s } })
        dlg.close()
        toast("Status gewijzigd")
        herlaad()
      } catch (err) {
        toast(err.message, true)
      }
    }),
  )
}

acties.nieuwRecht = async () => {
  const lijst = (await producten()).filter((p) => p.actief)
  dialoog({
    titel: "Nieuw toegangsrecht",
    inhoud: `
      <p class="klein zacht">Voor een bestelling die niet via het formulier binnenkwam. Geldt meteen.</p>
      <label class="veld"><span class="label">Klant</span>
        <select name="type" id="nr-type"><option value="individueel">Persoon</option><option value="centrale">Centrale</option></select></label>
      <div id="nr-centrale" class="verborgen">
        <div class="velden twee">
          <label class="veld"><span class="label">Naam centrale</span><input name="organisatie_naam" maxlength="160"></label>
          <label class="veld"><span class="label">Btw-nummer</span><input name="btw_nummer" maxlength="20" class="mono" placeholder="BE0123456789"></label>
        </div>
        <label class="veld"><span class="label">Aantal plaatsen</span><input name="aantal_plaatsen" type="number" min="1" max="500" value="1" class="mono"></label>
      </div>
      <div class="velden twee">
        <label class="veld"><span class="label">Voornaam</span><input name="voornaam" maxlength="80"></label>
        <label class="veld"><span class="label">Achternaam</span><input name="achternaam" maxlength="80"></label>
      </div>
      <label class="veld"><span class="label">E-mail</span><input name="email" type="email" required maxlength="254"></label>
      <label class="veld"><span class="label">Product</span>
        <select name="product_id" required>${lijst.map((p) => `<option value="${p.id}">${esc(p.naam)}</option>`).join("")}</select></label>
      <div class="velden twee">
        <label class="veld"><span class="label">Startdatum</span><input name="start_datum" type="date" value="${vandaag()}"></label>
        <label class="veld"><span class="label">Factuurnummer</span><input name="factuurnummer" maxlength="60" class="mono"></label>
      </div>`,
    knop: "Toekennen",
    bij: async (fd) => {
      await api("/api/beheer/rechten", { methode: "POST", data: fd })
      toast("Toegangsrecht toegekend")
      herlaad()
    },
  })
  $("#nr-type").addEventListener("change", (e) => $("#nr-centrale").classList.toggle("verborgen", e.target.value !== "centrale"))
}

acties.openCentrale = ({ id }) => {
  centraleOpen = id
  kiesTab("centrales")
}
acties.terugCentrales = () => {
  centraleOpen = null
  herlaad()
}

acties.wijzigCentrale = () => {
  const o = window._centrale.o
  const v = (n, l, extra = "") => `<label class="veld"><span class="label">${l}</span><input name="${n}" value="${esc(o[n] || "")}" ${extra}></label>`
  dialoog({
    titel: "Gegevens centrale",
    inhoud: `${v("naam", "Naam", 'required maxlength="160"')}
      <div class="velden twee">${v("btw_nummer", "Btw-nummer", 'class="mono" maxlength="20"')}${v("telefoon", "Telefoon", 'maxlength="40"')}</div>
      ${v("adres", "Adres", 'maxlength="300"')}
      <div class="velden twee">${v("contact_naam", "Contactpersoon", 'maxlength="160"')}${v("contact_email", "E-mail contact", 'type="email" maxlength="254"')}</div>
      <label class="veld"><span class="label">Opmerking (intern)</span><textarea name="opmerking" maxlength="1000">${esc(o.opmerking || "")}</textarea></label>`,
    knop: "Opslaan",
    bij: async (fd) => {
      await api(`/api/beheer/centrales/${o.id}/wijzig`, { methode: "POST", data: fd })
      toast("Gegevens opgeslagen")
      herlaad()
    },
  })
}

function vrijeRechten(uitsluitenVoorPersoon) {
  const { rechten, personen } = window._centrale
  const persoon = personen.find((p) => p.id === uitsluitenVoorPersoon)
  const bezet = new Set((persoon?.plaatsen || []).map((p) => p.recht))
  return rechten.filter((r) => r.geldig && r.gebruikt < r.aantal_plaatsen && !bezet.has(r.id))
}

acties.persoonToevoegen = () => {
  const o = window._centrale.o
  const vrij = vrijeRechten(null)
  dialoog({
    titel: `Persoon toevoegen · ${o.naam}`,
    inhoud: `
      <div class="velden twee">
        <label class="veld"><span class="label">Voornaam</span><input name="voornaam" required maxlength="80"></label>
        <label class="veld"><span class="label">Achternaam</span><input name="achternaam" maxlength="80"></label>
      </div>
      <label class="veld"><span class="label">E-mail</span><input name="email" type="email" required maxlength="254"></label>
      <label class="veld"><span class="label">Meteen een plaats toewijzen</span>
        <select name="recht_id"><option value="">Nee, later</option>
          ${vrij.map((r) => `<option value="${r.id}">${esc(r.product)} (${r.aantal_plaatsen - r.gebruikt} vrij)</option>`).join("")}
        </select></label>`,
    knop: "Toevoegen",
    bij: async (fd) => {
      await api(`/api/beheer/centrales/${o.id}/cursist`, { methode: "POST", data: fd })
      toast("Persoon toegevoegd")
      herlaad()
    },
  })
}

acties.plaatsToewijzen = ({ id, naam }) => {
  const vrij = vrijeRechten(id)
  if (!vrij.length) return toast("Geen vrije plaatsen. Verhoog het aantal plaatsen of trek een plaats in.", true)
  dialoog({
    titel: `Plaats toewijzen · ${naam}`,
    inhoud: `<label class="veld"><span class="label">Toegangsrecht</span>
      <select name="recht_id">${vrij.map((r) => `<option value="${r.id}">${esc(r.product)} (${r.aantal_plaatsen - r.gebruikt} vrij)</option>`).join("")}</select></label>`,
    knop: "Toewijzen",
    bij: async (fd) => {
      await api("/api/beheer/plaatsen", { methode: "POST", data: { recht_id: fd.recht_id, gebruiker_id: id } })
      toast("Plaats toegewezen")
      herlaad()
    },
  })
}

acties.plaatsIntrekken = async ({ id }) => {
  if (!confirm("Plaats intrekken? De persoon verliest de toegang via deze plaats. De voortgang blijft bewaard.")) return
  try {
    await api(`/api/beheer/plaatsen/${id}/intrek`, { methode: "POST" })
    toast("Plaats ingetrokken")
    herlaad()
  } catch (err) {
    toast(err.message, true)
  }
}

acties.plaatsenWijzigen = ({ id, aantal, gebruikt }) =>
  dialoog({
    titel: "Aantal plaatsen",
    inhoud: `<p class="klein">Nu <span class="mono">${gebruikt}</span> van <span class="mono">${aantal}</span> plaatsen in gebruik.</p>
      <div class="velden twee">
        <label class="veld"><span class="label">Nieuw aantal</span><input name="aantal_plaatsen" type="number" min="${gebruikt || 1}" max="500" value="${aantal}" class="mono" required></label>
        <label class="veld"><span class="label">Factuurnummer</span><input name="factuurnummer" maxlength="60" class="mono"></label>
      </div>`,
    knop: "Opslaan",
    bij: async (fd) => {
      await api(`/api/beheer/rechten/${id}/plaatsen`, { methode: "POST", data: fd })
      toast("Aantal plaatsen gewijzigd")
      herlaad()
    },
  })

acties.cursistActief = async ({ id, actief }) => {
  try {
    await api(`/api/beheer/cursisten/${id}/actief`, { methode: "POST", data: { actief: actief === "1" } })
    toast(actief === "1" ? "Persoon geactiveerd" : "Persoon gedeactiveerd")
    herlaad()
  } catch (err) {
    toast(err.message, true)
  }
}

acties.wijzigProduct = ({ id }) => {
  const p = window._producten[id]
  dialoog({
    titel: "Product wijzigen",
    inhoud: `
      <p class="label">${esc(p.code)} · ${esc(typeTekst[p.type])} · ${esc(periodeTekst(p.periode, null).split(",")[0])}</p>
      <label class="veld"><span class="label">Naam</span><input name="naam" value="${esc(p.naam)}" required maxlength="160"></label>
      <div class="velden twee">
        <label class="veld"><span class="label">Prijs excl. btw (€)</span><input name="prijs_excl_btw" inputmode="decimal" class="mono" value="${p.prijs_excl_btw === null ? "" : esc(String(p.prijs_excl_btw).replace(".", ","))}" placeholder="bv. 149,00"></label>
        <label class="veld"><span class="label">Toegang (maanden)</span><input name="geldigheid_maanden" type="number" min="1" max="120" class="mono" value="${p.geldigheid_maanden ?? ""}" placeholder="leeg = onbeperkt"></label>
      </div>
      <label class="veld"><span class="label">Beschrijving</span><textarea name="beschrijving" maxlength="500">${esc(p.beschrijving || "")}</textarea></label>
      <label class="check"><input type="checkbox" name="actief" ${p.actief ? "checked" : ""}><span>Te koop in het inschrijfformulier</span></label>`,
    knop: "Opslaan",
    bij: async (fd) => {
      await api(`/api/beheer/producten/${id}/wijzig`, { methode: "POST", data: { ...fd, actief: fd.actief === "on" } })
      productenCache = null
      toast("Product opgeslagen")
      herlaad()
    },
  })
}

// ---------- Start ----------
window.addEventListener("hashchange", () => {
  const t = location.hash.slice(1)
  if (t && t !== huidigeTab && tabs[t]) {
    if (t === "centrales") centraleOpen = null
    kiesTab(t)
  }
})
;(async () => {
  try {
    const s = await api("/api/sessie")
    s.aangemeld ? toonApp() : toonAanmelden()
  } catch {
    toonAanmelden()
  }
})()
