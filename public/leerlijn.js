// Gedeelde weergave van de leerlijn: cursuskaarten, modules, badges, niveau en de matrix voor centrale en beheer.
import { esc, getal, datum } from "/gemeen.js"

export const pctTekst = (p) => (p === null || p === undefined ? "—" : `${getal(p)}&#8239;%`)
export const balkje = (pct, klasse = "") =>
  `<div class="balkje ${klasse} ${pct >= 100 ? "af" : ""}" role="img" aria-label="${pct ?? 0} procent"><span style="width:${Math.max(0, Math.min(100, pct ?? 0))}%"></span></div>`

const STATUS = { af: ["af", "●", "afgerond"], bezig: ["bezig", "◐", "bezig"], nog: ["nog", "○", "nog niet gestart"] }

export function cursusStatus(c) {
  if (c.attest) return `<span class="status s-conform">attest behaald</span>`
  if (c.afgerond) return `<span class="status s-conform">afgerond</span>`
  if (!c.toegang && c.deels) return `<span class="status s-indicatief">deel van de cursus</span>`
  if (!c.toegang && c.online === false) return `<span class="status s-indicatief">offline</span>`
  if (!c.toegang) return `<span class="status s-indicatief">geen toegang meer</span>`
  if (c.af > 0) return `<span class="status s-aandacht">bezig</span>`
  return `<span class="status s-concept">nog niet gestart</span>`
}

export function moduleLijst(c) {
  if (!c.modules?.length) return `<p class="klein zacht">De modules verschijnen zodra de cursus één keer geopend is.</p>`
  return `<ol class="modlijst2">${c.modules
    .map((m) => {
      const [k, teken, woord] = STATUS[m.status] || STATUS.nog
      return `<li><span class="st ${k}" title="${woord}" aria-label="${woord}">${teken}</span><span class="n">${esc(m.n)}</span><span>${esc(m.titel)}</span>
        <span class="r"><span class="mono">${m.af}/${m.lessen}</span>${m.toets ? ` · toets <span class="mono">${m.toets.best}/${m.toets.total}</span>` : ""}</span></li>`
    })
    .join("")}</ol>`
}

/** Kaart voor één cursus. eigen: de eigen leerlijn (knoppen om verder te leren). */
export function cursusKaart(c, { eigen = false, beheer = false } = {}) {
  const cijfers = [
    c.lessen !== null ? `<span><span class="mono">${c.af}</span> van <span class="mono">${c.lessen}</span> lessen</span>` : `<span><span class="mono">${c.af}</span> ${c.af === 1 ? "les" : "lessen"} afgerond</span>`,
    c.toetsen ? `<span>toetsen <span class="mono">${c.geslaagd}/${c.toetsen}</span></span>` : "",
    c.gem_score !== null ? `<span>gem. score <span class="mono">${getal(c.gem_score)}&#8239;%</span></span>` : "",
    c.punten ? `<span>punten <span class="mono">${getal(c.punten)}</span></span>` : "",
    c.eind ? `<span>toegang tot <span class="mono">${esc(datum(c.eind))}</span></span>` : "",
    c.laatst ? `<span>laatst <span class="mono">${esc(datum(c.laatst))}</span></span>` : "",
  ].filter(Boolean)
  const kanOpenen = eigen && c.toegang
  const verder = kanOpenen && c.volgende
    ? `<div class="volgende">Volgende stap: <strong>${esc(c.volgende.titel)}</strong> <span class="zacht">· module ${esc(c.volgende.module)}</span></div>`
    : ""
  const knoppen = eigen
    ? [
        kanOpenen ? `<a class="knop" href="/cursus/${encodeURIComponent(c.code)}/${c.volgende && c.af ? "#" + encodeURIComponent(c.volgende.id) : ""}">${c.afgerond ? "Cursus openen" : c.af ? "Verder leren" : "Starten"}</a>` : "",
        c.demo && !kanOpenen ? `<a class="knop licht" href="/demo/${encodeURIComponent(c.code)}/">Demo</a>` : "",
      ].join("")
    : ""
  const attest = c.attest
    ? `<div class="attestband"><span class="attesticoon">✓</span><span>Attest <span class="mono">${esc(c.attest.nummer)}</span> · ${esc(datum(c.attest.uitgereikt_op))}</span>
        <a class="knop klein" href="/attest/${c.attest.id}">Bekijken en afdrukken</a><a class="knop licht klein" href="/attest/${c.attest.id}#mail">Mailen</a></div>`
    : c.afgerond && !c.bevestigd
      ? `<div class="attestband"><span>Afgerond. Het attest volgt zodra Betosoft deze cursus heeft nagekeken.</span></div>`
      : ""
  const deels = !c.toegang && c.deels
    ? `<p class="klein zacht" style="margin:0">Je hebt toegang tot een deel van deze cursus. De cursus opent zodra je toegang hebt tot alle modules.</p>`
    : ""
  return `<article class="lkaart ${c.afgerond ? "af" : ""}">
    <div class="lkop"><span class="tag">${esc(c.code)}</span><h3>${esc(c.titel)}</h3>${cursusStatus(c)}${beheer && c.structuur && !c.bevestigd ? `<span class="status s-indicatief" title="Open de cursus als beheerder om de lessenlijst te bevestigen">voorlopige lessenlijst</span>` : ""}</div>
    ${c.pct !== null ? `<div class="lbalk">${balkje(c.pct, "groot")}<b>${pctTekst(c.pct)}</b></div>` : ""}
    <div class="lcijfers">${cijfers.join("")}</div>
    ${deels}${verder}${attest}
    ${knoppen ? `<div class="knoppen">${knoppen}</div>` : ""}
    ${c.modules?.length ? `<details${eigen && c.af && !c.afgerond ? " open" : ""}><summary>Modules (${c.modules.filter((m) => m.status === "af").length} van ${c.modules.length} afgerond)</summary>${moduleLijst(c)}</details>` : ""}
  </article>`
}

const ICOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>'
export function badgeLijst(badges) {
  return `<div class="badges">${badges
    .map((b) => `<div class="badge ${b.behaald ? "ja" : "nee"}" title="${b.behaald ? "Behaald" : "Nog niet behaald"}"><span class="ic">${ICOON}</span><div><b>${esc(b.naam)}</b><span>${esc(b.uitleg)}</span></div></div>`)
    .join("")}</div>`
}

export function niveauBlok(t, extra = "") {
  const n = t.niveau
  const nog = n.volgende ? `nog <span class="mono">${getal(n.volgende_min - t.punten)}</span> punten tot <strong>${esc(n.volgende)}</strong>` : "hoogste niveau bereikt"
  return `<div class="niveaublok">
    <div><div class="nv">Niveau ${n.nr}</div><div class="nvnaam">${esc(n.naam)}</div></div>
    <div>${balkje(n.pct, "groot")}<div class="zin">${nog}${extra ? ` · ${extra}` : ""}</div></div>
    <div class="pt">${getal(t.punten)}<small>punten</small></div>
  </div>`
}

/** Matrix deelnemers x cursussen (centrale en beheer). Klik op een rij voor het detail. */
export function matrix(deelnemers, { bedrijf = false } = {}) {
  const codes = []
  for (const d of deelnemers) for (const c of d.cursussen) if ((c.toegang || c.deels || c.af) && !codes.includes(c.code)) codes.push(c.code)
  if (!deelnemers.length) return `<div class="leeg">Geen deelnemers gevonden.</div>`
  const cel = (d, code) => {
    const c = d.cursussen.find((x) => x.code === code)
    if (!c || !(c.toegang || c.deels || c.af)) return `<td class="c"><span class="geen">—</span></td>`
    const p = c.pct ?? null
    return `<td class="c" title="${esc(c.titel)}">${p !== null ? balkje(p) : ""}<span class="p">${p !== null ? pctTekst(p) : `${c.af} les`}</span>${c.attest ? ` <a class="attesticoon" href="/attest/${c.attest.id}" title="Attest ${esc(c.attest.nummer)}">✓</a>` : ""}</td>`
  }
  return `<div class="scroll-x paneel" style="padding:0"><table class="eenvoudig matrix">
    <thead><tr><th>Naam</th>${bedrijf ? "<th>Bedrijf</th>" : "<th>Locatie</th>"}<th class="num">Punten</th>${codes.map((c) => `<th class="c">${esc(c)}</th>`).join("")}<th>Laatst actief</th></tr></thead>
    <tbody>${deelnemers
      .map((d) => `<tr data-deelnemer="${d.id}" tabindex="0">
        <td><strong>${esc(d.naam)}</strong>${d.actief === false ? ` <span class="status s-indicatief">inactief</span>` : ""}<div class="klein zacht">${esc(d.totaal.niveau.naam)}</div></td>
        <td class="klein">${esc(bedrijf ? [d.bedrijf, d.locatie && d.locatie !== d.bedrijf ? d.locatie : ""].filter(Boolean).join(" · ") : d.locatie || "")}</td>
        <td class="num mono">${getal(d.totaal.punten)}</td>
        ${codes.map((c) => cel(d, c)).join("")}
        <td class="klein mono">${d.totaal.laatst ? esc(datum(d.totaal.laatst)) : "—"}</td></tr>`)
      .join("")}</tbody></table></div>`
}

/** Detail van één deelnemer (in een dialoog). */
export function deelnemerDetail(d, { beheer = false } = {}) {
  const t = d.totaal
  const actief = d.cursussen.filter((c) => c.toegang || c.deels || c.af)
  return `${niveauBlok(t)}
    <p class="klein zacht">${esc(d.email)}${d.bedrijf ? ` · ${esc(d.bedrijf)}` : ""}${d.locatie && d.locatie !== d.bedrijf ? ` · ${esc(d.locatie)}` : ""}</p>
    <div class="lkaarten">${actief.length ? actief.map((c) => cursusKaart(c, { beheer })).join("") : `<div class="leeg">Nog geen opleidingen.</div>`}</div>
    ${d.attesten?.length ? `<h3 style="margin:16px 0 6px">Attesten</h3><div class="lijst">${d.attesten
      .map((a) => `<div class="rij"><div><div class="titel"><span class="mono">${esc(a.nummer)}</span> · ${esc(a.cursus)}</div>
        <div class="meta"><span>uitgereikt ${esc(datum(a.uitgereikt_op))}</span>${a.gemaild_op ? `<span>gemaild ${esc(datum(a.gemaild_op))}</span>` : ""}${a.ingetrokken_op ? `<span class="status s-afwijking">ingetrokken ${esc(datum(a.ingetrokken_op))}</span>` : ""}</div></div>
        <div class="knoppen"><a class="knop licht klein" href="/attest/${a.id}" target="_blank" rel="noopener">Bekijken</a>${!a.ingetrokken_op ? `<a class="knop licht klein" href="/attest/${a.id}#mail" target="_blank" rel="noopener">Mailen</a>` : ""}
        ${beheer && !a.ingetrokken_op ? `<button class="knop gevaar klein" type="button" data-intrek="${a.id}" data-nummer="${esc(a.nummer)}">Intrekken</button>` : ""}</div></div>`)
      .join("")}</div>` : ""}
    <h3 style="margin:16px 0 6px">Badges</h3>${badgeLijst(t.badges)}`
}
