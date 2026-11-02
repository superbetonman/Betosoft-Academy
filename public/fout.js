// Betosoft Academie — foutmelder op elke pagina (ook in de cursussen), naar het model van de bevindingen in Betosoft.
// Knop rechts op het scherm › melding over dit scherm, een onderdeel aanduiden, of mijn meldingen bekijken.
// Werkt zonder stijlblad van de pagina: alle opmaak zit hieronder, met eigen klassen (bfm-).
const VERSIE = "academie 0.3"
const ERNST = [
  ["Blokkerend", "Een pagina of les werkt niet, of je raakt niet verder."],
  ["Inhoudelijke fout", "Een fout in de leerstof, een toetsvraag, een berekening of een normverwijzing."],
  ["Functioneel", "Iets werkt anders dan verwacht: een knop, link of formulier."],
  ["Tekst en vorm", "Taal, schrijffout, notatie of lay-out."],
  ["Wens", "Een idee of uitbreiding voor later."],
]
const H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"

if (!window.__foutmelder) {
  window.__foutmelder = true
  start()
}

function start() {
  const css = `
.bfm, .bfm * { box-sizing: border-box; font-family: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }
.bfm-tab { position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 2147483000; writing-mode: vertical-rl;
  background: #B25C31; color: #fff; border: 0; border-radius: 4px 0 0 4px; padding: 12px 7px; font-size: 13px; font-weight: 600; letter-spacing: .02em; cursor: pointer; }
.bfm-tab:hover { background: #A9532B; }
.bfm-tab:focus-visible, .bfm button:focus-visible, .bfm a:focus-visible, .bfm input:focus-visible, .bfm textarea:focus-visible { outline: 2px solid #1E5A66; outline-offset: 2px; }
.bfm-menu { position: fixed; right: 42px; top: 50%; transform: translateY(-50%); z-index: 2147483001; width: min(300px, calc(100vw - 60px));
  background: #fff; color: #223840; border: 1px solid #DCD4C7; border-radius: 4px; padding: 6px; }
.bfm-menu p { margin: 4px 8px 6px; font-size: 12px; color: #5a6b70; }
.bfm-menu button, .bfm-menu a { display: block; width: 100%; text-align: left; background: none; border: 0; border-radius: 4px; padding: 8px; cursor: pointer; color: #223840; text-decoration: none; }
.bfm-menu button:hover, .bfm-menu a:hover { background: #F3EFE7; }
.bfm-menu b { display: block; font-size: 14px; font-weight: 600; }
.bfm-menu small { display: block; font-size: 12px; color: #5a6b70; margin-top: 2px; }
.bfm-kies { position: fixed; z-index: 2147483002; border: 2px solid #B25C31; background: rgba(178, 92, 49, .08); border-radius: 4px; pointer-events: none; display: none; }
.bfm-kiesband { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483003; background: #223840; color: #F3EFE7;
  border-radius: 4px; padding: 8px 12px; font-size: 13px; display: flex; gap: 10px; align-items: center; max-width: calc(100vw - 24px); }
.bfm-kiesband button { background: rgba(255,255,255,.12); color: #F3EFE7; border: 0; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px; }
.bfm-achter { position: fixed; inset: 0; z-index: 2147483004; background: rgba(20, 34, 39, .45); display: flex; justify-content: flex-end; }
.bfm-paneel { width: min(560px, 100vw); height: 100%; background: #fff; color: #223840; display: flex; flex-direction: column; }
.bfm-kop { padding: 14px 16px; border-bottom: 1px solid #1E5A66; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.bfm-kop h2 { margin: 0; font-size: 18px; font-weight: 600; }
.bfm-kop small { display: block; color: #5a6b70; font-size: 12.5px; margin-top: 2px; }
.bfm-sluit { background: none; border: 0; font-size: 24px; line-height: 1; color: #5a6b70; cursor: pointer; }
.bfm-inhoud { padding: 16px; overflow: auto; flex: 1; font-size: 14px; }
.bfm-voet { padding: 12px 16px; border-top: 1px solid #DCD4C7; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.bfm label.bfm-veld { display: block; margin: 0 0 12px; }
.bfm label.bfm-veld > span { display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #5a6b70; margin-bottom: 4px; }
.bfm input[type=text], .bfm input[type=email], .bfm textarea { width: 100%; font-size: 15px; color: #223840; background: #fff; border: 1px solid #DCD4C7; border-radius: 4px; padding: 8px 10px; }
.bfm textarea { min-height: 84px; resize: vertical; }
.bfm-ernst { display: grid; gap: 6px; margin: 0 0 12px; }
.bfm-ernst button { display: grid; grid-template-columns: 140px 1fr; gap: 8px; text-align: left; background: #fff; border: 1px solid #DCD4C7; border-radius: 4px; padding: 8px 10px; cursor: pointer; color: #223840; }
.bfm-ernst button[aria-pressed=true] { border-color: #B25C31; box-shadow: inset 3px 0 0 #B25C31; background: #fbf4ef; }
.bfm-ernst b { font-size: 13.5px; } .bfm-ernst span { font-size: 12.5px; color: #5a6b70; }
@media (max-width: 480px) { .bfm-ernst button { grid-template-columns: 1fr; } }
.bfm-ctx { border: 1px solid #DCD4C7; background: #F3EFE7; border-radius: 4px; padding: 10px 12px; font-size: 12.5px; }
.bfm-ctx p { margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #5a6b70; }
.bfm-ctx dl { margin: 0; display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 2px 10px; }
.bfm-ctx dt { color: #5a6b70; } .bfm-ctx dd { margin: 0; overflow-wrap: anywhere; }
.bfm-beeld img { width: 100%; border: 1px solid #DCD4C7; border-radius: 4px; margin-top: 6px; }
.bfm-check { display: flex; gap: 8px; align-items: center; font-size: 13.5px; font-weight: 600; margin: 0 0 4px; }
.bfm-knop { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 14px; border-radius: 4px; border: 1px solid #1E5A66; background: #1E5A66; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
.bfm-knop.stil { background: #fff; color: #223840; border-color: #DCD4C7; }
.bfm-knop:disabled { opacity: .5; cursor: default; }
.bfm-fout { border-left: 3px solid #8E322B; color: #8E322B; background: #fff; padding: 8px 12px; margin: 0 0 12px; }
.bfm-ok { border-left: 3px solid #3E6B4A; background: #f2f7f3; padding: 10px 12px; margin: 0 0 12px; }
.bfm-lijst { border-top: 1px solid #DCD4C7; }
.bfm-lijst div { padding: 10px 0; border-bottom: 1px solid #DCD4C7; }
.bfm-lijst b { display: block; } .bfm-lijst small { color: #5a6b70; display: block; margin-top: 2px; }
.bfm-lijst .bfm-antw { margin-top: 6px; border-left: 2px solid #1E5A66; padding-left: 10px; }
.bfm-mono { font-family: "IBM Plex Mono", Consolas, monospace; }
.bfm-val { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
@media print { .bfm-tab { display: none; } }
`
  const st = document.createElement("style")
  st.textContent = css
  document.head.appendChild(st)

  let wie = null
  fetch("/api/sessie", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((s) => { if (s && s.aangemeld) wie = s.gebruiker })
    .catch(() => {})

  const tab = el(`<button type="button" class="bfm bfm-tab" data-foutmelder aria-haspopup="true" aria-expanded="false">Fout melden</button>`)
  document.body.appendChild(tab)
  let menu = null
  tab.addEventListener("click", () => (menu ? sluitMenu() : openMenu()))

  function openMenu() {
    const beheer = wie && (wie.rol === "superadmin" || wie.rol === "beheerder")
    menu = el(`<div class="bfm bfm-menu" role="menu" data-foutmelder>
      <p>${wie ? "Aangemeld als " + esc(naam(wie)) : "Help ons de academie te verbeteren"}</p>
      <button type="button" role="menuitem" data-a="scherm"><b>Melding over dit scherm</b><small>Met een schermafbeelding van wat je nu ziet</small></button>
      <button type="button" role="menuitem" data-a="kies"><b>Een onderdeel aanduiden</b><small>Klik daarna op de tekst, knop of vraag waar het over gaat</small></button>
      ${wie ? `<button type="button" role="menuitem" data-a="mijn"><b>Mijn meldingen</b><small>Met de status en het antwoord</small></button>` : ""}
      ${beheer ? `<a role="menuitem" href="/beheer/#meldingen"><b>Alle meldingen</b><small>Beheer › Meldingen</small></a>` : ""}
    </div>`)
    document.body.appendChild(menu)
    tab.setAttribute("aria-expanded", "true")
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]")
      if (!b) return
      const a = b.dataset.a
      sluitMenu()
      if (a === "scherm") nieuw(null)
      if (a === "kies") kies()
      if (a === "mijn") mijn()
    })
    setTimeout(() => document.addEventListener("click", buiten, true), 0)
  }
  function buiten(e) {
    if (menu && !menu.contains(e.target) && e.target !== tab) sluitMenu()
  }
  function sluitMenu() {
    if (menu) menu.remove()
    menu = null
    tab.setAttribute("aria-expanded", "false")
    document.removeEventListener("click", buiten, true)
  }

  // ---------- Een onderdeel aanduiden ----------
  function kies() {
    const kader = el(`<div class="bfm-kies" data-foutmelder></div>`)
    const band = el(`<div class="bfm bfm-kiesband" data-foutmelder role="status">Klik op het onderdeel waar het over gaat <button type="button">Esc</button></div>`)
    document.body.append(kader, band)
    const doel = (e) => (e.target && !e.target.closest("[data-foutmelder]") ? e.target : null)
    const beweeg = (e) => {
      const t = doel(e)
      if (!t) return (kader.style.display = "none")
      const r = t.getBoundingClientRect()
      Object.assign(kader.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" })
    }
    const stop = () => {
      document.removeEventListener("mousemove", beweeg, true)
      document.removeEventListener("click", klik, true)
      document.removeEventListener("keydown", toets, true)
      kader.remove()
      band.remove()
    }
    const klik = (e) => {
      if (band.contains(e.target)) return stop()
      const t = doel(e)
      if (!t) return
      e.preventDefault()
      e.stopPropagation()
      stop()
      nieuw(t)
    }
    const toets = (e) => { if (e.key === "Escape") stop() }
    document.addEventListener("mousemove", beweeg, true)
    document.addEventListener("click", klik, true)
    document.addEventListener("keydown", toets, true)
  }

  // ---------- Nieuwe melding ----------
  async function nieuw(element) {
    const ctx = context(element)
    const beeld = await schermafbeelding(element)
    let ernst = null
    const paneel = open(
      "Fout of opmerking melden",
      ctx.scherm || ctx.adres,
      `<form class="bfm-form" novalidate>
        <div class="bfm-meld"></div>
        <label class="bfm-veld"><span>Korte titel *</span><input type="text" name="titel" maxlength="200" placeholder="bv. Antwoord van toetsvraag 3 in module 5 klopt niet" required></label>
        <label class="bfm-veld"><span>Wat deed je en wat zag je?</span><textarea name="omschrijving" maxlength="4000" placeholder="De stappen, zodat we het kunnen nagaan"></textarea></label>
        <label class="bfm-veld"><span>Wat verwachtte je?</span><textarea name="verwacht" maxlength="2000" style="min-height:60px" placeholder="bv. volgens NBN EN 206 tabel … zou dit … moeten zijn"></textarea></label>
        <label class="bfm-veld"><span>Soort melding *</span></label>
        <div class="bfm-ernst">${ERNST.map(([k, u]) => `<button type="button" data-ernst="${k}" aria-pressed="false"><b>${k}</b><span>${u}</span></button>`).join("")}</div>
        ${wie ? "" : `<label class="bfm-veld"><span>Je e-mailadres (optioneel, voor een antwoord)</span><input type="email" name="email" maxlength="254" autocomplete="email"></label>`}
        <div class="bfm-val" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        ${beeld ? `<div class="bfm-beeld"><label class="bfm-check"><input type="checkbox" name="metbeeld" checked> Schermafbeelding meesturen</label><img src="${beeld}" alt="Schermafbeelding van wat je zag"></div>` : ""}
        <div class="bfm-ctx" style="margin-top:12px"><p>Automatisch meegestuurd</p><dl>${ctxLijst(ctx)}</dl></div>
      </form>`,
      `<button type="button" class="bfm-knop stil" data-x>Annuleren</button><button type="button" class="bfm-knop" data-stuur>Melding versturen</button>`,
    )
    const form = paneel.querySelector("form")
    const meld = paneel.querySelector(".bfm-meld")
    paneel.querySelector(".bfm-ernst").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ernst]")
      if (!b) return
      ernst = b.dataset.ernst
      paneel.querySelectorAll("[data-ernst]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"))
    })
    const beeldVak = paneel.querySelector(".bfm-beeld")
    if (beeldVak) beeldVak.querySelector("input").addEventListener("change", (e) => (beeldVak.querySelector("img").style.display = e.target.checked ? "" : "none"))
    form.titel.focus()
    paneel.querySelector("[data-stuur]").addEventListener("click", async (e) => {
      meld.innerHTML = ""
      const titel = form.titel.value.trim()
      if (!titel) return toon(meld, "Geef een korte titel.", true)
      if (!ernst) return toon(meld, "Kies wat voor melding het is.", true)
      const knop = e.currentTarget
      knop.disabled = true
      try {
        const res = await fetch("/api/meldingen", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-academie": "1" },
          body: JSON.stringify({
            titel,
            omschrijving: form.omschrijving.value,
            verwacht: form.verwacht.value,
            ernst,
            email: form.email ? form.email.value : undefined,
            website: form.website.value,
            context: ctx,
            afbeelding: beeld && form.metbeeld && form.metbeeld.checked ? beeld : undefined,
          }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.fout || "Versturen lukte niet.")
        paneel.querySelector(".bfm-inhoud").innerHTML = `<div class="bfm-ok"><b>Dank je. Melding <span class="bfm-mono">${esc(d.nummer)}</span> is geregistreerd.</b><br>${wie ? "Je volgt ze op via Fout melden › Mijn meldingen." : "We bekijken ze zo snel mogelijk."}</div>`
        paneel.querySelector(".bfm-voet").innerHTML = `<button type="button" class="bfm-knop" data-x>Sluiten</button>`
      } catch (err) {
        toon(meld, err.message, true)
        knop.disabled = false
      }
    })
  }

  // ---------- Mijn meldingen ----------
  async function mijn() {
    const paneel = open("Mijn meldingen", "Status en antwoord", `<p>Laden…</p>`, `<button type="button" class="bfm-knop" data-x>Sluiten</button>`)
    const vak = paneel.querySelector(".bfm-inhoud")
    try {
      const r = await fetch("/api/meldingen/mijn", { credentials: "same-origin" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.fout || "Laden lukte niet.")
      vak.innerHTML = d.meldingen.length
        ? `<div class="bfm-lijst">${d.meldingen
            .map(
              (m) => `<div><b><span class="bfm-mono">${esc(m.nummer)}</span> · ${esc(m.titel)}</b>
              <small>${esc(m.ernst)} · ${esc(m.status)} · ${esc(datum(m.aangemaakt_op))}${m.scherm ? " · " + esc(m.scherm) : ""}</small>
              ${m.antwoord ? `<div class="bfm-antw">${esc(m.antwoord)}</div>` : ""}</div>`,
            )
            .join("")}</div>`
        : `<p>Je hebt nog geen meldingen gestuurd.</p>`
    } catch (err) {
      vak.innerHTML = `<div class="bfm-fout">${esc(err.message)}</div>`
    }
  }

  // ---------- Hulpfuncties ----------
  function open(titel, sub, inhoud, voet) {
    const a = el(`<div class="bfm bfm-achter" data-foutmelder role="dialog" aria-modal="true" aria-label="${esc(titel)}">
      <div class="bfm-paneel"><div class="bfm-kop"><div><h2>${esc(titel)}</h2><small>${esc(sub || "")}</small></div><button type="button" class="bfm-sluit" aria-label="Sluiten" data-x>×</button></div>
      <div class="bfm-inhoud">${inhoud}</div><div class="bfm-voet">${voet}</div></div></div>`)
    document.body.appendChild(a)
    const sluit = () => { a.remove(); document.removeEventListener("keydown", esc_) }
    const esc_ = (e) => { if (e.key === "Escape") sluit() }
    document.addEventListener("keydown", esc_)
    a.addEventListener("click", (e) => { if (e.target === a || e.target.closest("[data-x]")) sluit() })
    return a
  }
  function context(element) {
    const h1 = document.querySelector("main h1, h1")
    const A = window.ACADEMIE || {}
    const c = {
      scherm: ((h1 && h1.textContent) || document.title || "").replace(/\s+/g, " ").trim().slice(0, 200),
      adres: (location.pathname + location.search + location.hash).slice(0, 400),
      cursus: A.cursus ? A.cursus + (A.demo ? " (demo)" : "") : undefined,
      les: A.cursus && location.hash ? location.hash.slice(1) : undefined,
      venster: `${window.innerWidth} × ${window.innerHeight}`,
      browser: browser(),
      versie: VERSIE,
    }
    if (element) {
      c.onderdeel = (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160) || element.tagName.toLowerCase()
      c.pad = cssPad(element)
    }
    return c
  }
  function ctxLijst(c) {
    const rijen = [["Scherm", c.scherm], ["Adres", c.adres], ["Cursus", c.cursus], ["Les", c.les], ["Onderdeel", c.onderdeel ? `“${c.onderdeel}”` : null],
      ["Aangemeld als", wie ? `${naam(wie)} (${wie.rol})` : "niet aangemeld"], ["Venster", `${c.venster} · ${c.browser}`], ["Versie", c.versie]]
    return rijen.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")
  }
  async function schermafbeelding(element) {
    try {
      if (!window.html2canvas) await laad(H2C)
      const schaal = Math.min(1, 1400 / window.innerWidth)
      const canvas = await window.html2canvas(document.body, {
        scale: schaal, useCORS: true, logging: false, backgroundColor: null,
        x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
        ignoreElements: (e) => e.hasAttribute && e.hasAttribute("data-foutmelder"),
      })
      if (element) {
        const r = element.getBoundingClientRect()
        const g = canvas.getContext("2d")
        g.strokeStyle = "#B25C31"
        g.lineWidth = Math.max(3, 4 * schaal)
        g.strokeRect((r.left - 4) * schaal, (r.top - 4) * schaal, (r.width + 8) * schaal, (r.height + 8) * schaal)
      }
      const uit = canvas.toDataURL("image/jpeg", 0.7)
      return uit.length < 1_400_000 ? uit : canvas.toDataURL("image/jpeg", 0.45)
    } catch {
      return null
    }
  }
}

function laad(src) {
  return new Promise((ok, nok) => {
    const s = document.createElement("script")
    s.src = src
    s.onload = ok
    s.onerror = nok
    document.head.appendChild(s)
  })
}
function el(html) {
  const t = document.createElement("template")
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}
function esc(v) {
  return v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}
function toon(vak, tekst, isFout) {
  vak.innerHTML = `<div class="${isFout ? "bfm-fout" : "bfm-ok"}">${esc(tekst)}</div>`
}
function naam(g) {
  return [g.voornaam, g.achternaam].filter(Boolean).join(" ") || g.gebruikersnaam || g.email || ""
}
function datum(v) {
  if (!v) return ""
  const d = new Date(v)
  const p = (n) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}
function browser() {
  const ua = navigator.userAgent
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Andere"
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""
  return b + (os ? " op " + os : "")
}
function cssPad(e0) {
  const delen = []
  let e = e0
  while (e && e !== document.body && delen.length < 8) {
    if (e.id) { delen.unshift("#" + e.id); break }
    const ouder = e.parentElement
    const zelfde = ouder ? [...ouder.children].filter((x) => x.tagName === e.tagName) : []
    delen.unshift(zelfde.length > 1 ? `${e.tagName.toLowerCase()}:nth-of-type(${zelfde.indexOf(e) + 1})` : e.tagName.toLowerCase())
    e = ouder
  }
  return delen.join(" > ")
}
