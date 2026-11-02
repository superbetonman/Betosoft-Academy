// Cursusoverzicht voor de startpagina. Bron: de cursussen zoals gebouwd in het cursusproject (stand 02.11.2026).
// status "open" = er is een product om in te schrijven (code in `product`); "voorbereiding" = nog niet te koop.
// Tellingen: lessen zonder praktijkopdrachten en toetsen; studieminuten = som van de leestijd van de lessen.

export const GROEPEN = [
  { id: "rijden", naam: "Chauffeur en pomp" },
  { id: "labo", naam: "Labo en kwaliteit" },
]

export const CURSUSSEN = [
  {
    code: "LAB",
    titel: "Laborant stortklaar beton",
    groep: "labo",
    status: "voorbereiding",
    doelgroep: "Laboranten (niveau 1) en labo- of kwaliteitsverantwoordelijken (niveau 2)",
    omschrijving:
      "De proeven van het labo in een stortklaarbetoncentrale, met één doel: bewijzen dat elke m³ beton voldoet aan de bestelling. Van grondstoffen en vochtcorrectie tot productiecontrole, conformiteit en klachten.",
    normen: ["NBN EN 206", "NBN B 15-001", "TRA 550"],
    modules_aantal: 12,
    lessen: 61,
    opdrachten: 11,
    toetsen: 11,
    vragen: 108,
    studieminuten: 554,
    modules: [
      { code: "0", titel: "Start", niveau: "Start" },
      { code: "1", titel: "Het labo in de centrale", niveau: "Niveau 1 · Laborant" },
      { code: "2", titel: "De grondstoffen", niveau: "Niveau 1 · Laborant" },
      { code: "3", titel: "Proeven op granulaten", niveau: "Niveau 1 · Laborant" },
      { code: "4", titel: "Van recept tot menging", niveau: "Niveau 1 · Laborant" },
      { code: "5", titel: "Proeven op vers beton", niveau: "Niveau 1 · Laborant" },
      { code: "6", titel: "Proefstukken en drukproef", niveau: "Niveau 1 · Laborant" },
      { code: "7", titel: "Specificatie van beton", niveau: "Niveau 2 · Kwaliteitsverantwoordelijke" },
      { code: "8", titel: "Productiecontrole volgens TRA 550", niveau: "Niveau 2 · Kwaliteitsverantwoordelijke" },
      { code: "9", titel: "Conformiteit en statistiek", niveau: "Niveau 2 · Kwaliteitsverantwoordelijke" },
      { code: "10", titel: "Receptontwerp en initiële proeven", niveau: "Niveau 2 · Kwaliteitsverantwoordelijke" },
      { code: "11", titel: "Klachten en problemen", niveau: "Niveau 2 · Kwaliteitsverantwoordelijke" },
    ],
  },
]
