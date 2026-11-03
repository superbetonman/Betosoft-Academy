// Prijzenpagina: abonnement, per cursus (volledige cursus, niveaus/trajecten, losse modules), ondernemingen en voorwaarden.
import { esc, euro, getal } from "/gemeen.js"
import { CURSUSSEN } from "/cursussen.js"
import { laadProducten, productenVan, prijsTekst, toegangTekst, heeftPrijs, voorwaardenItems } from "/prijs.js"

const $ = (s) => document.querySelector(s)

function tabel(lijst) {
  return `<div class="scroll-x"><table class="prijzen">
    <colgroup><col class="c-product"><col class="c-toegang"><col class="c-prijs"></colgroup>
    <thead><tr><th>Product</th><th>Toegang</th><th class="num">Prijs excl. btw</th></tr></thead>
    <tbody>${lijst
      .map(
        (p) => `<tr><td><strong>${esc(p.naam)}</strong>${p.beschrijving ? `<span class="zacht">${esc(p.beschrijving)}</span>` : ""}
          <a class="klein" href="/aanvragen/?product=${encodeURIComponent(p.code)}">Inschrijven</a></td>
        <td class="toegang">${esc(toegangTekst(p))}</td><td class="num">${prijsTekst(p)}</td></tr>`,
      )
      .join("")}</tbody></table></div>`
}

async function laad() {
  try {
    const { producten, regels } = await laadProducten()
    const btw = regels.btw_pct ?? 21
    $("#inleiding").innerHTML = `<strong>Je betaalt per cursus, per niveau of per module</strong>, of je neemt een abonnement voor alle cursussen. Prijzen exclusief <span class="mono">${getal(btw)}&#8239;%</span> btw, per persoon. Een onderneming betaalt per plaats.`

    const abo = producten.filter((p) => p.type === "abonnement")
    $("#abonnementen").innerHTML = abo.length ? tabel(abo) : `<p class="zacht">Er is nog geen abonnement.</p>`

    const blokken = CURSUSSEN.map((c) => {
      const lijst = productenVan(producten, c.code)
      if (!lijst.length) return ""
      const hoofd = lijst.filter((p) => p.type !== "module")
      const mods = lijst.filter((p) => p.type === "module")
      return `<div class="cursusprijs" id="${esc(c.code)}">
        <h3>${esc(c.titel)} <span class="tag">${esc(c.code)}</span></h3>
        <p class="sub">${esc(c.doelgroep)}</p>
        ${hoofd.length ? tabel(hoofd) : ""}
        ${mods.length ? `<div class="prijsgroep" style="margin-top:8px"><details><summary><h3 style="font-size:15px">Losse modules <span class="zacht">${mods.length} modules</span></h3></summary>${tabel(mods)}</details></div>` : ""}
        <div class="knoppen">${c.demo ? `<a class="knop licht" href="/demo/${encodeURIComponent(c.code)}/">Bekijk de demo</a>` : ""}</div>
      </div>`
    }).join("")
    const nogNiet = CURSUSSEN.filter((c) => !productenVan(producten, c.code).length)
    $("#cursusprijzen").innerHTML =
      blokken +
      (nogNiet.length
        ? `<p class="zacht">In opbouw, prijs bij de opening: ${nogNiet.map((c) => (c.demo ? `<a href="/demo/${encodeURIComponent(c.code)}/">${esc(c.titel)}</a>` : esc(c.titel))).join(", ")}.</p>`
        : "")

    // Rekenvoorbeeld voor een onderneming met de eerste volledige cursus die een prijs heeft
    const vb = producten.find((p) => p.code.startsWith("CRS-") && heeftPrijs(p))
    $("#rekenvoorbeeld").innerHTML = vb
      ? `<p class="label" style="margin:0 0 6px">Rekenvoorbeeld</p><p style="margin:0">${esc(vb.naam)} voor 5 medewerkers: <span class="mono">5 × ${esc(euro(vb.prijs_excl_btw))} = ${esc(euro(5 * Number(vb.prijs_excl_btw)))}</span> excl. btw.</p>`
      : `<p class="label" style="margin:0 0 6px">Rekenvoorbeeld</p><p style="margin:0">5 plaatsen voor een volledige cursus = 5 × de prijs per persoon. De prijzen worden vastgelegd tijdens de testfase.</p>`

    const v = voorwaardenItems(producten, regels)
    $("#voorwaardenlijst").innerHTML = v.items.map(([k, t]) => `<div><dt>${k}</dt><dd>${t}</dd></div>`).join("")
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView()
  } catch (e) {
    $("#cursusprijzen").innerHTML = `<p class="melding fout">${esc(e.message)}</p>`
  }
}

async function sessie() {
  try {
    const s = await (await fetch("/api/sessie", { credentials: "same-origin" })).json()
    if (!s.aangemeld) return
    const k = $("#aanmeldknop")
    const rol = s.gebruiker?.rol
    k.textContent = rol === "superadmin" || rol === "beheerder" ? "Naar beheer" : rol === "centrale_verantwoordelijke" ? "Naar mijn onderneming" : "Mijn opleidingen"
    k.href = s.bestemming || "/leren/"
  } catch {}
}

laad()
sessie()
