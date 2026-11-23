// Page d'accueil en français. Seule la formation chauffeur de camion malaxeur (BMC) existe en français, avec une démo.
// Les autres formations visibles sur la page néerlandaise apparaissent ici « en préparation », sans prix ni démo.
// Quelles formations sont visibles vient de la base de données (Beheer → Cursussen), comme sur la page néerlandaise.
import { esc, euro, getal } from "/gemeen.js"
import { laadProducten, heeftPrijs } from "/prijs.js"
import { CURSUSSEN } from "/cursussen.js"

const $ = (s) => document.querySelector(s)
const FR_OPEN = new Set(["BMC"]) // formations disponibles en français
const FR = {
  BMC: {
    titel: "Chauffeur de camion malaxeur",
    doelgroep: "Chauffeurs de camion malaxeur et chauffeurs d'un malaxeur-pompe",
    omschrijving: "Livrer le béton en sécurité, à l'heure et dans la bonne qualité avec le camion malaxeur. D'abord la base commune (sécurité, connaissance du béton, le client et l'environnement), puis le parcours chauffeur : le camion malaxeur, la conduite, le chargement et le déchargement, le nettoyage et l'entretien.",
    opmerking: "La base (modules 1 à 4) est la même que dans la formation opérateur de pompe à béton.",
    modules: [
      ["1", "Travailler en sécurité : la base", "Base"], ["2", "Connaissance du béton pour chauffeurs et pompistes", "Base"], ["3", "Le client et le chantier", "Base"], ["4", "Environnement et durabilité", "Base"],
      ["M1", "Le camion malaxeur", "Parcours chauffeur"], ["M2", "Conduire un camion malaxeur", "Parcours chauffeur"], ["M3", "Charger, décharger et le chantier", "Parcours chauffeur"], ["M4", "Nettoyage, contrôle et entretien", "Parcours chauffeur"],
    ],
  },
  BPB: { titel: "Opérateur de pompe à béton", doelgroep: "Opérateurs de pompe à béton et chauffeurs d'un malaxeur-pompe" },
  LAB: { titel: "Laborantin béton prêt à l'emploi", doelgroep: "Laborantins et responsables du laboratoire ou de la qualité" },
  DSP: { titel: "Dispatcheur béton", doelgroep: "Dispatcheurs débutants et expérimentés, chefs du dispatching" },
  VRK: { titel: "Vente de béton prêt à l'emploi", doelgroep: "Vendeurs débutants et expérimentés, responsables commerciaux" },
  PLM: { titel: "Diriger une centrale à béton", doelgroep: "Chefs de centrale, gérants et direction" },
  CSC: { titel: "Environnement, CSC et responsabilité sociétale", doelgroep: "Centrales à béton et usines de préfabrication" },
  MENG: { titel: "Composition du béton", doelgroep: "Technologues du béton, responsables qualité et laborantins" },
  BT1: { titel: "Base 1.0 · Comprendre le béton", doelgroep: "Nouveaux collaborateurs, opérateurs de centrale, chauffeurs, dispatching et vente. Aucune connaissance préalable." },
  BT2: { titel: "Technologie du béton 2.0", doelgroep: "Laborantins, technologues, responsables qualité et chefs de centrale" },
  BT3: { titel: "Masterclass technologie du béton 3.0", doelgroep: "Responsables qualité, directeurs techniques, concepteurs de mélanges et conseillers" },
  AI: { titel: "L'IA dans la centrale à béton", doelgroep: "Gérants, responsables qualité et collaborateurs du planning, de la vente ou du dispatching" },
}

// ---------- Connecté ? Le bouton mène vers l'espace personnel ----------
async function sessie() {
  try {
    const s = await fetch("/api/sessie", { credentials: "same-origin" }).then((r) => r.json())
    if (!s.aangemeld) return
    const knop = $("#aanmeldknop")
    knop.textContent = "Mon parcours"
    knop.href = s.bestemming || "/leren/"
  } catch {}
}

function kerncijfers(n, toegangMnd) {
  const bmc = CURSUSSEN.find((c) => c.code === "BMC")
  const cijfers = [
    ["En français", n === null ? "–" : getal(n)],
    ["Modules", bmc ? getal(bmc.modules_aantal || bmc.modules.length) : "–"],
    ["Leçons", bmc ? getal(bmc.lessen) : "–"],
    ["Accès", `${getal(toegangMnd)}<small>mois</small>`],
  ]
  $("#kerncijfers").innerHTML = cijfers.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")
}

const prix = (p) => (heeftPrijs(p) ? `<span class="mono">${esc(euro(p.prijs_excl_btw))}</span>` : `<span class="prijs-volgt">prix à venir</span>`)
const uren = (min) => Math.round(min / 60)

function kaart(c, producten, open) {
  const f = FR[c.code] || { titel: c.titel, doelgroep: "" }
  if (!open)
    return `<article class="cursus" data-groep="${esc(c.groep)}">
      <div class="ckop"><span class="tag">${esc(c.code)}</span><span class="status s-concept">en préparation</span></div>
      <h3>${esc(f.titel)}</h3>
      <p class="voor">${esc(f.doelgroep)}</p>
      <p class="oms">La version française de cette formation est en préparation.</p>
      <div class="cvoet"><span class="zacht">Disponible en néerlandais. En français : bientôt.</span></div>
    </article>`
  const vol = producten.find((p) => p.code === "CRS-" + c.code)
  const cijfers = [[c.modules_aantal || c.modules.length, "modules"], [c.lessen ?? "—", "leçons"], [c.toetsen, "tests"], [c.studieminuten ? `±${uren(c.studieminuten)}` : "—", "heures"]]
  return `<article class="cursus uitgelicht" data-groep="${esc(c.groep)}">
    <div class="ckop"><span class="tag">${esc(c.code)}</span><span class="status s-conform">inscription possible</span></div>
    <h3>${esc(f.titel)}</h3>
    <p class="voor">${esc(f.doelgroep)}</p>
    <p class="oms">${esc(f.omschrijving)}</p>
    <p class="opm">${esc(f.opmerking)}</p>
    <div class="cijferrij">${cijfers.map(([v, l]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join("")}</div>
    <details><summary>Voir les modules</summary><ol class="modlijst">${f.modules.map((m, i) => `${i === 0 || f.modules[i - 1][2] !== m[2] ? `<li class="niv">${esc(m[2])}</li>` : ""}<li><span class="mono">${esc(m[0])}</span><span>${esc(m[1])}</span></li>`).join("")}</ol></details>
    <div class="tegelprijs">${vol ? `${prix(vol)} <span class="zacht">formation complète, hors TVA</span>` : `<span class="zacht">Prix à l'ouverture</span>`}</div>
    <div class="cvoet">${vol ? `<a class="knop" href="/fr/inscription/?product=${encodeURIComponent(vol.code)}">S'inscrire</a>` : ""}<a class="knop licht" href="/fr/demo/${encodeURIComponent(c.code)}/">Voir la démo</a></div>
  </article>`
}

const eur = (n) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n))
const e$ = (v) => `<span class="mono">${esc(eur(v))}</span>`
function voorwaarden(regels, toegangMnd, pf) {
  const m = (v) => `<span class="mono">${getal(v)}</span>`
  const vm = regels.verlenging_maanden ?? 1
  return [
    ["Accès", `Formation complète : ${m(toegangMnd)} mois à partir de l'activation. Les mises à jour pendant cette période sont comprises.`],
    ...(pf ? [["Plateforme", `Accès à la plateforme : ${e$(Number(pf.prijs_excl_btw) / 12)} par mois et par personne, minimum un an (${e$(pf.prijs_excl_btw)} par an, facturés à l'avance). Se renouvelle chaque fois d'un an, sauf résiliation avant la fin. En plus, vous payez par formation suivie.`]] : []),
    ["Prolonger", `Chaque fois ${m(vm)} mois pour ${m(regels.verlenging_prijs_pct ?? 25)}&#8239;% du prix initial, au maximum ${m(regels.verlenging_max ?? 3)} fois, à demander dans les ${m(regels.verlenging_venster_maanden ?? 3)} mois après le début.`],
    ["Après la date de fin", "L'accès s'arrête. Votre progression et vos résultats restent enregistrés."],
    ["Paiement", `Accès après paiement de la facture. Le prix est fixé au moment de votre demande. Prix hors TVA de ${m(regels.btw_pct ?? 21)}&#8239;%.`],
    ["Entreprises", "Prix par place. Chaque place est attribuée à un seul collaborateur. Une personne peut aussi être facturée au nom d'une société."],
    ["Nouvelles versions", "Si un module change pendant votre accès, vous recevez la nouvelle version. Les leçons terminées et les tests réussis restent valables, sauf si leur contenu a changé de façon importante."],
    ["Contenu", "Les formations ont été composées avec le plus grand soin. En cas de doute, consultez toujours les documents normatifs et les règlements : ils restent la référence."],
  ]
}

async function laad() {
  try {
    const { producten, regels, aanbod } = await laadProducten()
    const zichtbaar = CURSUSSEN.filter((c) => aanbod.has(c.code))
    const open = (c) => FR_OPEN.has(c.code) && aanbod.get(c.code) === "inschrijven"
    const lijst = [...zichtbaar.filter(open), ...zichtbaar.filter((c) => !open(c))]
    $("#cursusrooster").innerHTML = lijst.map((c) => kaart(c, producten, open(c))).join("")
    const vol = producten.filter((p) => p.code === "CRS-BMC")
    const toegang = vol[0]?.geldigheid_maanden || 3
    kerncijfers(zichtbaar.filter(open).length, toegang)
    const pf = producten.find((p) => p.code === "ABO-PLATFORM" && heeftPrijs(p))
    $("#voorwaardenlijst").innerHTML = voorwaarden(regels, toegang, pf).map(([k, t]) => `<div><dt>${k}</dt><dd>${t}</dd></div>`).join("")
    $("#prijsinleiding").innerHTML = (pf ? `<strong>Vous payez l'accès à la plateforme, ${e$(Number(pf.prijs_excl_btw) / 12)} par mois et par personne (minimum un an), et en plus chaque formation que vous suivez.</strong> ` : "") + `Tous les prix s'entendent hors <span class="mono">${getal(regels.btw_pct ?? 21)}&#8239;%</span> de TVA et par personne ; une entreprise paie par place. Les formations en préparation auront leur prix à l'ouverture.`
    $("#prijstabellen").innerHTML = vol.length
      ? `<div class="scroll-x"><table class="prijzen"><colgroup><col class="c-product"><col class="c-toegang"><col class="c-prijs"></colgroup>
        <thead><tr><th>Formation</th><th class="num">Accès</th><th class="num">Prix</th></tr></thead>
        <tbody>${pf ? `<tr><td><strong>Accès à la plateforme</strong><span class="zacht">par personne, minimum un an ; se renouvelle chaque année sauf résiliation avant la fin</span></td><td class="num">1 an</td><td class="num">${e$(Number(pf.prijs_excl_btw) / 12)} / mois <span class="zacht">min. 1 an : ${esc(eur(pf.prijs_excl_btw))}</span></td></tr>` : ""}${vol.map((p) => `<tr><td><strong>Formation complète chauffeur de camion malaxeur</strong><span class="zacht">base commune et parcours chauffeur, 8 modules</span></td><td class="num">${getal(p.geldigheid_maanden || 3)} mois</td><td class="num">${prix(p)}</td></tr>`).join("")}</tbody></table></div>
        <div class="knoppen" style="margin-top:14px"><a class="knop" href="/fr/inscription/?product=CRS-BMC">S'inscrire</a></div>`
      : `<p class="zacht">Les prix suivent à l'ouverture.</p>`
  } catch (e) {
    $("#cursusrooster").innerHTML = `<p class="melding fout">Les formations n'ont pas pu être chargées. Réessayez plus tard.</p>`
    $("#prijstabellen").innerHTML = ""
  }
}

kerncijfers(null, 3)
laad()
sessie()
