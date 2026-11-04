/* Betosoft Academy — lichte of donkere modus.
   Laad dit script in <head> (zonder defer), zodat de keuze al geldt voor de eerste weergave.
   Zonder keuze volgt de site het toestel (prefers-color-scheme). De keuze wordt bewaard in de browser
   en geldt ook in de cursussen (cursus-academie.js leest dezelfde sleutel).
   De knop komt vanzelf in de kopbalk (.kop .rechts of .kop-in). */
(function () {
  "use strict"
  var SLEUTEL = "academie-thema"
  var ZON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  var MAAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'

  function lees() {
    try { return localStorage.getItem(SLEUTEL) } catch (e) { return null }
  }
  function pasToe(t) {
    var r = document.documentElement
    if (t === "licht") r.setAttribute("data-theme", "light")
    else if (t === "donker") r.setAttribute("data-theme", "dark")
    else r.removeAttribute("data-theme")
  }
  function huidig() {
    var t = lees()
    if (t === "licht" || t === "donker") return t
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "donker" : "licht"
  }
  function zet(t) {
    try { localStorage.setItem(SLEUTEL, t) } catch (e) {}
    pasToe(t)
    werkKnoppenBij()
  }
  function werkKnoppenBij() {
    var donker = huidig() === "donker"
    var knoppen = document.querySelectorAll("[data-themaknop]")
    for (var i = 0; i < knoppen.length; i++) {
      var b = knoppen[i]
      b.innerHTML = donker ? ZON : MAAN
      b.setAttribute("aria-label", donker ? "Naar lichte modus" : "Naar donkere modus")
      b.title = donker ? "Lichte modus" : "Donkere modus"
    }
  }
  function maakKnop(klasse) {
    var b = document.createElement("button")
    b.type = "button"
    b.className = klasse || "themaknop"
    b.setAttribute("data-themaknop", "")
    b.addEventListener("click", function () { zet(huidig() === "donker" ? "licht" : "donker") })
    return b
  }

  pasToe(lees())
  window.academieThema = { huidig: huidig, zet: zet, maakKnop: maakKnop, werkKnoppenBij: werkKnoppenBij }

  function voegKnopToe() {
    if (document.querySelector("[data-themaknop]")) return werkKnoppenBij()
    var rechts = document.querySelector(".kop .rechts")
    var kop = document.querySelector(".kop .kop-in")
    if (!rechts && !kop) return
    var b = maakKnop()
    if (rechts) rechts.insertBefore(b, rechts.firstChild)
    else { b.style.marginLeft = "auto"; kop.appendChild(b) }
    werkKnoppenBij()
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", voegKnopToe)
  else voegKnopToe()
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)")
    var bij = function () { if (!lees()) werkKnoppenBij() }
    if (mq.addEventListener) mq.addEventListener("change", bij)
    else if (mq.addListener) mq.addListener(bij)
  }
})()
