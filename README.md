# Betosoft Academie

Leerplatform voor de betonsector: inschrijvingen, toegangsrechten, versies per module, centrales met eigen beheerder, verlengingen.
Netlify (statische pagina's + functies in Frankfurt) en Neon (Postgres, Frankfurt).

## Pagina's
| Pad | Voor wie | Wat |
|---|---|---|
| `/aanvragen/` | publiek | Inschrijven als persoon of centrale |
| `/aanmelden/` | iedereen | Aanmelden met gebruikersnaam of e-mail + wachtwoord |
| `/welkom/?t=…` | nieuwe gebruiker | Wachtwoord kiezen via uitnodigingslink (14 dagen geldig, één keer) |
| `/beheer/` | superadmin, beheerder | Aanvragen, toegangsrechten, centrales, cursisten, versies, instellingen, logboek |
| `/centrale/` | beheerder van een centrale of locatie | Overzicht, medewerkers, scorebord, opleidingen, locaties |
| `/leren/` | cursist | Voorlopig welkomstpagina; cursusspeler volgt |

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

## Databank
- `migraties/002_versies.sql`: versies, instellingen, verlengingen, locaties, uitnodigingen, medewerkerstand.
  De basis (stap 1) werd rechtstreeks in Neon aangemaakt.
- Bedrijfsregels zitten in databankfuncties: `activeer_aanvraag`, `verleng_recht`, `vraag_verlenging`, `wijs_plaats_toe`,
  `voeg_cursist_toe`, `nieuwe_versie`, `beoordeel_wijziging`, `publiceer_versie`, `zet_op_versie`. Elke actie komt in `auditlog`.

## Omgevingsvariabelen (Netlify, productie)
- `DATABASE_URL` – verbinding met Neon
- `SESSIE_GEHEIM` – sleutel voor de aanmeldsessie
- `ADMIN_WACHTWOORD` – niet meer gebruikt (aanmelden gaat nu via gebruikersnaam en wachtwoord in de databank)

## Lokaal controleren
```
npm install
npx tsc -p .
```

## Volgende stappen
Inhoudseditor en cursusspeler · toetsen afnemen · attesten met verificatiepagina · punten en badges toekennen · e-mails via Brevo (uitnodiging, herinnering voor het einde, verlenging).
