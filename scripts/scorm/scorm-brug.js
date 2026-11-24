/* Betosoft Academy — SCORM 1.2-brug voor een cursusapp in een LMS (getest voor TalentLMS).
   De cursusapps bewaren hun voortgang via window.claude.use("db" | "user" | "downloads"); op de site levert
   public/cursus-academie.js die functies. In een SCORM-pakket neemt dit script die plaats in, met het LMS als opslag:
   - de voortgang (done, tasks, quiz, last) gaat compact in cmi.suspend_data (SCORM 1.2: maximaal 4096 tekens);
   - status: "incomplete" tot alle lessen van de modules die online staan af zijn, daarna "passed"
     (een toets telt in de app pas als afgerond als ze geslaagd is, een praktijkopdracht als alles afgevinkt is);
     een behaalde status gaat nooit terug naar "incomplete";
   - score: het gemiddelde van de beste score per afgelegde toets, in procent;
   - cmi.core.lesson_location = de laatst geopende les, cmi.core.exit = "suspend" (de volgende keer gaat het verder);
   - de kopie in de browser krijgt de student_id van het LMS in de sleutel, zodat twee cursisten op hetzelfde
     toestel elkaars voortgang niet zien.
   Zonder LMS (pakket los geopend) werkt de app zoals in een demo: de voortgang blijft enkel in de browser.
   Instellingen (door maak-scorm.mjs): window.SCORM_PAKKET = { cursus, sleutel } met sleutel = de localStorage-sleutel
   van de app (const LS_KEY), nodig om bij het afsluiten de laatste wijzigingen nog door te geven. */
(function () {
  "use strict"
  var CFG = window.SCORM_PAKKET || {}
  var MAX = 4096

  // ---------- De SCORM 1.2-API van het LMS zoeken (in de ouderframes, dan in het venster dat ons opende) ----------
  function zoek(w) {
    for (var n = 0; w && n < 12; n++) {
      try { if (w.API) return w.API } catch (e) { return null }
      if (!w.parent || w.parent === w) break
      w = w.parent
    }
    return null
  }
  var api = zoek(window)
  try { if (!api && window.top && window.top.opener) api = zoek(window.top.opener) } catch (e) {}
  try { if (!api && window.opener) api = zoek(window.opener) } catch (e) {}

  var actief = false
  if (api) {
    try {
      actief = String(api.LMSInitialize("")) === "true" || String(api.LMSGetLastError()) === "101" // 101: al gestart
    } catch (e) { actief = false }
  }
  function lees(k) { try { return actief ? String(api.LMSGetValue(k) == null ? "" : api.LMSGetValue(k)) : "" } catch (e) { return "" } }
  function zet(k, v) { try { return actief && String(api.LMSSetValue(k, String(v))) === "true" } catch (e) { return false } }
  function bewaar() { try { if (actief) api.LMSCommit("") } catch (e) {} }

  var student = lees("cmi.core.student_id")
  var modus = lees("cmi.core.lesson_mode")
  var alleenLezen = modus === "review" || modus === "browse"
  var status = lees("cmi.core.lesson_status")
  var gestart = Date.now()
  if (actief && !alleenLezen) {
    if (!status || status === "not attempted") { if (zet("cmi.core.lesson_status", "incomplete")) status = "incomplete" }
    zet("cmi.core.exit", "suspend")
    bewaar()
  }

  // ---------- Kopie in de browser per cursist ----------
  if (actief && student) {
    var voor = "scorm:" + student + ":"
    var S = window.Storage && Storage.prototype
    if (S) {
      var gi = S.getItem, si = S.setItem, ri = S.removeItem
      var eigen = function (o) { try { return o === window.localStorage } catch (e) { return false } }
      S.getItem = function (k) { return gi.call(this, eigen(this) ? voor + k : k) }
      S.setItem = function (k, v) { return si.call(this, eigen(this) ? voor + k : k, v) }
      S.removeItem = function (k) { return ri.call(this, eigen(this) ? voor + k : k) }
    }
  }

  // ---------- Voortgang <-> suspend_data ----------
  // Compact: tijdstippen in minuten (base 36), taken per opdracht gegroepeerd, toetsen als [beste, totaal, tijdstip].
  // Past het niet in 4096 tekens, dan zonder tijdstippen.
  function min36(t) { return typeof t === "number" && t > 0 ? Math.round(t / 60000).toString(36) : "" }
  function van36(s) { var n = parseInt(s, 36); return isFinite(n) && n > 0 ? n * 60000 : 1 }
  function pak(P, kort) {
    var c = { v: 1 }
    var done = P.done || {}, tasks = P.tasks || {}, quiz = P.quiz || {}
    var dk = Object.keys(done).filter(function (k) { return done[k] })
    if (kort) c.d = dk
    else { c.d = {}; dk.forEach(function (k) { c.d[k] = min36(done[k]) }) }
    c.t = {}
    Object.keys(tasks).forEach(function (k) {
      if (!tasks[k]) return
      var i = k.lastIndexOf(":")
      var a = i < 0 ? "" : k.slice(0, i), b = i < 0 ? k : k.slice(i + 1)
      ;(c.t[a] = c.t[a] || []).push(b)
    })
    c.q = {}
    Object.keys(quiz).forEach(function (k) {
      var q = quiz[k]
      if (q && typeof q === "object") c.q[k] = kort ? [q.best || 0, q.total || 0] : [q.best || 0, q.total || 0, min36(q.at)]
    })
    if (P.last) c.l = String(P.last)
    if (!kort) c.u = min36(P.updatedAt)
    return JSON.stringify(c)
  }
  function pakUit(s) {
    var c
    try { c = JSON.parse(s) } catch (e) { return null }
    if (!c || typeof c !== "object") return null
    var P = { v: 1, done: {}, tasks: {}, quiz: {}, last: c.l || null, updatedAt: c.u ? van36(c.u) : 0 }
    if (Array.isArray(c.d)) c.d.forEach(function (k) { P.done[k] = 1 })
    else Object.keys(c.d || {}).forEach(function (k) { P.done[k] = c.d[k] ? van36(c.d[k]) : 1 })
    Object.keys(c.t || {}).forEach(function (a) { (c.t[a] || []).forEach(function (b) { P.tasks[a ? a + ":" + b : b] = true }) })
    Object.keys(c.q || {}).forEach(function (k) {
      var q = c.q[k]
      if (Array.isArray(q)) P.quiz[k] = { best: q[0] || 0, total: q[1] || 0, at: q[2] ? van36(q[2]) : 0 }
    })
    return P
  }
  // zelfde regels als merge() in de app: alles wat ergens af is, blijft af; per toets de beste score
  function samen(a, b) {
    if (!a) return b
    if (!b) return a
    var P = JSON.parse(JSON.stringify(a))
    P.done = P.done || {}; P.tasks = P.tasks || {}; P.quiz = P.quiz || {}
    Object.keys(b.done || {}).forEach(function (k) { if (b.done[k] && !P.done[k]) P.done[k] = b.done[k] })
    Object.keys(b.tasks || {}).forEach(function (k) { if (b.tasks[k]) P.tasks[k] = true })
    Object.keys(b.quiz || {}).forEach(function (k) {
      var q = b.quiz[k], cur = P.quiz[k]
      if (q && (!cur || (q.best || 0) > (cur.best || 0))) P.quiz[k] = q
    })
    if ((b.updatedAt || 0) > (P.updatedAt || 0)) { if (b.last) P.last = b.last; P.updatedAt = b.updatedAt }
    return P
  }

  var inLms = actief ? pakUit(lees("cmi.suspend_data")) : null

  // ---------- Status, score en plaats voor het LMS ----------
  function lessen() {
    var C = null
    try { C = typeof window.ACADEMIE_COURSE === "function" ? window.ACADEMIE_COURSE() : null } catch (e) { C = null }
    var uit = []
    ;(C || []).forEach(function (m) { if (m && m.avail) (m.lessons || []).forEach(function (l) { if (l && l.id) uit.push(l) }) })
    return uit
  }
  function meld(P) {
    var L = lessen()
    if (L.length) {
      var done = P.done || {}, quiz = P.quiz || {}
      var af = L.filter(function (l) { return done[l.id] }).length
      var toetsen = L.filter(function (l) { return l.kind === "toets" })
      var gemaakt = toetsen.map(function (l) { return quiz[l.id] }).filter(function (q) { return q && q.total > 0 })
      if (gemaakt.length) {
        var som = gemaakt.reduce(function (s, q) { return s + Math.min(1, (q.best || 0) / q.total) }, 0)
        zet("cmi.core.score.min", "0")
        zet("cmi.core.score.max", "100")
        zet("cmi.core.score.raw", String(Math.round((som / gemaakt.length) * 100)))
      }
      if (status !== "passed" && status !== "completed") {
        var nieuw = af === L.length ? (toetsen.length ? "passed" : "completed") : "incomplete"
        if (nieuw !== status && zet("cmi.core.lesson_status", nieuw)) status = nieuw
      }
    }
    if (P.last) zet("cmi.core.lesson_location", String(P.last).slice(0, 255))
  }
  function schrijf(P) {
    if (!actief) return false
    if (alleenLezen) return true
    var s = pak(P, false)
    if (s.length > MAX || !zet("cmi.suspend_data", s)) {
      s = pak(P, true)
      if (s.length <= MAX) zet("cmi.suspend_data", s)
    }
    meld(P)
    bewaar()
    inLms = JSON.parse(JSON.stringify(P))
    return true
  }

  // ---------- De functies die de app verwacht ----------
  var verbonden = false
  function fout(code) { var e = new Error(code); e.code = code; return e }
  var db = {
    doc: function (pad) {
      var id = String(pad).split("/").pop()
      return {
        get: function () {
          verbonden = true
          var kopie = inLms ? JSON.parse(JSON.stringify(inLms)) : null
          return Promise.resolve({ exists: !!kopie, id: id, data: function () { return kopie } })
        },
        set: function (data) { return schrijf(data || {}) ? Promise.resolve() : Promise.reject(fout("unavailable")) },
        delete: function () { inLms = null; zet("cmi.suspend_data", ""); bewaar(); return Promise.resolve() },
      }
    },
    collection: function () { return { get: function () { return Promise.resolve({ docs: [] }) } } },
  }
  var user = { id: function () { return Promise.resolve(student || "scorm") } }
  var downloads = {
    save: function (o) {
      var data = o && o.data
      var blob = data instanceof Blob ? data : new Blob([data == null ? "" : data], { type: /\.html?$/i.test((o && o.filename) || "") ? "text/html;charset=utf-8" : "text/plain;charset=utf-8" })
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
      if (naam === "db") return Promise.resolve(actief ? db : null)
      if (naam === "user") return Promise.resolve(actief ? user : null)
      return Promise.resolve(null)
    },
  }

  // ---------- Afsluiten: laatste wijzigingen, tijd en LMSFinish ----------
  // De app wacht even voor ze bewaart; wat in die tijd veranderde, staat al in de browser en gaat nu mee.
  function duur(ms) {
    var s = Math.max(0, Math.round(ms / 1000))
    var p = function (n) { return (n < 10 ? "0" : "") + n }
    return p(Math.min(9999, Math.floor(s / 3600))) + ":" + p(Math.floor((s % 3600) / 60)) + ":" + p(s % 60)
  }
  var gestopt = false
  function stop() {
    if (!actief || gestopt) return
    gestopt = true
    try {
      if (!alleenLezen) {
        var lokaal = null
        if (CFG.sleutel) { try { lokaal = JSON.parse(window.localStorage.getItem(CFG.sleutel) || "null") } catch (e) { lokaal = null } }
        if (lokaal && typeof lokaal === "object") schrijf(verbonden ? lokaal : samen(inLms, lokaal))
        zet("cmi.core.session_time", duur(Date.now() - gestart))
        zet("cmi.core.exit", "suspend")
        bewaar()
      }
      api.LMSFinish("")
    } catch (e) {}
  }
  window.addEventListener("pagehide", stop)
  window.addEventListener("beforeunload", stop)
})()
