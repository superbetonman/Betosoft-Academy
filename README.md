# Betosoft Academie

Leerplatform voor de betonsector: inschrijvingen, toegangsrechten, versies per module, centrales met eigen beheerder, verlengingen.
Netlify (`betosoft-academy`, statische pagina's + functies in Frankfurt) en Neon (project `betosoft-academy`, databank `academy`, Frankfurt).

## Pagina's
| Pad | Voor wie | Wat |
|---|---|---|
| `/aanvragen/` | publiek | Inschrijven als persoon of centrale |
| `/aanmelden/` | iedereen | Aanmelden met gebruikersnaam of e-mail + wachtwoord |
| `/welkom/?t=…` | nieuwe gebruiker | Wachtwoord kiezen via uitnodigingslink (14 dagen geldig, één keer) |
| `/beheer/` | superadmin, beheerder | Aanvragen, toegangsrechten, centrales, cursisten, versies, instellingen, logboek |
| `/centrale/` | beheerder van een centrale of locatie | Overzicht, medewerkers, scorebord, opleidingen, locaties |
| `/` | publiek | Startpagina: cursussen (uit `public/cursussen.js`) met prijs en demo, werkwijze, centrales, voorwaarden |
| `/prijzen/` | publiek | Alle prijzen: abonnement, per cursus (volledig, niveaus, losse modules), centrales, voorwaarden |
| `/demo/<CODE>/` | publiek | Teaser van een cursus: de start en de eerste lessen; de rest zit niet in het bestand |
| `/leren/` | cursist, beheerder | Mijn opleidingen; beheerders zien alle cursussen en volgen ze als tester |
| `/cursus/<CODE>/` | met toegang | De volledige cursusapp; voortgang in de databank (`cursus_gegevens`) |

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
- Bijwerken: `scripts/cursusapps/bouw.mjs` (volledige versie + demo) en `scripts/cursusapps/opladen.mjs`.

## Meldingen
- Knop **Fout melden** rechts op elke pagina en in de cursussen (`public/fout.js`), naar het model van de bevindingen in Betosoft:
  melding over het scherm of over een aangeduid onderdeel, met ernst, automatische context en schermafbeelding.
- Opvolging in **Beheer → Meldingen** (status en antwoord); aangemelde gebruikers zien hun meldingen via *Mijn meldingen*.

## Databank
- `migraties/002_versies.sql`: versies, instellingen, verlengingen, locaties, uitnodigingen, medewerkerstand.
- `migraties/003_cursusapps_meldingen.sql`: cursusbestanden, voortgang per cursusapp, meldingen; cursussen LAB, DSP, MENG, AI open met modules en producten.
  De basis (stap 1) werd rechtstreeks in Neon aangemaakt.
- Bedrijfsregels zitten in databankfuncties: `activeer_aanvraag`, `verleng_recht`, `vraag_verlenging`, `wijs_plaats_toe`,
  `voeg_cursist_toe`, `nieuwe_versie`, `beoordeel_wijziging`, `publiceer_versie`, `zet_op_versie`. Elke actie komt in `auditlog`.

## Omgevingsvariabelen (Netlify, productie)
- `DATABASE_URL` – verbinding met Neon
- `SESSIE_GEHEIM` – sleutel voor de aanmeldsessie

## Lokaal controleren
```
npm install
npx tsc -p .
```

## Volgende stappen
Inhoudseditor en cursusspeler · toetsen afnemen · attesten met verificatiepagina · punten en badges toekennen · e-mails via Brevo (uitnodiging, herinnering voor het einde, verlenging).
