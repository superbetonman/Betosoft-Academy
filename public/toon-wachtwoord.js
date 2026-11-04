// Oogknop bij elk wachtwoordveld: het wachtwoord tonen of weer verbergen.
// Werkt ook voor velden die later op de pagina komen (formulieren in beheer en in het portaal van de onderneming).
// Bij het versturen staat elk veld terug op "password": zo blijft de wachtwoordbeheerder van de browser
// (Chrome, Safari, iCloud-sleutelhanger) het formulier herkennen, het wachtwoord invullen en een nieuw wachtwoord bewaren.
const OOG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
const OOG_DICHT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>'

let teller = 0

function zet(input, knop, tonen) {
  input.type = tonen ? "text" : "password"
  knop.setAttribute("aria-pressed", String(tonen))
  knop.setAttribute("aria-label", tonen ? "Wachtwoord verbergen" : "Wachtwoord tonen")
  knop.title = tonen ? "Wachtwoord verbergen" : "Wachtwoord tonen"
  knop.innerHTML = tonen ? OOG_DICHT : OOG
}

function verrijk(input) {
  if (input.dataset.oog) return
  input.dataset.oog = "1"
  // iPhone: geen hoofdletter, autocorrectie of woordsuggestie terwijl het wachtwoord zichtbaar is
  input.setAttribute("autocapitalize", "none")
  input.setAttribute("autocorrect", "off")
  input.spellcheck = false
  if (!input.id) input.id = `ww-${++teller}`
  const hadFocus = document.activeElement === input
  const vak = document.createElement("span")
  vak.className = "ww"
  const knop = document.createElement("button")
  knop.type = "button"
  knop.className = "ww-oog"
  knop.setAttribute("aria-controls", input.id)
  input.before(vak)
  vak.append(input, knop)
  zet(input, knop, false)
  if (hadFocus) input.focus()
  // de focus (en het toetsenbord) in het veld houden bij een tik op het oog
  knop.addEventListener("mousedown", (e) => e.preventDefault())
  knop.addEventListener("click", () => zet(input, knop, input.type === "password"))
}

function verbergAlles(form) {
  if (!(form instanceof HTMLFormElement)) return
  for (const input of form.querySelectorAll("input[data-oog]")) {
    const knop = input.nextElementSibling
    if (input.type !== "password" && knop?.classList.contains("ww-oog")) zet(input, knop, false)
  }
}

function zoek(el) {
  if (!(el instanceof Element)) return
  if (el.matches('input[type="password"]')) verrijk(el)
  else el.querySelectorAll('input[type="password"]').forEach(verrijk)
}

zoek(document.body)
new MutationObserver((lijst) => lijst.forEach((m) => m.addedNodes.forEach(zoek))).observe(document.body, { childList: true, subtree: true })
// in de capturefase op window: vóór elke andere luisteraar, ook die van de wachtwoordbeheerder van de browser
window.addEventListener("submit", (e) => verbergAlles(e.target), true)
window.addEventListener("reset", (e) => verbergAlles(e.target), true)
