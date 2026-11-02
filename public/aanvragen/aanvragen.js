const form = document.getElementById("form")
const productSel = document.getElementById("product")
const prijsEl = document.getElementById("prijs")
const melding = document.getElementById("melding")
let producten = []

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const euro = (n) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n))
const periode = (p) =>
  p.periode === "maand" ? "per maand" : p.periode === "jaar" ? "per jaar" : p.geldigheid_maanden ? `eenmalig, ${p.geldigheid_maanden} maanden toegang` : "eenmalig"

async function laadProducten() {
  try {
    const res = await fetch("/api/producten")
    producten = (await res.json()).producten || []
  } catch {
    producten = []
  }
  const groepen = [
    ["abonnement", "Abonnement (alle opleidingen)"],
    ["traject", "Volledig traject"],
    ["module", "Losse module"],
  ]
  productSel.innerHTML =
    `<option value="">Maak een keuze</option>` +
    groepen
      .map(([t, label]) => {
        const lijst = producten.filter((p) => p.type === t)
        return lijst.length ? `<optgroup label="${esc(label)}">${lijst.map((p) => `<option value="${p.id}">${esc(p.naam)}</option>`).join("")}</optgroup>` : ""
      })
      .join("")
  const vooraf = new URLSearchParams(location.search).get("product")
  if (vooraf) {
    const p = producten.find((x) => x.code === vooraf)
    if (p) productSel.value = p.id
  }
  toonPrijs()
}

function toonPrijs() {
  const p = producten.find((x) => x.id === productSel.value)
  const centrale = form.type.value === "centrale"
  const n = Math.max(1, Number(form.aantal_plaatsen.value) || 1)
  if (!p) return (prijsEl.textContent = "")
  if (p.prijs_excl_btw === null) return (prijsEl.textContent = `Prijs op aanvraag · ${periode(p)}`)
  const tot = centrale ? ` · ${n} plaatsen: ${euro(p.prijs_excl_btw * n)} excl. btw` : ""
  prijsEl.textContent = `${euro(p.prijs_excl_btw)} excl. btw ${centrale ? "per plaats " : ""}· ${periode(p)}${tot}`
  if (p.beschrijving) prijsEl.textContent += ` · ${p.beschrijving}`
}

function typeWissel() {
  const centrale = form.type.value === "centrale"
  document.getElementById("centraleblok").classList.toggle("verborgen", !centrale)
  document.getElementById("nr-contact").textContent = centrale ? "03" : "02"
  document.getElementById("nr-product").textContent = centrale ? "04" : "03"
  document.getElementById("titel-contact").textContent = centrale ? "Contactpersoon" : "Jouw gegevens"
  toonPrijs()
}

form.addEventListener("change", (e) => {
  if (e.target.name === "type") typeWissel()
  if (e.target.name === "product_id") toonPrijs()
})
form.aantal_plaatsen.addEventListener("input", toonPrijs)

// Vanaf de startpagina: /aanvragen/?type=centrale opent meteen de keuze voor een centrale.
if (new URLSearchParams(location.search).get("type") === "centrale") {
  form.type.value = "centrale"
  typeWissel()
}

form.addEventListener("submit", async (e) => {
  e.preventDefault()
  melding.classList.add("verborgen")
  const fd = Object.fromEntries(new FormData(form))
  fd.akkoord = form.akkoord.checked
  const knop = document.getElementById("verstuur")
  knop.disabled = true
  try {
    const res = await fetch("/api/aanvraag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fd),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.fout || "Versturen lukte niet. Probeer later opnieuw.")
    form.classList.add("verborgen")
    document.getElementById("bedankt").classList.remove("verborgen")
    window.scrollTo({ top: 0, behavior: "smooth" })
  } catch (err) {
    melding.textContent = err.message
    melding.classList.add("fout")
    melding.classList.remove("verborgen")
  } finally {
    knop.disabled = false
  }
})

laadProducten()
