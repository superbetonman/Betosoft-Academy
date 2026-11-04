/* Betosoft Academie — brug voor de cursusapps.
   De cursussen zijn gebouwd als losse apps die hun voortgang bewaren via window.claude.use("db" | "user" | "downloads").
   Dit script levert dezelfde functies, maar dan met de academie: de voortgang komt per gebruiker en per cursus in de
   databank van de academie (/api/leren/gegevens/<cursus>). In een demo is er geen account: de app bewaart dan enkel in de browser.
   Verder:
   - menubalk boven de cursus (startpagina, mijn leerlijn, scores) en een knop naar de startpagina in de bovenbalk van de app;
   - de lessenlijst van de app (window.ACADEMIE_COURSE, of de modules op de pagina bij BT1/BT2) gaat naar de academie
     (/api/leren/structuur/<cursus>), zodat leerlijn, scores en attesten weten hoeveel lessen en toetsen er zijn;
   - BT1 en BT2 bewaren hun voortgang zelf enkel in de browser: die wordt hier met het account gesynchroniseerd;
   - een afgeleide cursus (BMC, BPB) gebruikt de app van haar bron (BMC-BPB): window.ACADEMIE_FILTER laat de modules van
     het andere traject weg en past titel en inleiding aan; de voortgang staat bij de bron (A.gegevens), zodat de
     gemeenschappelijke basis maar één keer gevolgd wordt;
   - disclaimer, demoband en foutmelder. */
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
  // voortgang: bij de bron als de cursus van een bron afgeleid is (gedeelde basis), anders bij de cursus zelf
  var basis = "/api/leren/gegevens/" + encodeURIComponent(String(A.gegevens || cursus))

  // ---------- Afgeleide cursus: enkel haar modules, met haar titel ----------
  // De app roept dit op direct na `const COURSE = [...]` (haak uit bouw.mjs / haak-filter.mjs), vóór ze iets toont.
  window.ACADEMIE_FILTER = function (C, M) {
    if (Array.isArray(A.modules) && Array.isArray(C)) {
      var houd = {}
      A.modules.forEach(function (id) { houd[id] = 1 })
      for (var i = C.length - 1; i >= 0; i--) if (!C[i] || !houd[C[i].id]) C.splice(i, 1)
    }
    if (M && A.meta && typeof A.meta === "object") for (var k in A.meta) M[k] = A.meta[k]
  }
  if (A.meta && A.meta.title) {
    var zetTitel = function () { document.title = A.meta.title }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", zetTitel)
    else zetTitel()
  }

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

  var sessie = fetch("/api/sessie", { credentials: "same-origin" }).then(function (r) { return r.json() }).catch(function () { return null })
  // in een demo geen account: de app bewaart enkel in de browser (de sessie dient er enkel voor de menubalk)
  var gebruiker = sessie.then(function (s) { return !A.demo && s && s.aangemeld ? s.gebruiker : null })

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

  // ---------- BT1 en BT2: voortgang uit de browser naar het account ----------
  // Die apps bewaren { m1: true, ..., toets: true } onder een eigen sleutel in localStorage.
  // We bewaren dezelfde gegevens in het voortgangsdocument van de academie (done = module -> tijdstip), zodat leerlijn,
  // scores en attesten ze kennen, en zetten wat op het account staat terug in de browser (ander toestel).
  var LOKAAL = { BT1: "betosoft-basis10-v2", BT2: "betosoft-tech20-v2" }
  var lokaalSleutel = !A.demo && LOKAAL[cursus]
  if (lokaalSleutel) {
    var origSet = Storage.prototype.setItem
    var lokaalPad = null
    var lokaalDone = {}
    var laatstVerstuurd = ""
    var lokaalTimer = null
    var leesLokaal = function () {
      try { return JSON.parse(localStorage.getItem(lokaalSleutel) || "{}") || {} } catch (e) { return {} }
    }
    var stuurLokaal = function () {
      if (!lokaalPad) return
      var lokaal = leesLokaal()
      var done = {}
      Object.keys(lokaal).forEach(function (k) { if (lokaal[k]) done[k] = lokaalDone[k] || Date.now() })
      var kern = JSON.stringify({ d: Object.keys(done).sort(), l: lokaal })
      if (kern === laatstVerstuurd) return
      laatstVerstuurd = kern
      lokaalDone = done
      db.doc(lokaalPad).set({ v: 1, bron: "lokaal", done: done, quiz: {}, tasks: {}, lokaal: lokaal, updatedAt: Date.now() }).catch(function () { laatstVerstuurd = "" })
    }
    Storage.prototype.setItem = function (k, v) {
      origSet.apply(this, arguments)
      if (k === lokaalSleutel && this === window.localStorage) {
        clearTimeout(lokaalTimer)
        lokaalTimer = setTimeout(stuurLokaal, 600)
      }
    }
    gebruiker.then(function (g) {
      if (!g) return
      lokaalPad = "data/users/" + g.id + "/progress"
      return db.doc(lokaalPad).get().then(function (snap) {
        var server = snap.exists ? snap.data() || {} : {}
        lokaalDone = server.done || {}
        var lokaal = leesLokaal()
        var srv = server.lokaal || {}
        var nieuw = Object.keys(srv).filter(function (k) { return srv[k] && !lokaal[k] })
        if (nieuw.length) {
          nieuw.forEach(function (k) { lokaal[k] = srv[k] })
          origSet.call(window.localStorage, lokaalSleutel, JSON.stringify(lokaal))
          // de app las de browser al bij het laden: één keer herladen om de voortgang van het account te tonen
          var vlag = "academie-herladen-" + cursus
          var al = false
          try { al = sessionStorage.getItem(vlag) === "1"; sessionStorage.setItem(vlag, "1") } catch (e) { al = true }
          if (!al) { location.reload(); return }
        }
        stuurLokaal()
      })
    }).catch(function () {})
  }

  // ---------- Lessenlijst van de app naar de academie ----------
  var SOORTEN = { les: 1, toets: 1, opdracht: 1 }
  function tekst(v, max) { return v === null || v === undefined ? "" : String(v).slice(0, max || 200) }
  function structuur() {
    var C = null
    if (typeof window.ACADEMIE_COURSE === "function") { try { C = window.ACADEMIE_COURSE() } catch (e) { C = null } }
    if (C && C.length) {
      return {
        v: 1,
        soort: "app",
        modules: C.filter(function (m) { return m && m.id }).map(function (m) {
          return {
            id: tekst(m.id, 40), n: tekst(m.n, 10), titel: tekst(m.title), sub: tekst(m.sub), avail: !!m.avail,
            lessen: (m.lessons || []).filter(function (l) { return l && l.id }).map(function (l) {
              return {
                id: tekst(l.id, 60), code: tekst(l.code, 20), titel: tekst(l.title),
                soort: SOORTEN[l.kind] ? l.kind : "les",
                vragen: Array.isArray(l.quiz) ? l.quiz.length : 0,
                min: typeof l.min === "number" ? l.min : null,
              }
            }),
          }
        }),
      }
    }
    // BT1, BT2: één zelftest per module en een eindtoets (data-quiz), elk in een eigen sectie
    var boxen = document.querySelectorAll("[data-quiz]")
    if (!boxen.length) return null
    var gezien = {}
    var modules = []
    for (var i = 0; i < boxen.length; i++) {
      var id = boxen[i].getAttribute("data-quiz")
      if (!id || gezien[id]) continue
      gezien[id] = 1
      var sectie = boxen[i].closest("section")
      var kop = sectie && sectie.querySelector("h1, h2")
      var titel = tekst(kop ? kop.textContent.replace(/\s+/g, " ").trim() : id)
      var nr = (id.match(/\d+/) || [""])[0]
      modules.push({
        id: id, n: id === "toets" ? "T" : nr, titel: titel || id, sub: "", avail: true,
        lessen: [{ id: id, code: nr, titel: id === "toets" ? "Eindtoets" : "Zelftest", soort: "toets", vragen: boxen[i].querySelectorAll("fieldset, .q, .vraag").length, min: null }],
      })
    }
    return { v: 1, soort: "pagina", modules: modules }
  }
  function meldStructuur() {
    var s = structuur()
    if (!s || !s.modules.length) return
    api("/api/leren/structuur/" + encodeURIComponent(cursus), { method: "PUT", body: JSON.stringify(s) }).catch(function () {})
  }

  // ---------- Menubalk, disclaimer, demoband en foutmelder ----------
  var DISCLAIMER = "De cursussen zijn met de grootste zorg samengesteld. Raadpleeg in geval van twijfel altijd de normatieve documenten en reglementen; die blijven de referentie."
  var css =
    ".academie-menu{background:#223840;color:#F3EFE7;border-bottom:1px solid #3A5560;font:14px/1.3 'IBM Plex Sans',system-ui,sans-serif;position:relative;z-index:30}" +
    ".academie-menu-in{display:flex;align-items:center;gap:6px 18px;padding:6px 16px;min-height:44px;overflow-x:auto;scrollbar-width:none;white-space:nowrap}" +
    ".academie-menu-in::-webkit-scrollbar{display:none}" +
    ".academie-menu a{color:#F3EFE7;text-decoration:none;border-bottom:1px solid transparent;padding:4px 0}" +
    ".academie-menu a:hover,.academie-menu a:focus-visible{border-bottom-color:#A9BDC3}" +
    ".academie-menu a:focus-visible{outline:2px solid #E39A6F;outline-offset:2px}" +
    ".academie-menu .am-logo{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:15px;border:0;margin-right:6px}" +
    ".academie-menu .am-logo img{width:24px;height:21px;display:block}" +
    ".academie-menu .am-logo em{font-style:normal;color:#E39A6F}" +
    ".academie-menu .am-zacht{color:#A9BDC3}" +
    ".academie-menu .am-actie{background:#B25C31;border:1px solid #B25C31;border-radius:4px;padding:4px 10px;font-weight:600}" +
    ".academie-menu .am-actie:hover{background:#A9532B;border-color:#A9532B}" +
    ".academie-menu .am-rechts{margin-left:auto;display:inline-flex;gap:12px;align-items:center}" +
    ".academie-menu .am-code{font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.04em;border:1px solid #3A5560;border-radius:4px;padding:1px 6px;color:#A9BDC3}" +
    "@media (max-width:560px){.academie-menu .am-tekst{display:none}}" +
    ".academie-onder{max-width:1180px;margin:28px auto 0;padding:14px 0 0;border-top:1px solid rgba(127,127,127,.35);font:13px/1.5 'IBM Plex Sans',system-ui,sans-serif;opacity:.85}" +
    ".academie-onder a{color:inherit}" +
    ".academie-onder p{margin:0 0 6px}" +
    ".academie-demo{max-width:1180px;margin:0 auto 22px;padding:12px 14px;border:1px solid #C06B3E;border-left-width:4px;border-radius:4px;background:rgba(192,107,62,.08);font:14px/1.45 'IBM Plex Sans',system-ui,sans-serif;display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center}" +
    ".academie-demo b{font-weight:700}" +
    ".academie-demo span{flex:1 1 280px}" +
    ".academie-demo a{display:inline-flex;align-items:center;min-height:36px;padding:6px 12px;border-radius:4px;text-decoration:none;font-weight:600;border:1px solid #1E5A66;color:#1E5A66;background:transparent}" +
    ".academie-demo a.hoofd{background:#B25C31;border-color:#B25C31;color:#fff}" +
    ".academie-beheer{border-color:#1E5A66;background:rgba(30,90,102,.07)}" +
    ".academie-thema,.academie-thuis{appearance:none;flex:none;margin-left:8px;width:38px;height:38px;padding:0;border-radius:8px;display:inline-grid;place-items:center;cursor:pointer;" +
    "border:1px solid var(--line, rgba(127,127,127,.45));background:var(--surface, transparent);color:var(--ink, inherit);text-decoration:none}" +
    ".academie-thema svg,.academie-thuis svg{width:18px;height:18px}" +
    "@media (prefers-color-scheme:dark){.academie-demo a{color:#6FB0BC;border-color:#6FB0BC}}" +
    "@media print{.academie-menu,.academie-thuis,.academie-thema{display:none!important}}" +
    // afgeleide cursus: de groep van het andere traject is leeg, dan ook de titel ervan niet tonen
    (Array.isArray(A.modules) ? ".sec-h:has(+ .mods:empty){display:none}" : "")

  var ZON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  var MAAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  var HUIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>'
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
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] })
  }

  // De menubalk: eerst zonder sessie (meteen zichtbaar), daarna aangevuld volgens de rol
  function menuHtml(s) {
    var aan = s && s.aangemeld
    var rol = aan && s.gebruiker ? s.gebruiker.rol : null
    var links = ['<a href="/">Startpagina</a>']
    if (A.demo) {
      links.push('<a href="/#cursussen">Alle cursussen</a>', '<a href="/prijzen/">Prijzen</a>')
      if (aan) links.push('<a href="/leren/">Mijn leerlijn</a>')
    } else {
      links.push('<a href="/leren/">Mijn leerlijn</a>', '<a href="/scores/">Scores</a>')
      if (rol === "centrale_verantwoordelijke") links.push('<a href="/centrale/">Mijn centrale</a>')
      if (rol === "beheerder" || rol === "superadmin") links.push('<a href="/beheer/">Beheer</a>')
    }
    var rechts = '<span class="am-code" title="Cursuscode">' + esc(cursus) + "</span>"
    if (A.demo && A.product) rechts += '<a class="am-actie" href="/aanvragen/?product=' + encodeURIComponent(A.product) + '">Inschrijven</a>'
    if (A.demo && !aan) rechts += '<a href="/aanmelden/?terug=' + encodeURIComponent("/cursus/" + cursus + "/") + '">Aanmelden</a>'
    return '<div class="academie-menu-in">' +
      '<a class="am-logo" href="/" aria-label="Betosoft Academie, startpagina"><img src="/logo.svg" alt="" width="24" height="21"><span class="am-tekst">Betosoft <em>Academie</em></span></a>' +
      links.join("") + '<span class="am-rechts">' + rechts + "</span></div>"
  }

  function voegToe() {
    var st = document.createElement("style")
    st.textContent = css
    document.head.appendChild(st)

    // menubalk boven de cursus
    var menu = document.createElement("nav")
    menu.className = "academie-menu"
    menu.setAttribute("aria-label", "Betosoft Academie")
    menu.innerHTML = menuHtml(null)
    document.body.insertBefore(menu, document.body.firstChild)
    sessie.then(function (s) { if (s) menu.innerHTML = menuHtml(s) })

    // knoppen in de bovenbalk van de cursus: startpagina en lichte/donkere modus (anders rechtsboven op het scherm)
    var balk = document.querySelector("header.top .top-in") || document.querySelector("header.top")
    var thuis = document.createElement("a")
    thuis.className = "academie-thuis"
    thuis.href = A.demo ? "/#cursussen" : "/leren/"
    thuis.title = A.demo ? "Terug naar de startpagina" : "Terug naar mijn leerlijn"
    thuis.setAttribute("aria-label", thuis.title)
    thuis.innerHTML = HUIS
    var knop = themaKnop()
    if (balk) { balk.appendChild(thuis); balk.appendChild(knop) }
    else { knop.style.position = "fixed"; knop.style.top = "52px"; knop.style.right = "10px"; knop.style.zIndex = "50"; document.body.appendChild(knop) }

    var main = document.getElementById("main") || document.body
    if (A.demo) {
      var band = document.createElement("div")
      band.className = "academie-demo"
      band.setAttribute("role", "note")
      band.innerHTML =
        "<span><b>Demo.</b> Je bekijkt een voorproefje van deze cursus: de start en enkele lessen uit verschillende modules. De andere lessen, opdrachten en toetsen zitten in de volledige cursus.</span>" +
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
      '<p><a href="/">Startpagina</a> · ' +
      (A.demo ? '<a href="/#cursussen">Alle cursussen</a>' : '<a href="/leren/">Mijn leerlijn</a> · <a href="/scores/">Scores</a>') +
      " · Betosoft Academie</p>"
    main.appendChild(onder)
    var f = document.createElement("script")
    f.type = "module"
    f.src = "/fout.js"
    document.body.appendChild(f)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", voegToe)
  else voegToe()

  // lessenlijst doorsturen zodra alles geladen is (ook de losse modulescripts)
  if (!A.demo) {
    var meld = function () { gebruiker.then(function (g) { if (g) setTimeout(meldStructuur, 1200) }) }
    if (document.readyState === "complete") meld()
    else window.addEventListener("load", meld)
  }
})()
