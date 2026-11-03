-- =====================================================================
-- 004 · Alle cursussen online, cursusstructuur, leerlijn, scores en attesten
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Modules en producten voor de vijf cursussen die nog geen modules hadden
--    (VRK, PLM, CSC, BT1, BT2). Codes en titels uit public/cursussen.js.
--    gepubliceerd = de module is klaar; modules in voorbereiding staan in de app als "in voorbereiding".
-- ---------------------------------------------------------------------
UPDATE cursussen SET beschrijving = v.beschrijving
FROM (VALUES
 ('VRK', 'Stortklaar beton verkopen, daarna verkoop en marketing leiden. Eerste modules online, de rest volgt.'),
 ('PLM', 'Een stortklaarbetoncentrale leiden, daarna het hele bedrijf. Eerste modules online, de rest volgt.'),
 ('CSC', 'Duurzaamheid in de centrale: CO₂, CSC-certificaat, prestatieladder, EPD en CSRD. Niveau 1 online, niveau 2 volgt.'),
 ('BT1', 'Dezelfde taal over beton voor iedereen in de centrale: elf modules, geen voorkennis nodig.'),
 ('BT2', 'Beton van grondstof tot bewijs: zestien modules voor laboranten, technologen en kwaliteitsverantwoordelijken.')
) AS v(code, beschrijving)
WHERE cursussen.code = v.code;

INSERT INTO modules (cursus_id, code, titel, traject, volgorde, gepubliceerd)
SELECT c.id, m.code, m.titel, m.traject, m.volgorde, m.klaar
FROM (VALUES
 ('VRK', '1', 'De rol van de verkoper', 'niveau1', 1, true), ('VRK', '2', 'Productkennis voor verkopers', 'niveau1', 2, false),
 ('VRK', '3', 'Het bedrijf van de aannemer', 'niveau1', 3, false), ('VRK', '4', 'Bestek lezen en offerte maken', 'niveau1', 4, false),
 ('VRK', '5', 'Prijs zetten', 'niveau1', 5, false), ('VRK', '6', 'Verkoopgesprek en onderhandeling', 'niveau1', 6, false),
 ('VRK', '7', 'Van bestelling tot factuur', 'niveau1', 7, false),
 ('VRK', 'G1', 'Kostprijs per m³ en marge', 'gedeeld', 8, true), ('VRK', 'G2', 'Kwaliteit en certificatie voor managers', 'gedeeld', 9, true),
 ('VRK', 'G3', 'Mensen leiden en HR', 'gedeeld', 10, true), ('VRK', 'G4', 'Mededinging en ethiek', 'gedeeld', 11, true),
 ('VRK', 'G5', 'Innovatie en duurzaamheid', 'gedeeld', 12, true),
 ('VRK', '8', 'Markt en werkgebied', 'niveau2', 13, false), ('VRK', '9', 'Klantenbeheer en verkoopprognose', 'niveau2', 14, false),
 ('VRK', '10', 'Marketing voor een betonbedrijf', 'niveau2', 15, false), ('VRK', '11', 'Duurzaam beton verkopen', 'niveau2', 16, false),
 ('VRK', '12', 'Het verkoopteam leiden', 'niveau2', 17, false), ('VRK', '13', 'Het commerciële jaarplan', 'niveau2', 18, false),
 ('PLM', '1', 'De rol van de plant manager', 'niveau1', 1, true), ('PLM', '2', 'Veiligheid en welzijn', 'niveau1', 2, false),
 ('PLM', '3', 'Installatie, onderhoud en voorraad', 'niveau1', 3, false), ('PLM', '4', 'Milieu en vergunning', 'niveau1', 4, false),
 ('PLM', '5', 'Vloot en transport', 'niveau1', 5, false), ('PLM', '6', 'Planning en capaciteit', 'niveau1', 6, false),
 ('PLM', 'G1', 'Kostprijs per m³ en marge', 'gedeeld', 7, true), ('PLM', 'G2', 'Kwaliteit en certificatie voor managers', 'gedeeld', 8, true),
 ('PLM', 'G3', 'Mensen leiden en HR', 'gedeeld', 9, true), ('PLM', 'G4', 'Mededinging en ethiek', 'gedeeld', 10, true),
 ('PLM', 'G5', 'Innovatie en duurzaamheid', 'gedeeld', 11, true),
 ('PLM', '7', 'Financiën lezen en sturen', 'niveau2', 12, false), ('PLM', '8', 'Klantenkrediet en werkkapitaal', 'niveau2', 13, false),
 ('PLM', '9', 'Investeren', 'niveau2', 14, false), ('PLM', '10', 'Strategie en markt', 'niveau2', 15, false),
 ('PLM', '11', 'HR-beleid en organisatie', 'niveau2', 16, false), ('PLM', '12', 'Bestuur en rapportering', 'niveau2', 17, false),
 ('PLM', '13', 'Risico en crisis', 'niveau2', 18, false), ('PLM', '14', 'Innovatie leiden', 'niveau2', 19, false),
 ('CSC', '1', 'Waarom duurzaamheid telt', 'niveau1', 1, true), ('CSC', '2', 'Duurzaam werken in de centrale', 'niveau1', 2, true),
 ('CSC', '3', 'CSC in de praktijk', 'niveau1', 3, true), ('CSC', '4', 'Circulair beton', 'niveau1', 4, true),
 ('CSC', '5', 'Duurzaamheid eerlijk verkopen', 'niveau1', 5, true),
 ('CSC', '6', 'Het CSC-dossier en de audit', 'niveau2', 6, false), ('CSC', '7', 'CO2-footprint en prestatieladder', 'niveau2', 7, false),
 ('CSC', '8', 'EPD en levenscyclusanalyse', 'niveau2', 8, false), ('CSC', '9', 'Recepten met minder CO2', 'niveau2', 9, false),
 ('CSC', '10', 'CSRD en vragen uit de keten', 'niveau2', 10, false), ('CSC', '11', 'Een duurzaamheidsplan voor je centrale', 'niveau2', 11, false),
 ('BT1', '01', 'Wat is beton?', 'niveau1', 1, true), ('BT1', '02', 'Grondstoffen in de praktijk', 'niveau1', 2, true),
 ('BT1', '03', 'De betoncentrale van binnen', 'niveau1', 3, true), ('BT1', '04', 'Van bestelling tot levering', 'niveau1', 4, true),
 ('BT1', '05', 'Vers beton', 'niveau1', 5, true), ('BT1', '06', 'Verwerking op de werf', 'niveau1', 6, true),
 ('BT1', '07', 'Verhard beton', 'niveau1', 7, true), ('BT1', '08', 'Speciale betonsoorten', 'niveau1', 8, true),
 ('BT1', '09', 'Rekenen in de praktijk', 'niveau1', 9, true), ('BT1', '10', 'Duurzaamheid en milieu', 'niveau1', 10, true),
 ('BT1', '11', 'Kwaliteit en BENOR', 'niveau1', 11, true),
 ('BT2', '01', 'Normatief kader en beton als bouwmateriaal', 'niveau2', 1, true), ('BT2', '02', 'Cement', 'niveau2', 2, true),
 ('BT2', '03', 'Granulaten', 'niveau2', 3, true), ('BT2', '04', 'Water', 'niveau2', 4, true),
 ('BT2', '05', 'Hulpstoffen', 'niveau2', 5, true), ('BT2', '06', 'Toevoegsels, pigmenten en vezels', 'niveau2', 6, true),
 ('BT2', '07', 'Betonspecie en verhardend beton', 'niveau2', 7, true), ('BT2', '08', 'Verhard beton', 'niveau2', 8, true),
 ('BT2', '09', 'Duurzaamheid', 'niveau2', 9, true), ('BT2', '10', 'Specificatie', 'niveau2', 10, true),
 ('BT2', '11', 'Mengselontwerp', 'niveau2', 11, true), ('BT2', '12', 'Vers beton beproeven', 'niveau2', 12, true),
 ('BT2', '13', 'Productie, transport, verwerking en nabehandeling', 'niveau2', 13, true),
 ('BT2', '14', 'Speciale betonsoorten en wegenbeton', 'niveau2', 14, true),
 ('BT2', '15', 'Verhard beton beproeven en conformiteit', 'niveau2', 15, true),
 ('BT2', '16', 'Controle, certificatie en productiecontrole', 'niveau2', 16, true)
) AS m(cursus, code, titel, traject, volgorde, klaar)
JOIN cursussen c ON c.code = m.cursus
ON CONFLICT (cursus_id, code) DO NOTHING;

INSERT INTO module_versies (module_id, label, status)
SELECT m.id, '2026.1', 'concept' FROM modules m JOIN cursussen c ON c.id = m.cursus_id
WHERE c.code IN ('VRK', 'PLM', 'CSC', 'BT1', 'BT2') AND NOT EXISTS (SELECT 1 FROM module_versies v WHERE v.module_id = m.id);

-- Producten zonder prijs: de prijs stel je in via Beheer > Instellingen (3 maanden toegang zoals de andere cursussen)
INSERT INTO producten (code, naam, type, periode, geldigheid_maanden, beschrijving) VALUES
 ('CRS-VRK', 'Cursus verkoop stortklaar beton', 'traject', 'eenmalig', 3, 'Alle modules die online staan, plus de modules die tijdens je toegang verschijnen'),
 ('CRS-PLM', 'Cursus plant manager stortklaar beton', 'traject', 'eenmalig', 3, 'Alle modules die online staan, plus de modules die tijdens je toegang verschijnen'),
 ('CRS-CSC', 'Cursus CSC en duurzaamheid', 'traject', 'eenmalig', 3, 'Niveau 1 (modules 1–5); niveau 2 volgt'),
 ('CRS-BT1', 'Basis 1.0 · Beton begrijpen', 'traject', 'eenmalig', 3, 'Elf modules met eindtoets'),
 ('CRS-BT2', 'Betontechnologie 2.0', 'traject', 'eenmalig', 3, 'Zestien modules met eindtoets')
ON CONFLICT (code) DO NOTHING;

INSERT INTO product_modules (product_id, module_id)
SELECT p.id, m.id FROM producten p
JOIN cursussen c ON c.code = substr(p.code, 5)
JOIN modules m ON m.cursus_id = c.id
WHERE p.code IN ('CRS-VRK', 'CRS-PLM', 'CRS-CSC', 'CRS-BT1', 'CRS-BT2')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Online: elke cursus gepubliceerd. Een cursus die niet gepubliceerd is, kan een cursist niet openen
--    (beheerders wel, als tester). Aan- en uitzetten in Beheer > Cursussen.
-- ---------------------------------------------------------------------
UPDATE cursussen SET gepubliceerd = true;
UPDATE modules SET gepubliceerd = true
WHERE cursus_id IN (SELECT id FROM cursussen WHERE code IN ('BMC-BPB', 'LAB', 'DSP', 'MENG', 'AI'));

-- ---------------------------------------------------------------------
-- 3. Cursusstructuur: modules en lessen zoals de cursusapp ze toont.
--    De brug (cursus-academie.js) leest ze uit de app en stuurt ze door. Een beheerder bevestigt ze door de cursus te openen;
--    een cursist kan een eerste, voorlopige versie aanleveren. Attesten enkel met een bevestigde structuur.
-- ---------------------------------------------------------------------
CREATE TABLE cursus_structuur (
  cursus text PRIMARY KEY,
  structuur jsonb NOT NULL,
  lessen int NOT NULL,
  toetsen int NOT NULL,
  bevestigd boolean NOT NULL DEFAULT false,
  door uuid REFERENCES gebruikers(id) ON DELETE SET NULL,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. Attesten per cursus: momentopname van naam, cursus en resultaat; mailen wordt bijgehouden.
--    Eén geldig cursusattest per persoon en cursus.
-- ---------------------------------------------------------------------
ALTER TABLE attesten
  ADD COLUMN naam text,
  ADD COLUMN cursus_titel text,
  ADD COLUMN modules jsonb,
  ADD COLUMN lessen int,
  ADD COLUMN toetsen int,
  ADD COLUMN gestart_op timestamptz,
  ADD COLUMN afgerond_op timestamptz,
  ADD COLUMN gemaild_op timestamptz,
  ADD COLUMN gemaild_aantal int NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX een_cursusattest ON attesten (gebruiker_id, cursus_id) WHERE ingetrokken_op IS NULL AND module_id IS NULL;
CREATE INDEX attesten_gebruiker_idx ON attesten (gebruiker_id);

-- Voortgangsdocumenten van de cursusapps snel per cursus terugvinden (leerlijn en scores)
CREATE INDEX cursus_gegevens_cursus_idx ON cursus_gegevens (cursus) WHERE pad LIKE 'data/users/%/progress';

-- ---------------------------------------------------------------------
-- 5. Haak in de opgeslagen cursusapps: de app geeft haar lessenlijst (COURSE) door aan de brug.
--    Ingevoegd na "use strict"; van de functie die COURSE bevat. Nieuwe bouwsels krijgen de haak via bouw.mjs.
--    BT1 en BT2 hebben geen COURSE; de brug leest daar de modules uit de pagina.
-- ---------------------------------------------------------------------
WITH x AS (
  SELECT cursus, pad, inhoud, strpos(inhoud, 'const COURSE') AS pc
  FROM cursus_bestanden
  WHERE pad IN ('index.html', 'beheer.html', 'demo.html') AND strpos(inhoud, 'const COURSE') > 0 AND strpos(inhoud, 'ACADEMIE_COURSE') = 0
), y AS (
  SELECT cursus, pad, inhoud, pc - strpos(reverse(substr(inhoud, 1, pc)), reverse('(function () {')) - length('(function () {') + 2 AS pi FROM x
)
UPDATE cursus_bestanden b
SET inhoud = overlay(b.inhoud PLACING E'\nwindow.ACADEMIE_COURSE = function () { try { return COURSE; } catch (e) { return null; } };' FROM y.pi + 28 FOR 0),
    bijgewerkt_op = now()
FROM y
WHERE b.cursus = y.cursus AND b.pad = y.pad AND substr(y.inhoud, y.pi, 28) = E'(function () {\n"use strict";';
