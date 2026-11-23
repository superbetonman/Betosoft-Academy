const form = document.getElementById("form")
const productSel = document.getElementById("product")
const prijsEl = document.getElementById("prijs")
const melding = document.getElementById("melding")
let producten = []
const FR_NOM = { "CRS-BMC": "Formation complète chauffeur de camion malaxeur" }
let plateforme = null
// Les messages d'erreur du serveur sont en néerlandais : un message général en français, avec le détail entre parenthèses.
const FOUT_FR = (f) => (f ? `La demande n'a pas pu être envoyée. Vérifiez les champs obligatoires et le numéro de TVA. (${f})` : "L'envoi a échoué. Réessayez plus tard.")

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const euro = (n) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n))
const periode = (p) =>
  p.periode === "maand" ? "par mois" : p.periode === "jaar" ? "par an" : p.geldigheid_maanden ? `paiement unique, ${p.geldigheid_maanden} mois d'accès` : "paiement unique, ouverte tant que votre accès à la plateforme court"

async function laadProducten() {
  try {
    const res = await fetch("/api/producten")
    // En français : seules les formations disponibles en français (pour l'instant : chauffeur de camion malaxeur)
    const alle = (await res.json()).producten || []
    plateforme = alle.find((p) => p.code === "ABO-PLATFORM" && p.prijs_excl_btw !== null) || null
    producten = alle.filter((p) => FR_NOM[p.code])
  } catch {
    producten = []
  }
  const groepen = [["traject", "Formation complète"]]
  productSel.innerHTML =
    `<option value="">Faites un choix</option>` +
    groepen
      .map(([t, label]) => {
        const lijst = producten.filter((p) => p.type === t)
        return lijst.length ? `<optgroup label="${esc(label)}">${lijst.map((p) => `<option value="${p.id}">${esc(FR_NOM[p.code])}</option>`).join("")}</optgroup>` : ""
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
  if (p.prijs_excl_btw === null) return (prijsEl.textContent = `Prix sur demande · ${periode(p)}`)
  const tot = onderneming ? ` · ${n} places : ${euro(p.prijs_excl_btw * n)} hors TVA` : ""
  prijsEl.textContent = `${euro(p.prijs_excl_btw)} hors TVA ${onderneming ? "par place " : ""}· ${periode(p)}${tot}`
  if (plateforme && p.prijs_excl_btw !== null)
    prijsEl.textContent += `. S'y ajoute l'accès à la plateforme : ${euro(plateforme.prijs_excl_btw / 12)} par mois ${onderneming ? "par place" : "par personne"}, minimum un an (${euro(plateforme.prijs_excl_btw)} par an), sauf si vous l'avez déjà.`
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

  document.getElementById("titel-contact").textContent = onderneming ? "Personne de contact et gestionnaire" : "Vos coordonnées"
  document.getElementById("titel-facturatie").textContent = onderneming ? "Entreprise et facturation" : "Facturation"
  document.getElementById("label-bedrijf").textContent = onderneming ? "Nom de l'entreprise" : "Nom de la société"
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
  // Demande en français : signalé en tête de la remarque, pour répondre en français
  fd.opmerking = ("[FR] Aanvraag via de Franstalige site. " + (fd.opmerking || "")).trim().slice(0, 1000)
  const knop = document.getElementById("verstuur")
  knop.disabled = true
  try {
    const res = await fetch("/api/aanvraag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fd),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(FOUT_FR(body.fout))
    if (fd.type === "onderneming")
      document.getElementById("bedankt-tekst").textContent =
        "Merci. Nous envoyons la facture dès que possible. Après paiement, la personne de contact reçoit l'accès de gestionnaire par e-mail et crée ensuite elle-même les accès des collaborateurs."
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
