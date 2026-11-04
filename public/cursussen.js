// Cursusoverzicht voor de startpagina. Bron: de cursussen uit het cursusproject (stand 02.11.2026).
// Of een cursus op de startpagina staat en of je kunt inschrijven, kies je in Beheer → Cursussen (databank, cursussen.startpagina:
// niet tonen, in voorbereiding, inschrijven mogelijk). Het veld status hieronder is informatief uit het cursusproject; de site
// gebruikt het niet meer. klaar: false = module nog in opbouw. demo: er is een publieke demo op /demo/<code>/.
// lessen = lessen zonder de startmodule, praktijkopdrachten en toetsen; studieminuten = leestijd van alle lessen.
// bron: BMC en BPB delen de app en de basis van BMC-BPB (migratie 007); gedeeld = wat ze gemeen hebben (modules, lessen),
// zodat de kerncijfers dat maar één keer tellen. BMC-BPB zelf staat niet in de catalogus.

export const GROEPEN = [
  {
    "id": "rijden",
    "naam": "Chauffeur en pomp"
  },
  {
    "id": "labo",
    "naam": "Labo en kwaliteit"
  },
  {
    "id": "technologie",
    "naam": "Betontechnologie"
  },
  {
    "id": "dispatch",
    "naam": "Dispatch en verkoop"
  },
  {
    "id": "leiding",
    "naam": "Leiding"
  },
  {
    "id": "duurzaam",
    "naam": "Duurzaamheid"
  },
  {
    "id": "digitaal",
    "naam": "AI en digitaal"
  }
]

export const CURSUSSEN = [
  {
    "code": "BMC",
    "titel": "Betonmixerchauffeur",
    "groep": "rijden",
    "status": "open",
    "product": "CRS-BMC",
    "bron": "BMC-BPB",
    "doelgroep": "Betonmixerchauffeurs (BMC) en chauffeurs van een mixerpomp",
    "omschrijving": "Lever beton veilig, op tijd en in de juiste kwaliteit met de truckmixer. Eerst de gemeenschappelijke basis (veiligheid, betonkennis, de klant en het milieu), daarna het traject betonmixerchauffeur: de truckmixer, rijden, laden en lossen, reinigen en onderhoud.",
    "opmerking": "De basis (modules 1 tot 4) is dezelfde in de cursussen betonmixerchauffeur en betonpompbediende. Volg je beide, bijvoorbeeld voor een mixerpomp, dan doe je ze maar één keer.",
    "lessen": 39,
    "toetsen": 8,
    "opdrachten": 8,
    "vragen": 94,
    "studieminuten": 359,
    "modules": [
      {
        "code": "1",
        "titel": "Veilig werken: de basis",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Betonkennis voor BMC en BPB",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "De klant en de werf",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Milieu en duurzaamheid",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "M1",
        "titel": "De truckmixer",
        "niveau": "Traject betonmixerchauffeur",
        "klaar": true
      },
      {
        "code": "M2",
        "titel": "Rijden met een truckmixer",
        "niveau": "Traject betonmixerchauffeur",
        "klaar": true
      },
      {
        "code": "M3",
        "titel": "Laden, lossen en de werf",
        "niveau": "Traject betonmixerchauffeur",
        "klaar": true
      },
      {
        "code": "M4",
        "titel": "Reinigen, controle en onderhoud",
        "niveau": "Traject betonmixerchauffeur",
        "klaar": true
      }
    ],
    "modules_aantal": 8,
    "modules_klaar": 8,
    "demo": true,
    "gedeeld": {
      "modules": 4,
      "lessen": 19
    }
  },
  {
    "code": "BPB",
    "titel": "Betonpompbediende",
    "groep": "rijden",
    "status": "open",
    "product": "CRS-BPB",
    "bron": "BMC-BPB",
    "doelgroep": "Betonpompbedienden (BPB) en chauffeurs van een mixerpomp",
    "omschrijving": "Pomp beton veilig, op tijd en in de juiste kwaliteit. Eerst de gemeenschappelijke basis (veiligheid, betonkennis, de klant en het milieu), daarna het traject betonpompbediende: de betonpomp, opstellen en stabiliseren, pompen, en reinigen, keuring en onderhoud.",
    "opmerking": "De basis (modules 1 tot 4) is dezelfde in de cursussen betonmixerchauffeur en betonpompbediende. Volg je beide, bijvoorbeeld voor een mixerpomp, dan doe je ze maar één keer.",
    "lessen": 39,
    "toetsen": 8,
    "opdrachten": 8,
    "vragen": 94,
    "studieminuten": 365,
    "modules": [
      {
        "code": "1",
        "titel": "Veilig werken: de basis",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Betonkennis voor BMC en BPB",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "De klant en de werf",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Milieu en duurzaamheid",
        "niveau": "Basis",
        "klaar": true
      },
      {
        "code": "P1",
        "titel": "De betonpomp",
        "niveau": "Traject betonpompbediende",
        "klaar": true
      },
      {
        "code": "P2",
        "titel": "Opstellen en stabiliseren",
        "niveau": "Traject betonpompbediende",
        "klaar": true
      },
      {
        "code": "P3",
        "titel": "Pompen",
        "niveau": "Traject betonpompbediende",
        "klaar": true
      },
      {
        "code": "P4",
        "titel": "Reinigen, keuring en onderhoud",
        "niveau": "Traject betonpompbediende",
        "klaar": true
      }
    ],
    "modules_aantal": 8,
    "modules_klaar": 8,
    "demo": true,
    "gedeeld": {
      "modules": 4,
      "lessen": 19
    }
  },
  {
    "code": "LAB",
    "titel": "Laborant stortklaar beton",
    "groep": "labo",
    "status": "open",
    "doelgroep": "Laboranten (niveau 1) en labo- of kwaliteitsverantwoordelijken (niveau 2)",
    "omschrijving": "De proeven van het labo in een stortklaarbetoncentrale, met één doel: bewijzen dat elke m³ beton voldoet aan de bestelling. Van grondstoffen en vochtcorrectie tot productiecontrole, conformiteit en klachten.",
    "lessen": 59,
    "toetsen": 11,
    "opdrachten": 11,
    "vragen": 108,
    "studieminuten": 554,
    "modules": [
      {
        "code": "1",
        "titel": "Het labo in de centrale",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "De grondstoffen",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Proeven op granulaten",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Van recept tot menging",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Proeven op vers beton",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Proefstukken en drukproef",
        "niveau": "Niveau 1 · Laborant",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Specificatie van beton",
        "niveau": "Niveau 2 · Kwaliteitsverantwoordelijke",
        "klaar": true
      },
      {
        "code": "8",
        "titel": "Productiecontrole volgens TRA 550",
        "niveau": "Niveau 2 · Kwaliteitsverantwoordelijke",
        "klaar": true
      },
      {
        "code": "9",
        "titel": "Conformiteit en statistiek",
        "niveau": "Niveau 2 · Kwaliteitsverantwoordelijke",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Receptontwerp en initiële proeven",
        "niveau": "Niveau 2 · Kwaliteitsverantwoordelijke",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "Klachten en problemen",
        "niveau": "Niveau 2 · Kwaliteitsverantwoordelijke",
        "klaar": true
      }
    ],
    "modules_aantal": 11,
    "modules_klaar": 11,
    "demo": true,
    "product": "CRS-LAB"
  },
  {
    "code": "DSP",
    "titel": "Betondispatcher",
    "groep": "dispatch",
    "status": "open",
    "doelgroep": "Dispatchers: starters, ervaren dispatchers en hoofddispatchers of transportverantwoordelijken",
    "omschrijving": "Leer stortklaar beton plannen en leveren: de afgesproken dienstverlening tegen de laagste leverkost. Niveau 1 is de basis, niveau 2 de verdieping.",
    "lessen": 44,
    "toetsen": 11,
    "opdrachten": 11,
    "vragen": 110,
    "studieminuten": 404,
    "modules": [
      {
        "code": "1",
        "titel": "De rol van dispatch",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "De rit van een truckmixer",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "De bestelling opnemen",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Basisplanning",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Uitleveren en chauffeurs",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Richtlijnen en organisatie",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Geavanceerde planning",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      },
      {
        "code": "8",
        "titel": "Problemen in het schema",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      },
      {
        "code": "9",
        "titel": "Statussen, GPS en telematica",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Prestaties meten",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "De economie van de levering",
        "niveau": "Niveau 2 · Verdieping",
        "klaar": true
      }
    ],
    "modules_aantal": 11,
    "modules_klaar": 11,
    "demo": true,
    "product": "CRS-DSP"
  },
  {
    "code": "VRK",
    "titel": "Verkoop stortklaar beton",
    "groep": "dispatch",
    "status": "open",
    "doelgroep": "Startende en ervaren verkopers en verkoopsverantwoordelijken",
    "omschrijving": "Leer stortklaar beton verkopen, en daarna verkoop en marketing leiden. Niveau 1 gaat over het verkopen zelf, niveau 2 over markt, klantenbeheer, marketing, duurzaam beton, het verkoopteam en het jaarplan.",
    "lessen": 73,
    "toetsen": 18,
    "opdrachten": 18,
    "vragen": 180,
    "studieminuten": 696,
    "modules": [
      {
        "code": "1",
        "titel": "De rol van de verkoper",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Productkennis voor verkopers",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Het bedrijf van de aannemer",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Bestek lezen en offerte maken",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Prijs zetten",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Verkoopgesprek en onderhandeling",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Van bestelling tot factuur",
        "niveau": "Niveau 1 · Verkopen",
        "klaar": true
      },
      {
        "code": "G1",
        "titel": "Kostprijs per m³ en marge",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G2",
        "titel": "Kwaliteit en certificatie voor managers",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G3",
        "titel": "Mensen leiden en HR",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G4",
        "titel": "Mededinging en ethiek",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G5",
        "titel": "Innovatie en duurzaamheid",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "8",
        "titel": "Markt en werkgebied",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      },
      {
        "code": "9",
        "titel": "Klantenbeheer en verkoopprognose",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Marketing voor een betonbedrijf",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "Duurzaam beton verkopen",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      },
      {
        "code": "12",
        "titel": "Het verkoopteam leiden",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      },
      {
        "code": "13",
        "titel": "Het commerciële jaarplan",
        "niveau": "Niveau 2 · Verkoop en marketing leiden",
        "klaar": true
      }
    ],
    "modules_aantal": 18,
    "modules_klaar": 18,
    "demo": true
  },
  {
    "code": "PLM",
    "titel": "Plant manager stortklaar beton",
    "groep": "leiding",
    "status": "open",
    "doelgroep": "Nieuwe en ervaren plant managers, zaakvoerders en directie",
    "omschrijving": "Leer een stortklaarbetoncentrale leiden, en daarna het hele bedrijf. Niveau 1 gaat over de centrale (veiligheid, installatie, milieu, vloot en planning), niveau 2 over financiën, investeren, strategie, HR, bestuur en innovatie.",
    "lessen": 79,
    "toetsen": 19,
    "opdrachten": 19,
    "vragen": 190,
    "studieminuten": 750,
    "modules": [
      {
        "code": "1",
        "titel": "De rol van de plant manager",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Veiligheid en welzijn",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Installatie, onderhoud en voorraad",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Milieu en vergunning",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Vloot en transport",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Planning en capaciteit",
        "niveau": "Niveau 1 · De centrale leiden",
        "klaar": true
      },
      {
        "code": "G1",
        "titel": "Kostprijs per m³ en marge",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G2",
        "titel": "Kwaliteit en certificatie voor managers",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G3",
        "titel": "Mensen leiden en HR",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G4",
        "titel": "Mededinging en ethiek",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "G5",
        "titel": "Innovatie en duurzaamheid",
        "niveau": "Gedeeld spoor",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Financiën lezen en sturen",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "8",
        "titel": "Klantenkrediet en werkkapitaal",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "9",
        "titel": "Investeren",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Strategie en markt",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "HR-beleid en organisatie",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "12",
        "titel": "Bestuur en rapportering",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "13",
        "titel": "Risico en crisis",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      },
      {
        "code": "14",
        "titel": "Innovatie leiden",
        "niveau": "Niveau 2 · Het bedrijf runnen",
        "klaar": true
      }
    ],
    "modules_aantal": 19,
    "modules_klaar": 19,
    "demo": true
  },
  {
    "code": "CSC",
    "titel": "Milieu, CSC en maatschappelijk verantwoord ondernemen",
    "groep": "duurzaam",
    "status": "voorbereiding",
    "doelgroep": "Betoncentrales en prefabfabrieken: wie mee beslist (niveau 1: directie, plant manager, KAM, verkoop en aankoop) en de milieu-, KAM- of duurzaamheidscoördinator (niveau 2)",
    "omschrijving": "Wat klanten, overheid en bank vragen over milieu, CSC en MVO, en hoe je het aantoont: van de CO2 van je bedrijf tot het CSC-certificaat, de CO2-prestatieladder, ISO 14001, de VSME en EPD’s. Met werkfiches voor de werkvloer.",
    "lessen": 21,
    "toetsen": 5,
    "opdrachten": 5,
    "vragen": 50,
    "studieminuten": 202,
    "modules": [
      {
        "code": "1",
        "titel": "Wie vraagt wat",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Milieu in de centrale en de fabriek",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "CO2 tellen",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "CSC begrijpen",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Maatschappelijk verantwoord ondernemen",
        "niveau": "Niveau 1 · Basis",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Eén dataset voor alles",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "7",
        "titel": "Het CSC-dossier",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "8",
        "titel": "De CSC-audit en een hoger niveau",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "9",
        "titel": "ISO 14001 en milieuwetgeving",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "10",
        "titel": "CO2-footprint en prestatieladder",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "11",
        "titel": "VSME, EPD en vragen uit de keten",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      },
      {
        "code": "12",
        "titel": "Het jaarplan milieu en MVO",
        "niveau": "Niveau 2 · Coördinator",
        "klaar": false
      }
    ],
    "modules_aantal": 12,
    "modules_klaar": 5,
    "demo": true
  },
  {
    "code": "MENG",
    "titel": "Mengselontwerp van beton",
    "groep": "technologie",
    "status": "open",
    "doelgroep": "Betontechnologen en kwaliteitsverantwoordelijken, laboranten die willen doorgroeien, en leveranciers van cement, granulaten en hulpstoffen",
    "omschrijving": "Ontwerp een betonsamenstelling die de eisen haalt, met de grondstoffen die je echt hebt: van grondstoffen over het granulair skelet en de rekenmodellen tot een recept volgens NBN EN 206 en NBN B 15-001. Met een rekentool voor je eigen materialen.",
    "lessen": 30,
    "toetsen": 7,
    "opdrachten": 7,
    "vragen": 59,
    "studieminuten": 448,
    "modules": [
      {
        "code": "1",
        "titel": "Grondstoffen",
        "niveau": "Deel A · Grondstoffen",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Geschiktheid en variabiliteit",
        "niveau": "Deel A · Grondstoffen",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Het granulair skelet",
        "niveau": "Deel B · Ontwerpen",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Rekenmodellen",
        "niveau": "Deel B · Ontwerpen",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Berekening volgens de normen",
        "niveau": "Deel B · Ontwerpen",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Bijzondere betons",
        "niveau": "Deel C · Toepassen",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Rekentool en oefeningen",
        "niveau": "Deel C · Toepassen",
        "klaar": true
      }
    ],
    "modules_aantal": 7,
    "modules_klaar": 7,
    "demo": true,
    "product": "CRS-MENG"
  },
  {
    "code": "BT1",
    "titel": "Basis 1.0 · Beton begrijpen",
    "groep": "technologie",
    "status": "voorbereiding",
    "doelgroep": "Nieuwe medewerkers, centralisten, chauffeurs, dispatching en verkoop binnendienst. Geen voorkennis nodig.",
    "omschrijving": "Iedereen in een betoncentrale beïnvloedt de kwaliteit van het beton. In elf modules krijg je dezelfde taal over beton: wat erin zit, wat er misloopt en waarom de regels bestaan.",
    "opmerking": "Halve dag, klassikaal of online. Conceptversie die nog wordt nagelezen.",
    "lessen": null,
    "toetsen": 12,
    "opdrachten": 0,
    "vragen": 61,
    "studieminuten": 230,
    "modules": [
      {
        "code": "01",
        "titel": "Wat is beton?",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "02",
        "titel": "Grondstoffen in de praktijk",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "03",
        "titel": "De betoncentrale van binnen",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "04",
        "titel": "Van bestelling tot levering",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "05",
        "titel": "Vers beton",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "06",
        "titel": "Verwerking op de werf",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "07",
        "titel": "Verhard beton",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "08",
        "titel": "Speciale betonsoorten",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "09",
        "titel": "Rekenen in de praktijk",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Duurzaamheid en milieu",
        "niveau": "Niveau 1",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "Kwaliteit en BENOR",
        "niveau": "Niveau 1",
        "klaar": true
      }
    ],
    "modules_aantal": 11,
    "modules_klaar": 11,
    "demo": false
  },
  {
    "code": "BT2",
    "titel": "Betontechnologie 2.0",
    "groep": "technologie",
    "status": "voorbereiding",
    "doelgroep": "Laboranten, technologen, kwaliteitsverantwoordelijken en centralechefs. Voorkennis: Basis 1.0 of gelijkwaardige ervaring.",
    "omschrijving": "Het beton van grondstof tot bewijs: bestanddelen, vers en verhard beton, duurzaamheid, specificatie, mengselontwerp, productie en verwerking, speciale betonsoorten, beproeving, conformiteit en certificatie.",
    "opmerking": "Acht lesdagen klassikaal, online als voorbereiding en naslag. Conceptversie die nog wordt nagelezen.",
    "lessen": null,
    "toetsen": 17,
    "opdrachten": 11,
    "vragen": 131,
    "studieminuten": 2850,
    "modules": [
      {
        "code": "01",
        "titel": "Normatief kader en beton als bouwmateriaal",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "02",
        "titel": "Cement",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "03",
        "titel": "Granulaten",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "04",
        "titel": "Water",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "05",
        "titel": "Hulpstoffen",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "06",
        "titel": "Toevoegsels, pigmenten en vezels",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "07",
        "titel": "Betonspecie en verhardend beton",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "08",
        "titel": "Verhard beton",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "09",
        "titel": "Duurzaamheid",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "10",
        "titel": "Specificatie",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "11",
        "titel": "Mengselontwerp",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "12",
        "titel": "Vers beton beproeven",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "13",
        "titel": "Productie, transport, verwerking en nabehandeling",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "14",
        "titel": "Speciale betonsoorten en wegenbeton",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "15",
        "titel": "Verhard beton beproeven en conformiteit",
        "niveau": "Niveau 2",
        "klaar": true
      },
      {
        "code": "16",
        "titel": "Controle, certificatie en productiecontrole",
        "niveau": "Niveau 2",
        "klaar": true
      }
    ],
    "modules_aantal": 16,
    "modules_klaar": 16,
    "demo": false
  },
  {
    "code": "BT3",
    "titel": "Masterclass betontechnologie 3.0",
    "groep": "technologie",
    "status": "voorbereiding",
    "product": "CRS-BT3",
    "doelgroep": "Kwaliteitsverantwoordelijken, technisch directeurs, mengselontwerpers en adviseurs. Voorkennis: Betontechnologie 2.0 en minstens twee jaar praktijk.",
    "omschrijving": "Optimaliseren en verantwoorden: mengsels ontwerpen op prestatie, levensduur, kost en CO2, klinkerarme en circulaire mengsels, milieuprestatie, certificatie, statistiek en procesbeheersing, en schadegevallen analyseren. Je sluit af met een eigen mengselontwerp dat je verdedigt voor een jury.",
    "opmerking": "Nieuwe cursus, eerste versie die nog wordt nagelezen.",
    "lessen": 34,
    "toetsen": 8,
    "opdrachten": 8,
    "vragen": 90,
    "studieminuten": 338,
    "modules": [
      {
        "code": "1",
        "titel": "Mengsels optimaliseren",
        "niveau": "Deel 1 · Mengsels ontwerpen",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Prestatiegerichte duurzaamheid",
        "niveau": "Deel 1 · Mengsels ontwerpen",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Klinkerarme en circulaire mengsels",
        "niveau": "Deel 1 · Mengsels ontwerpen",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "Milieuprestatie",
        "niveau": "Deel 1 · Mengsels ontwerpen",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "Certificatie en duurzaamheidslabels",
        "niveau": "Deel 2 · Beheersen en verantwoorden",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "Statistiek en procesbeheersing",
        "niveau": "Deel 2 · Beheersen en verantwoorden",
        "klaar": true
      },
      {
        "code": "7",
        "titel": "Probleemoplossing",
        "niveau": "Deel 2 · Beheersen en verantwoorden",
        "klaar": true
      },
      {
        "code": "8",
        "titel": "Eindopdracht",
        "niveau": "Deel 2 · Beheersen en verantwoorden",
        "klaar": true
      }
    ],
    "modules_aantal": 8,
    "modules_klaar": 8,
    "demo": true
  },
  {
    "code": "AI",
    "titel": "AI in de betoncentrale",
    "groep": "digitaal",
    "status": "open",
    "doelgroep": "Zaakvoerders, kwaliteitsverantwoordelijken en medewerkers planning, verkoop of dispatching. Geen technische voorkennis nodig.",
    "omschrijving": "Leer AI veilig en nuttig gebruiken in je eigen werk, met oefeningen op taken uit je eigen werkweek. Helpt ook bij de AI-geletterdheid die artikel 4 van de AI-verordening vraagt.",
    "lessen": 30,
    "toetsen": 6,
    "opdrachten": 6,
    "vragen": 60,
    "studieminuten": 278,
    "modules": [
      {
        "code": "1",
        "titel": "AI begrijpen",
        "niveau": "Voor iedereen",
        "klaar": true
      },
      {
        "code": "2",
        "titel": "Veilig en wettelijk",
        "niveau": "Voor iedereen",
        "klaar": true
      },
      {
        "code": "3",
        "titel": "Goed vragen stellen",
        "niveau": "Voor iedereen",
        "klaar": true
      },
      {
        "code": "4",
        "titel": "AI in kwaliteit en certificatie",
        "niveau": "Per rol",
        "klaar": true
      },
      {
        "code": "5",
        "titel": "AI in planning en verkoop",
        "niveau": "Per rol",
        "klaar": true
      },
      {
        "code": "6",
        "titel": "AI in het management",
        "niveau": "Per rol",
        "klaar": true
      }
    ],
    "modules_aantal": 6,
    "modules_klaar": 6,
    "demo": true,
    "product": "CRS-AI"
  }
]
