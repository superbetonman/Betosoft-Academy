// Gedeelde hulpfuncties voor alle pagina's van de Betosoft Academy
export const $ = (s, el = document) => el.querySelector(s)
export const $$ = (s, el = document) => [...el.querySelectorAll(s)]

export const esc = (v) =>
  v === null || v === undefined ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

export const euro = (n) =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n))

export const getal = (n, dec = 0) =>
  n === null || n === undefined || n === "" ? "—" : new Intl.NumberFormat("nl-BE", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(n))

export function datum(v) {
  if (!v) return "—"
  const s = String(v).slice(0, 10)
  const [j, m, d] = s.split("-")
  return `${d}.${m}.${j}`
}

export function tijdstip(v) {
  if (!v) return "—"
  const d = new Date(v)
  const p = (n) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const vandaag = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const naam = (p) => [p?.voornaam, p?.achternaam].filter(Boolean).join(" ") || p?.email || ""

/** API-oproep. Bij 401 gaat de gebruiker naar de aanmeldpagina. */
export async function api(pad, { methode = "GET", data } = {}) {
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
  if (res.status === 401 && !pad.startsWith("/api/aanmelden") && !pad.startsWith("/api/wachtwoord")) {
    location.href = `/aanmelden/?terug=${encodeURIComponent(location.pathname + location.hash)}`
    throw new Error("Niet aangemeld")
  }
  if (!res.ok) throw new Error(body.fout || `Fout ${res.status}`)
  return body
}

let toastTimer
export function toast(tekst, isFout = false) {
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

/** Modaal venster. bij(formdata) wordt uitgevoerd bij bevestigen; geef false terug om open te blijven. */
export function maakDialoog() {
  let dlg = $("#dialoog")
  if (!dlg) {
    dlg = document.createElement("dialog")
    dlg.id = "dialoog"
    dlg.innerHTML = `<form method="dialog" id="dialoogform">
      <div class="dkop"><h3 id="dialoogtitel"></h3><button class="sluit" value="annuleer" aria-label="Sluiten" formnovalidate>×</button></div>
      <div class="dinhoud" id="dialooginhoud"></div><div class="dvoet" id="dialoogvoet"></div></form>`
    document.body.append(dlg)
  }
  let handler = null
  $("#dialoogform").addEventListener("submit", async (e) => {
    const knop = e.submitter
    if (!knop || knop.value !== "ok" || !handler) return
    e.preventDefault()
    const fd = Object.fromEntries(new FormData(e.target))
    knop.disabled = true
    try {
      const ok = await handler(fd, e.target)
      if (ok !== false) dlg.close()
    } catch (err) {
      toast(err.message, true)
    } finally {
      knop.disabled = false
    }
  })
  return function dialoog({ titel, inhoud, knop = "Bevestigen", klasse = "knop", bij, sluitTekst = "Annuleren" }) {
    $("#dialoogtitel").textContent = titel
    $("#dialooginhoud").innerHTML = inhoud
    $("#dialoogvoet").innerHTML = `<button class="knop stil" value="annuleer" formnovalidate>${esc(sluitTekst)}</button>
      ${bij ? `<button class="${klasse}" value="ok">${esc(knop)}</button>` : ""}`
    handler = bij
    dlg.showModal()
    const eerste = $("#dialooginhoud input:not([type=hidden]):not([readonly]), #dialooginhoud select")
    if (eerste) eerste.focus()
    return dlg
  }
}

/** Toont een uitnodigingslink met kopieerknop (inhoud voor een dialoog). */
export function uitnodigingHtml(u, wie) {
  return `<p>Stuur deze link naar <strong>${esc(wie)}</strong>. Met de link kiest de persoon een wachtwoord. De link is 14 dagen geldig en werkt één keer.</p>
    <label class="veld"><span class="label">Uitnodigingslink</span><input id="uitnodigingslink" readonly value="${esc(u.link)}" class="mono klein"></label>
    <button type="button" class="knop licht klein" id="kopieer">Link kopiëren</button>`
}
export function koppelKopieer() {
  const k = $("#kopieer")
  if (!k) return
  k.addEventListener("click", async () => {
    const v = $("#uitnodigingslink").value
    try {
      await navigator.clipboard.writeText(v)
      toast("Link gekopieerd")
    } catch {
      $("#uitnodigingslink").select()
      toast("Selecteer en kopieer de link", true)
    }
  })
}

export async function afmelden() {
  await api("/api/afmelden", { methode: "POST" }).catch(() => {})
  location.href = "/aanmelden/"
}
