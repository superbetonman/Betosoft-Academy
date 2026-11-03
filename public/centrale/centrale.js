import { $, $$, esc, euro, getal, datum, tijdstip, vandaag, naam, api, toast, maakDialoog, uitnodigingHtml, koppelKopieer, afmelden } from "/gemeen.js"
import { matrix, deelnemerDetail } from "/leerlijn.js"

const dialoog = maakDialoog()
const inhoud = $("#inhoud")
let sessie, ov
let huidig = null

$("#afmelden").addEventListener("click", afmelden)

function rechtStatus(r) {
  if (r.status !== "actief") return `<span class="status s-indicatief">${esc(r.status)}</span>`
  if (r.eind_datum && r.eind_datum < vandaag()) return `<span class="status s-afwijking">verlopen</span>`
  if (r.dagen_resterend !== null && r.dagen_resterend <= 14) return `<span class="status s-aandacht">nog <span class="mono">${r.dagen_resterend}</span> d</span>`
  return `<span class="status s-conform">actief</span>`
}
const balkje = (pct) => `<div class="balkje" title="${pct ?? 0} %"><span style="width:${Math.max(0, Math.min(100, pct ?? 0))}%"></span></div>`
const rangCel = (r) => `<td class="rang r${r <= 3 ? r : ""}">${r <= 3 ? `<span class="med">${r}</span>` : r}</td>`

// ---------- Tabs ----------
const tabs = {}
function kies(t) {
  if (!tabs[t]) t = "overzicht"
  huidig = t
  $$(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"))
  if (location.hash.slice(1) !== t) history.replaceState(null, "", `#${t}`)
  herlaad()
}
$$(".tab").forEach((b) => b.addEventListener("click", () => kies(b.dataset.tab)))
window.addEventListener("hashchange", () => {
  const t = location.hash.slice(1)
  if (t && t !== huidig) kies(t)
})
async function herlaad() {
  inhoud.innerHTML = `<p class="zacht">Laden…</p>`
  try {
    ov = await api("/api/centrale/overzicht")
    await tabs[huidig]()
  } catch (err) {
    if (err.message !== "Niet aangemeld") inhoud.innerHTML = `<div class="melding fout">${esc(err.message)}</div>`
  }
}
inhoud.addEventListener("click", (e) => {
  const el = e.target.closest("[data-actie]")
  if (el && acties[el.dataset.actie]) acties[el.dataset.actie](el.dataset, el)
})

// ---------- Overzicht ----------
tabs.overzicht = async () => {
  const c = ov.cijfers
  const geldig = ov.rechten.filter((r) => r.geldig)
  const aflopend = geldig.filter((r) => r.dagen_resterend !== null && r.dagen_resterend <= 14)
  const vrij = geldig.reduce((s, r) => s + (r.aantal_plaatsen - r.gebruikt), 0)
  inhoud.innerHTML = `
    <p class="label" style="margin:4px 0 8px">${datum(vandaag())}</p>
    <h1>${esc(ov.organisatie.naam)}</h1>
    <p>${c.medewerkers ? `<strong>${c.medewerkers} medewerker${c.medewerkers === 1 ? "" : "s"}</strong>, waarvan ${c.met_opleiding} met een opleiding en ${c.aangemeld} met een actief account.` : "<strong>Nog geen medewerkers.</strong> Voeg ze toe in het tabblad Medewerkers; elke medewerker krijgt een eigen login."}
      ${aflopend.length ? ` ${aflopend.length} opleiding${aflopend.length === 1 ? " loopt" : "en lopen"} binnen 14 dagen af.` : ""}</p>
    <div class="cijfers" style="margin-top:16px">
      <div class="cijfer"><div class="label">Medewerkers</div><div class="waarde">${c.medewerkers}</div></div>
      <div class="cijfer"><div class="label">Vrije plaatsen</div><div class="waarde">${vrij}</div></div>
      <div class="cijfer"><div class="label">Gem. voortgang</div><div class="waarde">${c.gem_voortgang === null ? "—" : getal(c.gem_voortgang) + " %"}</div></div>
      <div class="cijfer"><div class="label">Gem. score</div><div class="waarde">${c.gem_score === null ? "—" : getal(c.gem_score) + " %"}</div></div>
      <div class="cijfer"><div class="label">Attesten</div><div class="waarde">${c.attesten}</div></div>
    </div>
    <h2>01 Opleidingen en plaatsen</h2>
    ${geldig.length ? `<div class="lijst">${geldig.map(rechtRij).join("")}</div>` : `<div class="leeg">Geen lopende opleidingen. Bestel er een in het tabblad Opleidingen.</div>`}
    <h2>02 Zo werkt het</h2>
    <ol class="klein">
      <li>Voeg je medewerkers toe. Elke medewerker krijgt een uitnodigingslink om een wachtwoord te kiezen.</li>
      <li>Wijs een plaats in een opleiding toe. De medewerker ziet de opleiding meteen na aanmelden.</li>
      <li>Volg voortgang en resultaten in Leerlijn en Scorebord. Een afgeronde cursus geeft vanzelf een attest dat je kunt afdrukken of mailen.</li>
      <li>Niet klaar op tijd? Vraag een verlenging aan bij de opleiding (${esc(verlengTekst(geldig[0]))}).</li>
    </ol>`
}
function verlengTekst(r) {
  if (!r) return "per extra maand"
  return `per extra maand, maximaal ${r.verlengingen_max} keer, aan te vragen tot ${datum(r.aanvragen_tot)}`
}
function rechtRij(r) {
  const kanVerlengen = r.geldig && r.verlengingen < r.verlengingen_max && r.aanvragen_tot >= vandaag() && !r.verlenging_open
  return `<div class="rij">
    <div>
      <div class="titel">${esc(r.product)}</div>
      <div class="meta">
        <span><span class="mono">${datum(r.start_datum)}</span> – <span class="mono">${r.eind_datum ? datum(r.eind_datum) : "onbeperkt"}</span></span>
        <span>plaatsen <span class="mono">${r.gebruikt}/${r.aantal_plaatsen}</span></span>
        <span>verlengd <span class="mono">${r.verlengingen}/${r.verlengingen_max}</span></span>
        ${r.verlenging_open ? `<span class="status s-concept">verlenging aangevraagd</span>` : ""}
        ${rechtStatus(r)}
      </div>
    </div>
    <div class="knoppen">
      ${kanVerlengen ? `<button class="knop licht klein" data-actie="verleng" data-id="${r.id}">Verlenging aanvragen</button>` : ""}
    </div>
  </div>`
}

// ---------- Medewerkers ----------
let zoek = ""
tabs.medewerkers = async () => {
  const { medewerkers } = await api("/api/centrale/medewerkers")
  window._mw = Object.fromEntries(medewerkers.map((m) => [m.gebruiker_id, m]))
  const lijst = medewerkers.filter((m) => !zoek || `${naam(m)} ${m.email} ${m.locatie}`.toLowerCase().includes(zoek.toLowerCase()))
  const metLocaties = ov.locaties.length > 0
  inhoud.innerHTML = `
    <h1>Medewerkers</h1>
    <div class="balk">
      <input id="zoek" class="groei" type="search" placeholder="Zoek op naam, e-mail of locatie" value="${esc(zoek)}">
      <button class="knop" data-actie="nieuw">Medewerker toevoegen</button>
    </div>
    ${lijst.length ? `<div class="scroll-x paneel" style="padding:0"><table class="eenvoudig">
      <thead><tr><th>Naam</th>${metLocaties ? "<th>Locatie</th>" : ""}<th>Opleidingen</th><th>Voortgang</th><th class="num">Score</th><th class="num">Attesten</th><th>Laatst actief</th><th></th></tr></thead>
      <tbody>${lijst.map((m) => `<tr>
        <td><strong>${esc(naam(m))}</strong>${m.rol === "centrale_verantwoordelijke" ? ` <span class="tag">beheerder</span>` : ""}
          ${!m.actief ? ` <span class="status s-indicatief">uitgeschakeld</span>` : !m.account_actief ? ` <span class="status s-aandacht">nog niet aangemeld</span>` : ""}
          <div class="klein zacht">${esc(m.email)}</div></td>
        ${metLocaties ? `<td>${esc(m.locatie)}</td>` : ""}
        <td class="klein">${m.opleidingen.length ? m.opleidingen.map((o) => esc(o.product)).join("<br>") : `<span class="zacht">geen</span>`}</td>
        <td>${m.voortgang_pct === null ? `<span class="zacht">—</span>` : `${balkje(m.voortgang_pct)}<span class="mono klein">${m.voortgang_pct} %</span>`}</td>
        <td class="num mono">${m.gem_score === null || m.gem_score === undefined ? "—" : getal(m.gem_score) + "&#8239;%"}</td>
        <td class="num mono">${m.attesten}</td>
        <td class="mono klein">${m.laatste_activiteit ? tijdstip(m.laatste_activiteit) : "—"}</td>
        <td><button class="knop stil klein" data-actie="beheer" data-id="${m.gebruiker_id}">Beheren</button></td>
      </tr>`).join("")}</tbody></table></div>` : `<div class="leeg">${medewerkers.length ? "Niemand gevonden." : "Nog geen medewerkers. Voeg de eerste toe."}</div>`}`
  let t
  $("#zoek").addEventListener("input", (e) => {
    clearTimeout(t)
    t = setTimeout(() => {
      zoek = e.target.value.trim()
      tabs.medewerkers().then(() => {
        const z = $("#zoek")
        z.focus()
        z.setSelectionRange(z.value.length, z.value.length)
      })
    }, 300)
  })
}

// ---------- Leerlijn ----------
let leerLocatie = ""
let leerData = []
tabs.leerlijn = async () => {
  const { medewerkers } = await api(`/api/centrale/leerlijn${leerLocatie ? `?locatie=${leerLocatie}` : ""}`)
  leerData = medewerkers
  const actief = medewerkers.filter((m) => m.cursussen.some((c) => c.toegang || c.deels || c.af))
  const attesten = medewerkers.flatMap((m) => m.attesten.filter((a) => !a.ingetrokken_op).map((a) => ({ ...a, naam: m.naam })))
  inhoud.innerHTML = `
    <h1>Leerlijn</h1>
    <p class="zacht klein">Voortgang per medewerker en per cursus. Klik op een medewerker voor de modules, toetsscores, badges en attesten. Een ✓ is een behaald attest.</p>
    ${ov.locaties.length ? `<div class="balk"><select id="leerloc" style="max-width:280px" aria-label="Locatie">
      <option value="">Alle locaties</option>${ov.locaties.map((l) => `<option value="${l.id}">${esc(l.naam)}</option>`).join("")}</select></div>` : ""}
    ${actief.length ? matrix(actief) : `<div class="leeg">Nog geen medewerkers met een opleiding. Wijs plaatsen toe in Medewerkers.</div>`}
    <h2>Attesten</h2>
    ${attesten.length ? `<div class="lijst">${attesten.map((a) => `<div class="rij"><div><div class="titel">${esc(a.naam)} · ${esc(a.cursus)}</div>
      <div class="meta"><span class="mono">${esc(a.nummer)}</span><span>uitgereikt ${esc(datum(a.uitgereikt_op))}</span>${a.gemaild_op ? `<span>gemaild ${esc(datum(a.gemaild_op))}</span>` : ""}</div></div>
      <div class="knoppen"><a class="knop licht klein" style="text-decoration:none;display:inline-flex;align-items:center" href="/attest/${a.id}" target="_blank" rel="noopener">Afdrukken</a>
      <a class="knop licht klein" style="text-decoration:none;display:inline-flex;align-items:center" href="/attest/${a.id}#mail" target="_blank" rel="noopener">Mailen</a></div></div>`).join("")}</div>`
      : `<div class="leeg">Nog geen attesten. Een attest verschijnt vanzelf zodra een medewerker een cursus volledig afrondt.</div>`}`
  const sel = $("#leerloc")
  if (sel) {
    sel.value = leerLocatie
    sel.addEventListener("change", () => { leerLocatie = sel.value; tabs.leerlijn() })
  }
}
function toonDeelnemer(id) {
  const m = leerData.find((x) => x.id === id)
  if (!m) return
  dialoog({ titel: m.naam, inhoud: deelnemerDetail(m), sluitTekst: "Sluiten" })
  const dlg = $("#dialoog")
  dlg.style.width = "min(860px, calc(100vw - 24px))"
  dlg.addEventListener("close", () => (dlg.style.width = ""), { once: true })
}
inhoud.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-deelnemer]")
  if (tr && !e.target.closest("a")) toonDeelnemer(tr.dataset.deelnemer)
})
inhoud.addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr[data-deelnemer]")
  if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toonDeelnemer(tr.dataset.deelnemer) }
})

// ---------- Scorebord ----------
let scoreLocatie = ""
tabs.scorebord = async () => {
  const { scorebord } = await api(`/api/centrale/scorebord${scoreLocatie ? `?locatie=${scoreLocatie}` : ""}`)
  inhoud.innerHTML = `
    <h1>Scorebord</h1>
    <p class="zacht klein">Medewerkers van ${esc(ov.organisatie.naam)} met een opleiding, gerangschikt op punten (lessen, toetsen, modules, cursussen en badges). Het klassement van alle centrales staat op <a href="/scores/">Scores</a>.</p>
    ${ov.locaties.length ? `<div class="balk"><select id="loc" style="max-width:280px" aria-label="Locatie">
      <option value="">Alle locaties</option>${ov.locaties.map((l) => `<option value="${l.id}">${esc(l.naam)}</option>`).join("")}</select></div>` : ""}
    ${scorebord.length ? `<div class="scroll-x paneel" style="padding:0"><table class="eenvoudig klas">
      <thead><tr><th>#</th><th>Naam</th>${ov.locaties.length ? "<th>Locatie</th>" : ""}<th>Niveau</th><th class="num">Punten</th><th class="num">Modules af</th><th>Voortgang</th><th class="num">Gem. score</th><th class="num">Badges</th><th class="num">Attesten</th></tr></thead>
      <tbody>${scorebord.map((s, i) => `<tr>
        ${rangCel(i + 1)}
        <td><strong>${esc(naam(s))}</strong></td>
        ${ov.locaties.length ? `<td>${esc(s.locatie)}</td>` : ""}
        <td class="klein">${esc(s.niveau)}</td>
        <td class="num mono"><strong>${getal(s.punten)}</strong></td>
        <td class="num mono">${s.modules_af}</td>
        <td>${s.voortgang_pct === null ? "—" : `${balkje(s.voortgang_pct)}<span class="mono klein">${s.voortgang_pct} %</span>`}</td>
        <td class="num mono">${s.gem_score === null ? "—" : getal(s.gem_score) + "&#8239;%"}</td>
        <td class="num mono">${s.badges}</td>
        <td class="num mono">${s.attesten}</td>
      </tr>`).join("")}</tbody></table></div>` : `<div class="leeg">Nog geen resultaten. Het scorebord vult zich zodra medewerkers lessen en toetsen afwerken.</div>`}`
  const sel = $("#loc")
  if (sel) {
    sel.value = scoreLocatie
    sel.addEventListener("change", () => {
      scoreLocatie = sel.value
      tabs.scorebord()
    })
  }
}

// ---------- Opleidingen ----------
tabs.opleidingen = async () => {
  inhoud.innerHTML = `
    <h1>Opleidingen</h1>
    <div class="balk"><button class="knop" data-actie="bestel">Opleiding of plaatsen bestellen</button></div>
    <p class="klein zacht">Een opleiding is ${esc("3 maanden")} toegankelijk vanaf de start. Updates van de opleiding in die periode zijn inbegrepen. Niet klaar op tijd? Vraag een verlenging aan.</p>
    <h2>01 Lopend</h2>
    ${ov.rechten.filter((r) => r.geldig).map(rechtRij).join("") ? `<div class="lijst">${ov.rechten.filter((r) => r.geldig).map(rechtRij).join("")}</div>` : `<div class="leeg">Geen lopende opleidingen.</div>`}
    <h2>02 Afgelopen</h2>
    ${ov.rechten.filter((r) => !r.geldig).length ? `<div class="lijst">${ov.rechten.filter((r) => !r.geldig).map(rechtRij).join("")}</div>` : `<div class="leeg">Geen afgelopen opleidingen.</div>`}`
}

// ---------- Locaties ----------
tabs.locaties = async () => {
  const { medewerkers } = await api("/api/centrale/medewerkers")
  inhoud.innerHTML = `
    <h1>Locaties</h1>
    <p class="zacht klein">Elke locatie kan een eigen beheerder hebben. Die ziet en beheert enkel de medewerkers van die locatie. Jij ziet alle locaties.</p>
    <div class="balk"><button class="knop" data-actie="locatie">Locatie toevoegen</button></div>
    ${ov.locaties.length ? `<div class="lijst">${ov.locaties.map((l) => {
      const mw = medewerkers.filter((m) => m.organisatie_id === l.id)
      const bh = mw.filter((m) => m.rol === "centrale_verantwoordelijke")
      return `<div class="rij"><div>
        <div class="titel">${esc(l.naam)}</div>
        <div class="meta">${l.adres ? `<span>${esc(l.adres)}</span>` : ""}<span>medewerkers <span class="mono">${mw.length}</span></span>
          <span>beheerder: ${bh.length ? bh.map((b) => esc(naam(b))).join(", ") : `<span class="status s-aandacht">nog geen</span>`}</span></div>
      </div></div>`
    }).join("")}</div>` : `<div class="leeg">Nog geen locaties. Zonder locaties beheer je alle medewerkers centraal.</div>`}`
}

// ---------- Account ----------
tabs.account = async () => {
  const g = sessie.gebruiker
  inhoud.innerHTML = `
    <h1>Mijn account</h1>
    <div class="paneel" style="max-width:520px">
      <p><strong>${esc(naam(g))}</strong><br><span class="zacht">${esc(g.email)} · beheerder van ${esc(g.organisatie?.naam || "")}</span></p>
      <form id="ww">
        <h3 style="margin:12px 0 8px">Wachtwoord wijzigen</h3>
        <label class="veld"><span class="label">Huidig wachtwoord</span><input type="password" name="huidig" autocomplete="current-password" required></label>
        <label class="veld"><span class="label">Nieuw wachtwoord (minstens 12 tekens)</span><input type="password" name="nieuw" minlength="12" autocomplete="new-password" required></label>
        <button class="knop" type="submit">Wijzigen</button>
      </form>
    </div>`
  $("#ww").addEventListener("submit", async (e) => {
    e.preventDefault()
    try {
      await api("/api/wachtwoord", { methode: "POST", data: Object.fromEntries(new FormData(e.target)) })
      e.target.reset()
      toast("Wachtwoord gewijzigd")
    } catch (err) {
      toast(err.message, true)
    }
  })
}

// ---------- Acties ----------
const acties = {}
const geldigeRechten = () => ov.rechten.filter((r) => r.geldig && r.gebruikt < r.aantal_plaatsen)
const locatieKeuze = (huidig) =>
  ov.locaties.length
    ? `<label class="veld"><span class="label">Locatie</span><select name="locatie_id">
        ${ov.isHoofd ? `<option value="">${esc(ov.organisatie.naam)} (hoofdzetel)</option>` : ""}
        ${ov.locaties.map((l) => `<option value="${l.id}" ${l.id === huidig ? "selected" : ""}>${esc(l.naam)}</option>`).join("")}</select></label>`
    : ""

acties.nieuw = () => {
  const vrij = geldigeRechten()
  dialoog({
    titel: "Medewerker toevoegen",
    inhoud: `
      <p class="klein zacht">Elke medewerker krijgt een eigen login. Na het toevoegen krijg je een uitnodigingslink om door te sturen; daarmee kiest de medewerker een wachtwoord.</p>
      <div class="velden twee">
        <label class="veld"><span class="label">Voornaam</span><input name="voornaam" required maxlength="80"></label>
        <label class="veld"><span class="label">Achternaam</span><input name="achternaam" maxlength="80"></label>
      </div>
      <label class="veld"><span class="label">E-mail</span><input name="email" type="email" required maxlength="254"></label>
      ${locatieKeuze()}
      <label class="veld"><span class="label">Opleiding toewijzen</span><select name="recht_id"><option value="">Nog niet</option>
        ${vrij.map((r) => `<option value="${r.id}">${esc(r.product)} (${r.aantal_plaatsen - r.gebruikt} vrij)</option>`).join("")}</select></label>
      ${!vrij.length ? `<p class="klein zacht">Geen vrije plaatsen. Bestel plaatsen in het tabblad Opleidingen.</p>` : ""}`,
    knop: "Toevoegen",
    bij: async (fd, form) => {
      const r = await api("/api/centrale/medewerkers", { methode: "POST", data: fd })
      toonUitnodiging(r.uitnodiging, fd.voornaam)
      herlaad()
      return false
    },
  })
}

function toonUitnodiging(u, wie) {
  dialoog({ titel: "Uitnodiging", inhoud: uitnodigingHtml(u, wie), sluitTekst: "Sluiten" })
  koppelKopieer()
}

acties.beheer = ({ id }) => {
  const m = window._mw[id]
  const vrij = geldigeRechten().filter((r) => !m.opleidingen.some((o) => o.recht === r.id))
  dialoog({
    titel: naam(m),
    inhoud: `
      <p class="klein zacht">${esc(m.email)}${m.locatie ? ` · ${esc(m.locatie)}` : ""}</p>
      <h3 style="margin:12px 0 6px">Opleidingen</h3>
      ${m.opleidingen.length ? `<table class="eenvoudig"><tbody>${m.opleidingen.map((o) => `<tr><td>${esc(o.product)}</td><td class="mono klein">tot ${datum(o.eind)}</td>
        <td><button type="button" class="knop gevaar klein" data-intrek="${o.toewijzing}">Intrekken</button></td></tr>`).join("")}</tbody></table>` : `<p class="zacht klein">Geen opleiding toegewezen.</p>`}
      ${vrij.length && m.actief ? `<div class="balk"><select id="nieuwrecht" class="groei">${vrij.map((r) => `<option value="${r.id}">${esc(r.product)} (${r.aantal_plaatsen - r.gebruikt} vrij)</option>`).join("")}</select>
        <button type="button" class="knop klein" id="wijs">Toewijzen</button></div>` : ""}
      <h3 style="margin:16px 0 6px">Gegevens</h3>
      <div class="velden twee">
        <label class="veld"><span class="label">Voornaam</span><input name="voornaam" value="${esc(m.voornaam || "")}" maxlength="80"></label>
        <label class="veld"><span class="label">Achternaam</span><input name="achternaam" value="${esc(m.achternaam || "")}" maxlength="80"></label>
      </div>
      ${locatieKeuze(m.organisatie_id)}
      <div class="knoppen" style="margin-top:8px">
        ${m.actief ? `<button type="button" class="knop stil klein" id="uitnodig">${m.account_actief ? "Nieuwe aanmeldlink" : "Uitnodigingslink"}</button>` : ""}
        ${m.gebruiker_id !== sessie.gebruiker.id ? `<button type="button" class="knop stil klein" id="rol">${m.rol === "centrale_verantwoordelijke" ? "Geen beheerder meer" : "Maak beheerder"}</button>
        <button type="button" class="knop ${m.actief ? "gevaar" : "licht"} klein" id="actief">${m.actief ? "Uitschakelen" : "Opnieuw inschakelen"}</button>` : ""}
      </div>`,
    knop: "Gegevens opslaan",
    bij: async (fd) => {
      if (!fd.locatie_id && ov.isHoofd && ov.locaties.length) fd.locatie_id = sessie.gebruiker.organisatie.id
      await api(`/api/centrale/medewerkers/${id}/wijzig`, { methode: "POST", data: fd })
      toast("Opgeslagen")
      herlaad()
    },
  })
  const na = async (fn, melding) => {
    try {
      await fn()
      $("#dialoog").close()
      toast(melding)
      herlaad()
    } catch (err) {
      toast(err.message, true)
    }
  }
  $$("#dialooginhoud [data-intrek]").forEach((b) =>
    b.addEventListener("click", () => {
      if (confirm("Opleiding intrekken? De voortgang blijft bewaard, maar de plaats komt vrij."))
        na(() => api(`/api/centrale/plaatsen/${b.dataset.intrek}/intrek`, { methode: "POST" }), "Plaats vrijgemaakt")
    }),
  )
  $("#wijs")?.addEventListener("click", () =>
    na(() => api("/api/centrale/plaatsen", { methode: "POST", data: { recht_id: $("#nieuwrecht").value, gebruiker_id: id } }), "Opleiding toegewezen"),
  )
  $("#uitnodig")?.addEventListener("click", async () => {
    try {
      const r = await api(`/api/centrale/medewerkers/${id}/uitnodiging`, { methode: "POST" })
      toonUitnodiging(r.uitnodiging, m.voornaam || m.email)
    } catch (err) {
      toast(err.message, true)
    }
  })
  $("#rol")?.addEventListener("click", () =>
    na(
      () => api(`/api/centrale/medewerkers/${id}/rol`, { methode: "POST", data: { rol: m.rol === "centrale_verantwoordelijke" ? "cursist" : "centrale_verantwoordelijke" } }),
      "Rol gewijzigd",
    ),
  )
  $("#actief")?.addEventListener("click", () => {
    if (m.actief && !confirm("Medewerker uitschakelen? De toegewezen opleidingen komen vrij en de persoon kan niet meer aanmelden.")) return
    na(() => api(`/api/centrale/medewerkers/${id}/actief`, { methode: "POST", data: { actief: !m.actief } }), m.actief ? "Uitgeschakeld" : "Ingeschakeld")
  })
}

acties.verleng = ({ id }) => {
  const r = ov.rechten.find((x) => x.id === id)
  dialoog({
    titel: "Verlenging aanvragen",
    inhoud: `<p><strong>${esc(r.product)}</strong> loopt tot <span class="mono">${datum(r.eind_datum)}</span>.</p>
      <table class="eenvoudig"><tbody>
        <tr><th>Verlenging</th><td>1 maand extra, vanaf het huidige einde</td></tr>
        <tr><th>Prijs</th><td class="mono">${euro(r.verlenging_prijs)} excl. btw</td></tr>
        <tr><th>Al verlengd</th><td class="mono">${r.verlengingen} van ${r.verlengingen_max}</td></tr>
        <tr><th>Aanvragen kan tot</th><td class="mono">${datum(r.aanvragen_tot)}</td></tr>
      </tbody></table>
      <p class="klein zacht">Je ontvangt een factuur. Na betaling wordt de toegang verlengd voor alle medewerkers op deze opleiding.</p>
      <label class="veld"><span class="label">Opmerking (optioneel)</span><input name="opmerking" maxlength="300"></label>`,
    knop: "Aanvragen",
    bij: async (fd) => {
      await api(`/api/centrale/rechten/${id}/verlenging`, { methode: "POST", data: fd })
      toast("Verlenging aangevraagd")
      herlaad()
    },
  })
}

acties.bestel = async () => {
  const { producten } = await api("/api/centrale/producten")
  dialoog({
    titel: "Opleiding of plaatsen bestellen",
    inhoud: `
      <label class="veld"><span class="label">Opleiding</span><select name="product_id" id="bp" required>
        ${producten.map((p) => `<option value="${p.id}" data-prijs="${p.prijs_excl_btw ?? ""}">${esc(p.naam)}</option>`).join("")}</select></label>
      <label class="veld"><span class="label">Aantal plaatsen</span><input name="aantal_plaatsen" id="bn" type="number" min="1" max="500" value="1" class="mono" required></label>
      <p class="mono klein" id="btot"></p>
      <label class="veld"><span class="label">Opmerking (optioneel)</span><input name="opmerking" maxlength="500"></label>
      <p class="klein zacht">Je bestelling komt bij Betosoft binnen. Na facturatie en betaling verschijnen de plaatsen hier.</p>`,
    knop: "Bestellen",
    bij: async (fd) => {
      await api("/api/centrale/bestelling", { methode: "POST", data: { ...fd, aantal_plaatsen: Number(fd.aantal_plaatsen) } })
      toast("Bestelling verstuurd")
    },
  })
  const tot = () => {
    const o = $("#bp").selectedOptions[0]
    const p = o?.dataset.prijs
    $("#btot").textContent = p ? `${euro(p)} per plaats · totaal ${euro(p * Number($("#bn").value || 1))} excl. btw` : "Prijs op aanvraag"
  }
  $("#bp").addEventListener("change", tot)
  $("#bn").addEventListener("input", tot)
  tot()
}

acties.locatie = () =>
  dialoog({
    titel: "Locatie toevoegen",
    inhoud: `<label class="veld"><span class="label">Naam</span><input name="naam" required maxlength="160" placeholder="bv. Vestiging Gent"></label>
      <label class="veld"><span class="label">Adres</span><input name="adres" maxlength="300"></label>
      <p class="klein zacht">Daarna voeg je medewerkers toe aan deze locatie en maak je er één beheerder van.</p>`,
    knop: "Toevoegen",
    bij: async (fd) => {
      await api("/api/centrale/locaties", { methode: "POST", data: fd })
      toast("Locatie toegevoegd")
      herlaad()
    },
  })

// ---------- Start ----------
try {
  sessie = await api("/api/sessie")
  if (!sessie.aangemeld) location.replace("/aanmelden/?terug=/centrale/")
  else if (sessie.gebruiker.rol !== "centrale_verantwoordelijke") location.replace(sessie.bestemming)
  else {
    $("#wie").textContent = naam(sessie.gebruiker)
    $("#orgnaam").textContent = "· " + (sessie.gebruiker.organisatie?.naam || "")
    if (!sessie.gebruiker.organisatie?.ouder_id) $("#tab-locaties").classList.remove("verborgen")
    kies(location.hash.slice(1) || "overzicht")
  }
} catch {}
