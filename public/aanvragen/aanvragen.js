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

const isOnderneming = () => form.type.value === "onderneming"

function toonPrijs() {
  const p = producten.find((x) => x.id === productSel.value)
  const onderneming = isOnderneming()
  const n = Math.max(1, Number(form.aantal_plaatsen.value) || 1)
  if (!p) return (prijsEl.textContent = "")
  if (p.prijs_excl_btw === null) return (prijsEl.textContent = `Prijs op aanvraag · ${periode(p)}`)
  const tot = onderneming ? ` · ${n} plaatsen: ${euro(p.prijs_excl_btw * n)} excl. btw` : ""
  prijsEl.textContent = `${euro(p.prijs_excl_btw)} excl. btw ${onderneming ? "per plaats " : ""}· ${periode(p)}${tot}`
  if (p.beschrijving) prijsEl.textContent += ` · ${p.beschrijving}`
}

// Bedrijfsgegevens: verplicht voor een onderneming, optioneel (vinkje) voor een persoon.
// Een uitgeschakelde fieldset gaat niet mee in het formulier.
function toonBedrijf() {
  const zichtbaar = isOnderneming() || form.factuur_bedrijf.checked
  const blok = document.getElementById("bedrijfblok")
  blok.classList.toggle("verborgen", !zichtbaar)
  blok.disabled = !zichtbaar
}

function typeWissel() {
  const onderneming = isOnderneming()
  const contact = document.getElementById("sec-contact")
  const facturatie = document.getElementById("sec-facturatie")
  const opleiding = document.getElementById("sec-opleiding")
  // Onderneming: eerst de onderneming, dan de contactpersoon. Persoon: eerst jezelf, dan de facturatie.
  if (onderneming) opleiding.before(facturatie, contact)
  else opleiding.before(contact, facturatie)
  form.querySelectorAll("section .nr").forEach((el, i) => (el.textContent = String(i + 2).padStart(2, "0")))

  document.getElementById("titel-contact").textContent = onderneming ? "Contactpersoon en beheerder" : "Jouw gegevens"
  document.getElementById("titel-facturatie").textContent = onderneming ? "Onderneming en facturatie" : "Facturatie"
  document.getElementById("label-bedrijf").textContent = onderneming ? "Naam onderneming" : "Naam bedrijf"
  document.getElementById("beheerinfo").classList.toggle("verborgen", !onderneming)
  document.getElementById("bedrijfkeuze").classList.toggle("verborgen", onderneming)
  document.getElementById("plaatsenblok").classList.toggle("verborgen", !onderneming)
  toonBedrijf()
  toonPrijs()
}

form.addEventListener("change", (e) => {
  if (e.target.name === "type") typeWissel()
  if (e.target.name === "factuur_bedrijf") {
    toonBedrijf()
    if (form.factuur_bedrijf.checked) form.organisatie_naam.focus()
  }
  if (e.target.name === "product_id") toonPrijs()
})
form.aantal_plaatsen.addEventListener("input", toonPrijs)
form.btw_nummer.addEventListener("blur", () => {
  // Spaties en punten weg, hoofdletters; een Belgisch nummer zonder landcode krijgt BE.
  const v = form.btw_nummer.value.replace(/[\s.\-]/g, "").toUpperCase()
  form.btw_nummer.value = /^[01]\d{9}$/.test(v) ? `BE${v}` : v
})

// Vanaf de startpagina: /aanvragen/?type=onderneming opent meteen de keuze voor een onderneming (oude links: ?type=centrale).
if (["onderneming", "centrale"].includes(new URLSearchParams(location.search).get("type"))) {
  form.type.value = "onderneming"
}
typeWissel()

form.addEventListener("submit", async (e) => {
  e.preventDefault()
  melding.classList.add("verborgen")
  const fd = Object.fromEntries(new FormData(form))
  fd.akkoord = form.akkoord.checked
  fd.factuur_bedrijf = form.factuur_bedrijf.checked
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
    if (fd.type === "onderneming")
      document.getElementById("bedankt-tekst").textContent =
        "Bedankt. We bezorgen zo snel mogelijk de factuur. Na betaling krijgt de contactpersoon per e-mail toegang als beheerder en maakt dan zelf de logins aan voor de medewerkers."
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
