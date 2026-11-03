# Betosoft Academie

Leerplatform voor de betonsector: inschrijvingen, toegangsrechten, versies per module, centrales met eigen beheerder, verlengingen.
Netlify (`betosoft-academy`, statische pagina's + functies in Frankfurt) en Neon (project `betosoft-academy`, databank `academy`, Frankfurt).

## Pagina's
| Pad | Voor wie | Wat |
|---|---|---|
| `/aanvragen/` | publiek | Inschrijven als persoon of centrale |
| `/aanmelden/` | iedereen | Aanmelden met gebruikersnaam of e-mail + wachtwoord |
| `/welkom/?t=…` | nieuwe gebruiker | Wachtwoord kiezen via uitnodigingslink (14 dagen geldig, één keer) |
| `/beheer/` | superadmin, beheerder | Aanvragen, toegangsrechten, centrales, cursisten, leerlijn, cursussen (online/offline), versies, instellingen, logboek |
| `/centrale/` | beheerder van een centrale of locatie | Overzicht, medewerkers, leerlijn, scorebord, opleidingen, locaties |
| `/` | publiek | Startpagina: cursussen (uit `public/cursussen.js`) met prijs en demo, werkwijze, centrales, voorwaarden |
| `/prijzen/` | publiek | Alle prijzen: abonnement, per cursus (volledig, niveaus, losse modules), centrales, voorwaarden |
| `/demo/<CODE>/` | publiek | Teaser van een cursus: de start en vier lessen uit verschillende modules; de rest zit niet in het bestand |
| `/leren/` | iedereen die aangemeld is | Mijn leerlijn: niveau en punten, voortgang per cursus en module, volgende stap, attesten, badges; beheerders zien alle cursussen (tester) |
| `/scores/` | iedereen die aangemeld is | Klassement algemeen, per bedrijf en binnen het eigen bedrijf; zo verdien je punten |
| `/cursus/<CODE>/` | met toegang | De volledige cursusapp met menubalk (startpagina, leerlijn, scores); voortgang in de databank (`cursus_gegevens`) |
| `/attest/<id>` | wie de link heeft | Attest (A4 liggend) afdrukken of als PDF bewaren, mailen, en controleren of het geldig is |
| `/attest/voorbeeld/<CODE>` | beheerder | Voorbeeldattest van een cursus |

## Rollen
- **superadmin** (`superbetonman`): alles, plus prijzen, voorwaarden, verlengingsregels en beheerders.
- **beheerder**: dagelijks beheer (aanvragen, activeren, verlengen, centrales, versies).
- **centrale_verantwoordelijke**: beheert de eigen centrale; op hoofdniveau ook alle locaties.
- **cursist**.

## Werkwijze
1. Aanvraag komt binnen (formulier, bestelling van een centrale of verlengingsaanvraag). Het bedrag wordt vastgelegd.
2. Factureren in de eigen boekhoudtool → factuurnummer noteren.
3. Na betaling **Activeren**. Je krijgt een uitnodigingslink om door te sturen.
4. Een centrale voegt zelf medewerkers toe, wijst plaatsen toe en ziet voortgang en scorebord.

## Toegang en verlenging
- Modules en trajecten: 3 maanden toegang vanaf de start. Updates in die periode zijn inbegrepen.
- Verlenging: 1 maand voor 25 % van de oorspronkelijke prijs, maximaal 3 keer, aan te vragen binnen 3 maanden na de start.
  Alle waarden staan in **Beheer → Instellingen** (tabel `instellingen`).
- Niet verlengd → de toegang stopt op de einddatum. De voortgang blijft bewaard.

## Versies per module
- Status: concept → (proef) → actueel → archief. Eén actuele versie per module.
- Een nieuwe versie start als kopie. Het overzicht toont per les en toetsvraag: nieuw, inhoudelijk gewijzigd, redactioneel gewijzigd, weggevallen, verplaatst.
- Elke gewijzigde les of vraag moet je beoordelen (inhoudelijk of redactioneel) vóór publicatie.
- Bij publicatie als actueel gaan cursisten met lopende toegang mee. Afgeronde lessen met dezelfde sleutel en zonder inhoudelijke wijziging blijven afgerond; een geslaagde toets blijft geldig als geen enkele vraag inhoudelijk wijzigde.
- Proefversie: enkel zichtbaar voor de proefgroep (personen of hele centrales).

## Cursusapps
- De cursussen zijn gebouwd als losse apps (claude.ai-artifacts). Ze staan in de tabel `cursus_bestanden`, **niet** in deze publieke repo.
- `public/cursus-academie.js` levert de functies die de apps verwachten (`window.claude.use("db" | "user" | "downloads")`):
  voortgang en eigen gegevens gaan per gebruiker naar `/api/leren/gegevens/<CODE>`. Het voegt ook de disclaimer, de demoband en de foutmelder toe.
- Toegang tot `/cursus/<CODE>/`: beheerders altijd (tester); een cursist als hij toegang heeft tot alle modules van de cursus.
- Twee versies per cursus: `index.html` voor cursisten (zonder opnamebriefings, AI-prompts, posterprompts en mediaplan; de
  beeldvakken staan als placeholder "Volgt binnenkort") en `beheer.html` voor beheerders (met die productie-informatie).
  De demo vertrekt van de cursistenversie. Die teksten zitten dus ook niet in de broncode die een cursist ontvangt.
- Demo (`demo.html`): de start (module 0) en vier lessen, elk uit een ander hoofdstuk en verspreid over de cursus.
  De keuze staat per cursus in `bouw.mjs` (`demo: ["m1-l1", "m4-l1", ...]`). Uit een los modulescript gaat enkel de
  gekozen les mee, ingebouwd in `demo.html`. Elke module toont in de demo "1 van 7 onderdelen in de demo".
- Bijwerken: `scripts/cursusapps/bouw.mjs` (volledige versie + demo) en `scripts/cursusapps/opladen.mjs`.

## Cursussen online
- Alle tien cursussen staan online (`cursussen.gepubliceerd`). Aan- en uitzetten in **Beheer → Cursussen**. Offline: enkel beheerders (tester).
- Elke cursus heeft modules en een product `CRS-<CODE>` (VRK, PLM, CSC, BT1, BT2 sinds migratie 004, nog zonder prijs).
  Modules in voorbereiding staan met `gepubliceerd = false`; op de startpagina heten die cursussen "eerste modules online".
- Boven elke cursus (en demo) staat een menubalk: startpagina, mijn leerlijn, scores (en beheer of mijn centrale). In de bovenbalk van
  de app zit een knop terug naar de leerlijn (in een demo: naar de cursussen).

## Leerlijn, scores en attesten
- **Lessenlijst.** De apps houden hun modules en lessen in `COURSE`, binnen een afgesloten functie. Een haak (`window.ACADEMIE_COURSE`,
  ingevoegd door `bouw.mjs` en voor de bestaande bestanden door migratie 004) geeft ze door; `cursus-academie.js` stuurt ze naar
  `/api/leren/structuur/<CODE>` (tabel `cursus_structuur`). BT1 en BT2 hebben geen `COURSE`: de brug leest de modules uit de pagina.
  Een beheerder die de cursus opent, **bevestigt** de lessenlijst (ook na elke nieuwe versie van de app: *Beheer → Cursussen* toont het).
  Een cursist kan enkel een eerste, voorlopige lijst aanleveren. Attesten komen er alleen met een bevestigde lijst.
- **Voortgang.** Uit het voortgangsdocument van de app (`data/users/<id>/progress`: `done`, `quiz`). Een toets telt als afgerond zodra
  ze geslaagd is. BT1 en BT2 bewaren enkel in de browser; de brug synchroniseert dat met het account (ook naar een ander toestel).
- **Wie ziet wat.** Deelnemer: *Mijn leerlijn*. Bedrijf: *Centrale → Leerlijn* (matrix medewerkers × cursussen, detail per medewerker)
  en *Scorebord*. Superadmin en beheerders: *Beheer → Leerlijn* (alle bedrijven, filter en zoeken; attest intrekken of handmatig uitreiken).
- **Punten** (`netlify/lib/leerlijn.mts`): les 10, praktijkopdracht 15, toets 20, toets zonder fouten +10, module af +25, cursus af +100,
  badge +20. Zes niveaus (Starter tot Meester) en elf badges. Klassement: alle deelnemers (voornaam en initiaal), bedrijven (gemiddelde
  per deelnemer met een opleiding) en het eigen bedrijf. Beheerders (testers) tellen niet mee.
- **Attest.** Vanzelf bij een volledig afgeronde cursus (alle lessen in de modules die online staan, alle toetsen geslaagd), één per
  persoon en cursus, met nummer `BSA-<jaar>-<volgnummer>`. Een ingetrokken attest komt niet vanzelf terug (wel handmatig).
  Afdrukken of als PDF bewaren vanuit de attestpagina. **Mailen**: de deelnemer, zijn centrale of een beheerder; via Brevo als
  `BREVO_API_KEY` en `MAIL_AFZENDER` ingesteld zijn, anders opent het eigen mailprogramma met het bericht klaar. Maximaal 10 mails per attest per dag.

## Lichte en donkere modus
- Knop met zon of maan in de kopbalk van elke pagina (`public/thema.js`, in `<head>`) en in de bovenbalk van elke cursus (`cursus-academie.js`).
- Zonder keuze volgt de site het toestel; de keuze wordt in de browser bewaard (`academie-thema`) en geldt op de site en in de cursussen.

## Meldingen
- Knop **Fout melden** rechts op elke pagina en in de cursussen (`public/fout.js`), naar het model van de bevindingen in Betosoft:
  melding over het scherm of over een aangeduid onderdeel, met ernst, automatische context en schermafbeelding.
- Opvolging in **Beheer → Meldingen** (status en antwoord); aangemelde gebruikers zien hun meldingen via *Mijn meldingen*.

## Databank
- `migraties/002_versies.sql`: versies, instellingen, verlengingen, locaties, uitnodigingen, medewerkerstand.
- `migraties/003_cursusapps_meldingen.sql`: cursusbestanden, voortgang per cursusapp, meldingen; cursussen LAB, DSP, MENG, AI open met modules en producten.
- `migraties/004_online_leerlijn_scores_attesten.sql`: modules en producten voor VRK, PLM, CSC, BT1, BT2; alle cursussen online;
  `cursus_structuur`; attesten met momentopname en mailteller; de haak in de opgeslagen cursusapps.
  De basis (stap 1) werd rechtstreeks in Neon aangemaakt.
- Bedrijfsregels zitten in databankfuncties: `activeer_aanvraag`, `verleng_recht`, `vraag_verlenging`, `wijs_plaats_toe`,
  `voeg_cursist_toe`, `nieuwe_versie`, `beoordeel_wijziging`, `publiceer_versie`, `zet_op_versie`. Elke actie komt in `auditlog`.

## Omgevingsvariabelen (Netlify, productie)
- `DATABASE_URL` – verbinding met Neon
- `SESSIE_GEHEIM` – sleutel voor de aanmeldsessie
- `BREVO_API_KEY`, `MAIL_AFZENDER` (geverifieerd in Brevo), optioneel `MAIL_AFZENDER_NAAM` – attesten mailen (zonder: eigen mailprogramma)

## Lokaal controleren
```
npm install
npx tsc -p .
```

## Volgende stappen
Inhoudseditor en cursusspeler · toetsen op de server afnemen (nu beoordeelt de app zelf) · PDF als bijlage bij het attest ·
e-mails via Brevo ook voor uitnodiging, herinnering voor het einde en verlenging · klassement cachen als het aantal deelnemers groeit.
