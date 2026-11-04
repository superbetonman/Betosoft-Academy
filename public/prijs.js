// Gedeeld door de startpagina en de prijzenpagina: producten, prijzen en voorwaarden uit de databank (/api/producten).
// De API geeft enkel producten die te koop zijn, en de cursussen die publiek verschijnen (Beheer → Cursussen):
// aanbod = Map code → "voorbereiding" | "inschrijven". Een cursus die er niet in staat ("niet tonen"), blijft weg.
import { esc, euro, getal } from "/gemeen.js"

let cache = null
export function laadProducten() {
  if (!cache)
    cache = fetch("/api/producten")
      .then((r) => {
        if (!r.ok) throw new Error("De prijzen konden niet geladen worden.")
        return r.json()
      })
      .then((d) => ({
        producten: d.producten || [],
        regels: d.regels || {},
        aanbod: new Map((d.cursussen || []).map((c) => [c.code, c.startpagina])),
      }))
  return cache
}

export const heeftPrijs = (p) => p && p.prijs_excl_btw !== null && p.prijs_excl_btw !== undefined

export function prijsTekst(p) {
  if (!heeftPrijs(p)) return `<span class="prijs-volgt">prijs volgt</span>`
  return `<span class="mono">${esc(euro(p.prijs_excl_btw))}</span>${p.periode === "maand" ? " / maand" : p.periode === "jaar" ? " / jaar" : ""}`
}

export function toegangTekst(p) {
  if (p.periode === "maand") return "per maand, loopt zolang je betaalt"
  if (p.geldigheid_maanden) return `${getal(p.geldigheid_maanden)} maanden vanaf activatie`
  return "—"
}

/** Een traject bij meer dan één cursus: een pakket (bv. BMC en BPB samen). Een gedeelde basismodule is geen pakket. */
export const isPakket = (p) => p.type === "traject" && (p.cursussen || []).length > 1

/**
 * Producten van één cursus: volledige cursus eerst, dan trajecten en pakketten, dan losse modules.
 * Een product hoort bij elke cursus in p.cursussen: een basismodule van BMC en BPB, of een pakket, staat bij beide.
 */
export function productenVan(producten, code) {
  const rang = (p) => (p.code.startsWith("CRS-") ? 0 : p.type === "traject" ? (isPakket(p) ? 2 : 1) : 3)
  return producten
    .filter((p) => (p.cursussen || (p.cursus ? [p.cursus] : [])).includes(code))
    .sort((a, b) => rang(a) - rang(b) || a.code.localeCompare(b.code))
}

/** Prijs voor op een tegel: de volledige cursus, of anders de laagste prijs ("vanaf"). */
export function tegelPrijs(producten, code) {
  const lijst = productenVan(producten, code)
  if (!lijst.length) return null
  const volledig = lijst.find((p) => p.code.startsWith("CRS-"))
  const metPrijs = lijst.filter(heeftPrijs)
  if (volledig && heeftPrijs(volledig)) {
    const goedkoopste = metPrijs.reduce((a, b) => (Number(b.prijs_excl_btw) < Number(a.prijs_excl_btw) ? b : a), volledig)
    return { tekst: `${prijsTekst(volledig)} <span class="zacht">volledige cursus${goedkoopste !== volledig ? `, deel vanaf ${esc(euro(goedkoopste.prijs_excl_btw))}` : ""}</span>`, product: volledig, prijs: true }
  }
  if (metPrijs.length) {
    const g = metPrijs.reduce((a, b) => (Number(b.prijs_excl_btw) < Number(a.prijs_excl_btw) ? b : a))
    return { tekst: `<span class="zacht">vanaf</span> ${prijsTekst(g)}`, product: volledig || g, prijs: true }
  }
  return { tekst: `<span class="prijs-volgt">Prijs volgt</span>`, product: volledig || lijst[0], prijs: false }
}

export function meestVoorkomend(getallen, standaard) {
  const n = {}
  for (const g of getallen) if (g) n[g] = (n[g] || 0) + 1
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]
  return top ? Number(top[0]) : standaard
}

/** De voorwaarden in het kort, met de waarden uit de instellingen. */
export function voorwaardenItems(producten, regels) {
  const m = (v) => `<span class="mono">${getal(v)}</span>`
  const toegangMnd = meestVoorkomend(producten.filter((p) => p.type !== "abonnement").map((p) => p.geldigheid_maanden), 3)
  const vm = regels.verlenging_maanden ?? 1
  return {
    toegangMnd,
    items: [
      ["Toegang", `Losse modules, niveaus en volledige cursussen: ${m(toegangMnd)} maanden vanaf de activatie. Updates in die periode zijn inbegrepen.`],
      ["Abonnement", "Jaarabonnement: 12 maanden toegang tot alle cursussen. Maandabonnement: loopt per maand zolang je betaalt."],
      [
        "Verlengen",
        `Telkens ${m(vm)} ${vm === 1 ? "maand" : "maanden"} voor ${m(regels.verlenging_prijs_pct ?? 25)}&#8239;% van de oorspronkelijke prijs, maximaal ${m(regels.verlenging_max ?? 3)} keer, aan te vragen binnen ${m(regels.verlenging_venster_maanden ?? 3)} maanden na de start.`,
      ],
      ["Na de einddatum", "De toegang stopt. Je voortgang en resultaten blijven bewaard."],
      ["Betalen", `Toegang na betaling van de factuur. De prijs ligt vast op het moment van je aanvraag. Prijzen exclusief ${m(regels.btw_pct ?? 21)}&#8239;% btw.`],
      ["Ondernemingen", "Prijs per plaats. Elke plaats wordt toegewezen aan één medewerker. Een persoon kan ook op naam van een bedrijf gefactureerd worden."],
      ["Nieuwe versies", "Wijzigt een module tijdens je toegang, dan krijg je de nieuwe versie. Afgeronde lessen en geslaagde toetsen blijven gelden, tenzij de inhoud ervan wezenlijk wijzigde."],
      ["Inhoud", "De cursussen zijn met de grootste zorg samengesteld. Raadpleeg in geval van twijfel altijd de normatieve documenten en reglementen; die blijven de referentie."],
    ],
  }
}
