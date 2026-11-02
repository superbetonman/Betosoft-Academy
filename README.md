# Betosoft Academie – stap 1 (inschrijvingen, toegangsrechten, beheer)

## Wat erin zit
- `/aanvragen/` – inschrijfformulier voor personen en centrales (product, plaatsen, akkoord).
- `/beheer/` – beheerscherm: overzicht, aanvragen (factuur noteren, activeren, weigeren), toegangsrechten (verlengen, pauzeren, intrekken, plaatsen), centrales (personen, plaatsen toewijzen), cursisten, producten (prijs, geldigheid), logboek.
- `netlify/functions/` – API (`/api/...`) op Netlify Functions in Frankfurt.
- Databank: Neon-project `betosoft-academie` (id `summer-water-53285175`), databank `academie`, regio Frankfurt.

## Publiceren vanaf je laptop
1. Pak de zip uit, bv. in `C:\Users\<jij>\Projects\betosoft-academie`.
2. Open een terminal in die map en voer uit:
   ```
   npm install
   npx netlify-cli deploy --prod --site a9afee37-bd4f-40f1-8bca-c649d96c7ceb
   ```
   Meld je aan bij Netlify als daarom gevraagd wordt.
3. Open https://betosoft-academie.netlify.app/beheer/ en meld je aan met het beheerderswachtwoord.

## Omgevingsvariabelen (staan al in Netlify, context productie)
- `DATABASE_URL` – verbinding met Neon
- `SESSIE_GEHEIM` – sleutel voor de aanmeldsessie
- `ADMIN_WACHTWOORD` – beheerderswachtwoord (wijzigen: Netlify > Project configuration > Environment variables, daarna opnieuw publiceren)

## Werkwijze
1. Klant vult `/aanvragen/` in → aanvraag "nieuw".
2. Jij factureert in je boekhoudtool → "Factuur noteren".
3. Na betaling → "Activeren": toegang start, einde volgens de geldigheid van het product.
4. Maandabonnement: na elke betaling "Verlengen" (+1 maand, vanaf het huidige einde of vanaf vandaag als het verlopen is).
5. Centrale: personen toevoegen en plaatsen toewijzen; het systeem weigert meer plaatsen dan gekocht.

## Bedrijfsregels in de databank
`activeer_aanvraag`, `verleng_recht`, `wijs_plaats_toe`, `voeg_cursist_toe` – elke actie slaagt volledig of wijzigt niets, en komt in `auditlog`.
Toegang per module: view `v_module_toegang` (persoonlijk recht + plaats via centrale, enkel geldige rechten).

## Volgende stappen
2. Cursusspeler met voortgang · 3. Toetsen en score · 4. Attesten met verificatiepagina · 5. Dashboard voor centrales · 6. Punten en badges · uitnodigingsmail (Brevo) en aanmelden voor cursisten.
