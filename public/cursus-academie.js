/* Betosoft Academie — brug voor de cursusapps.
   De cursussen zijn gebouwd als losse apps die hun voortgang bewaren via window.claude.use("db" | "user" | "downloads").
   Dit script levert dezelfde functies, maar dan met de academie: de voortgang komt per gebruiker en per cursus in de
   databank van de academie (/api/leren/gegevens/<cursus>). In een demo is er geen account: de app bewaart dan enkel in de browser.
   Het script voegt ook de disclaimer, de demoband en de foutmelder toe. */
(function () {
  "use strict"
  var A = window.ACADEMIE || {}

  // ---------- Lichte of donkere modus: dezelfde keuze als op de site (thema.js) ----------
  var THEMA = "academie-thema"
  function themaLees() { try { return localStorage.getItem(THEMA) } catch (e) { return null } }
  function themaPas(t) {
    var r = document.documentElement
    if (t === "licht") r.setAttribute("data-theme", "light")
    else if (t === "donker") r.setAttribute("data-theme", "dark")
    else r.removeAttribute("data-theme")
  }
  function themaHuidig() {
    var t = themaLees()
    if (t === "licht" || t === "donker") return t
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "donker" : "licht"
  }
  themaPas(themaLees())
  var cursus = String(A.cursus || "")
  var basis = "/api/leren/gegevens/" + encodeURIComponent(cursus)

  function fout(status) {
    var e = new Error("Fout " + status)
    e.code = status === 401 || status === 403 ? "not_granted" : status === 413 || status === 400 ? "invalid_argument" : "unavailable"
    return e
  }
  function api(pad, opties) {
    var o = { credentials: "same-origin", headers: { "content-type": "application/json", "x-academie": "1" } }
    for (var k in opties || {}) o[k] = opties[k]
    return fetch(pad, o).then(function (r) {
      if (!r.ok) throw fout(r.status)
      return r.json()
    })
  }

  var gebruiker = A.demo
    ? Promise.resolve(null)
    : fetch("/api/sessie", { credentials: "same-origin" })
        .then(function (r) { return r.json() })
        .then(function (s) { return s && s.aangemeld ? s.gebruiker : null })
        .catch(function () { return null })

  var db = {
    doc: function (pad) {
      return {
        get: function () {
          return api(basis + "?pad=" + encodeURIComponent(pad)).then(function (d) {
            return { exists: !!d.bestaat, id: String(pad).split("/").pop(), data: function () { return d.data } }
          })
        },
        set: function (data) {
          return api(basis, { method: "PUT", body: JSON.stringify({ pad: pad, data: data }) }).then(function () {})
        },
        delete: function () {
          return api(basis + "?pad=" + encodeURIComponent(pad), { method: "DELETE" }).then(function () {})
        },
      }
    },
    collection: function (pad) {
      return {
        get: function () {
          return api(basis + "?map=" + encodeURIComponent(pad)).then(function (d) {
            return { docs: (d.docs || []).map(function (x) { return { id: x.id, data: function () { return x.data } } }) }
          })
        },
      }
    },
  }
  var user = { id: function () { return gebruiker.then(function (g) { return g ? g.id : null }) } }
  var downloads = {
    save: function (o) {
      var data = o && o.data
      var blob = data instanceof Blob ? data : new Blob([data == null ? "" : data], { type: /\.html?$/i.test(o.filename || "") ? "text/html;charset=utf-8" : "text/plain;charset=utf-8" })
      var a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = (o && o.filename) || "bestand"
      document.body.appendChild(a)
      a.click()
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 1500)
      return Promise.resolve()
    },
  }
  window.claude = {
    use: function (naam) {
      if (naam === "downloads") return Promise.resolve(downloads)
      if (naam === "db" || naam === "user") return gebruiker.then(function (g) { return g ? (naam === "db" ? db : user) : null })
      return Promise.resolve(null)
    },
  }

  // ---------- Disclaimer, demoband en foutmelder ----------
  var DISCLAIMER = "De cursussen zijn met de grootste zorg samengesteld. Raadpleeg in geval van twijfel altijd de normatieve documenten en reglementen; die blijven de referentie."
  var css =
    ".academie-onder{max-width:1180px;margin:28px auto 0;padding:14px 0 0;border-top:1px solid rgba(127,127,127,.35);font:13px/1.5 'IBM Plex Sans',system-ui,sans-serif;opacity:.85}" +
    ".academie-onder a{color:inherit}" +
    ".academie-onder p{margin:0 0 6px}" +
    ".academie-demo{max-width:1180px;margin:0 auto 22px;padding:12px 14px;border:1px solid #C06B3E;border-left-width:4px;border-radius:4px;background:rgba(192,107,62,.08);font:14px/1.45 'IBM Plex Sans',system-ui,sans-serif;display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center}" +
    ".academie-demo b{font-weight:700}" +
    ".academie-demo span{flex:1 1 280px}" +
    ".academie-demo a{display:inline-flex;align-items:center;min-height:36px;padding:6px 12px;border-radius:4px;text-decoration:none;font-weight:600;border:1px solid #1E5A66;color:#1E5A66;background:transparent}" +
    ".academie-demo a.hoofd{background:#B25C31;border-color:#B25C31;color:#fff}" +
    ".academie-beheer{border-color:#1E5A66;background:rgba(30,90,102,.07)}" +
    ".academie-thema{appearance:none;flex:none;margin-left:8px;width:38px;height:38px;padding:0;border-radius:8px;display:inline-grid;place-items:center;cursor:pointer;" +
    "border:1px solid var(--line, rgba(127,127,127,.45));background:var(--surface, transparent);color:var(--ink, inherit)}" +
    ".academie-thema svg{width:18px;height:18px}" +
    "@media (prefers-color-scheme:dark){.academie-demo a{color:#6FB0BC;border-color:#6FB0BC}}"

  var ZON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  var MAAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  function themaKnop() {
    var b = document.createElement("button")
    b.type = "button"
    b.className = "academie-thema"
    var teken = function () {
      var d = themaHuidig() === "donker"
      b.innerHTML = d ? ZON : MAAN
      b.setAttribute("aria-label", d ? "Naar lichte modus" : "Naar donkere modus")
      b.title = d ? "Lichte modus" : "Donkere modus"
    }
    b.addEventListener("click", function () {
      var t = themaHuidig() === "donker" ? "licht" : "donker"
      try { localStorage.setItem(THEMA, t) } catch (e) {}
      themaPas(t)
      teken()
    })
    teken()
    return b
  }

  function voegToe() {
    var st = document.createElement("style")
    st.textContent = css
    document.head.appendChild(st)
    // knop in de bovenbalk van de cursus (anders rechtsboven op het scherm)
    var balk = document.querySelector("header.top .top-in") || document.querySelector("header.top")
    var knop = themaKnop()
    if (balk) balk.appendChild(knop)
    else { knop.style.position = "fixed"; knop.style.top = "10px"; knop.style.right = "10px"; knop.style.zIndex = "50"; document.body.appendChild(knop) }
    var main = document.getElementById("main") || document.body
    if (A.demo) {
      var band = document.createElement("div")
      band.className = "academie-demo"
      band.setAttribute("role", "note")
      band.innerHTML =
        "<span><b>Demo.</b> Je bekijkt een voorproefje van deze cursus: de start en vier lessen uit verschillende modules. De andere lessen, opdrachten en toetsen zitten in de volledige cursus.</span>" +
        (A.product ? '<a class="hoofd" href="/aanvragen/?product=' + encodeURIComponent(A.product) + '">Inschrijven</a>' : "") +
        '<a href="/#cursussen">Alle cursussen</a>'
      main.insertBefore(band, main.firstChild)
    }
    if (A.beheer) {
      var bh = document.createElement("div")
      bh.className = "academie-demo academie-beheer"
      bh.setAttribute("role", "note")
      bh.innerHTML = "<span><b>Beheerdersversie.</b> Je ziet de opnamebriefings, AI-prompts en het mediaplan. Cursisten krijgen de cursus zonder die productie-informatie; de beeldvakken staan bij hen als placeholder.</span>"
      main.insertBefore(bh, main.firstChild)
    }
    var onder = document.createElement("div")
    onder.className = "academie-onder"
    onder.innerHTML =
      "<p>" + DISCLAIMER + "</p>" +
      '<p><a href="' + (A.demo ? "/#cursussen" : "/leren/") + '">' + (A.demo ? "Terug naar de Betosoft Academie" : "Terug naar mijn opleidingen") + "</a> · Betosoft Academie</p>"
    main.appendChild(onder)
    var f = document.createElement("script")
    f.type = "module"
    f.src = "/fout.js"
    document.body.appendChild(f)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", voegToe)
  else voegToe()
})()
