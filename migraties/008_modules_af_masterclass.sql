-- =====================================================================
-- 008 · PLM, VRK en CSC volledig; nieuwe cursus BT3 (Masterclass betontechnologie 3.0)
-- =====================================================================
-- De cursusapps van PLM (19 modules), VRK (18) en CSC (11) bevatten nu alle modules; BT3 is een nieuwe cursusapp.
-- Voer deze migratie uit nadat de nieuwe bestanden met scripts/cursusapps/opladen.mjs in cursus_bestanden staan.
-- Een beheerder opent daarna elke cursus één keer om de nieuwe lessenlijst te bevestigen (Beheer → Cursussen).

-- ---------------------------------------------------------------------
-- 1. PLM, VRK en CSC: alle modules klaar
-- ---------------------------------------------------------------------
UPDATE modules SET gepubliceerd = true
WHERE cursus_id IN (SELECT id FROM cursussen WHERE code IN ('PLM', 'VRK', 'CSC')) AND NOT gepubliceerd;

UPDATE cursussen SET beschrijving = v.beschrijving
FROM (VALUES
 ('VRK', 'Stortklaar beton verkopen, daarna verkoop en marketing leiden: achttien modules, elk met praktijkopdracht en toets.'),
 ('PLM', 'Een stortklaarbetoncentrale leiden, daarna het hele bedrijf: negentien modules, elk met praktijkopdracht en toets.'),
 ('CSC', 'Duurzaamheid in de centrale: CO₂, CSC-certificaat, prestatieladder, EPD en CSRD. Niveau 1 en niveau 2, elf modules.')
) AS v(code, beschrijving)
WHERE cursussen.code = v.code;

UPDATE producten SET beschrijving = 'Niveau 1 en niveau 2 (modules 1–11)' WHERE code = 'CRS-CSC';

-- ---------------------------------------------------------------------
-- 2. BT3 · Masterclass betontechnologie 3.0
--    Start op "niet tonen": enkel beheerders zien de cursus (als tester). Kies de stand in Beheer → Cursussen.
--    Het product heeft nog geen prijs (Beheer → Instellingen), zoals de andere cursussen bij hun start.
-- ---------------------------------------------------------------------
INSERT INTO cursussen (code, titel, beschrijving, volgorde, startpagina, gepubliceerd) VALUES
 ('BT3', 'Masterclass betontechnologie 3.0',
  'Mengsels optimaliseren en verantwoorden: acht modules met een eigen mengselontwerp als eindopdracht. Voorkennis: Betontechnologie 2.0.',
  11, 'niet_tonen', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO modules (cursus_id, code, titel, traject, volgorde, gepubliceerd)
SELECT c.id, m.code, m.titel, m.traject, m.volgorde, true
FROM (VALUES
 ('1', 'Mengsels optimaliseren', 'deel1', 1),
 ('2', 'Prestatiegerichte duurzaamheid', 'deel1', 2),
 ('3', 'Klinkerarme en circulaire mengsels', 'deel1', 3),
 ('4', 'Milieuprestatie', 'deel1', 4),
 ('5', 'Certificatie en duurzaamheidslabels', 'deel2', 5),
 ('6', 'Statistiek en procesbeheersing', 'deel2', 6),
 ('7', 'Probleemoplossing', 'deel2', 7),
 ('8', 'Eindopdracht', 'deel2', 8)
) AS m(code, titel, traject, volgorde)
JOIN cursussen c ON c.code = 'BT3'
ON CONFLICT (cursus_id, code) DO NOTHING;

INSERT INTO module_versies (module_id, label, status)
SELECT m.id, '2026.1', 'concept' FROM modules m JOIN cursussen c ON c.id = m.cursus_id
WHERE c.code = 'BT3' AND NOT EXISTS (SELECT 1 FROM module_versies v WHERE v.module_id = m.id);

INSERT INTO producten (code, naam, type, periode, geldigheid_maanden, beschrijving) VALUES
 ('CRS-BT3', 'Masterclass betontechnologie 3.0', 'traject', 'eenmalig', 3, 'Acht modules met eindopdracht en eindtoets')
ON CONFLICT (code) DO NOTHING;

INSERT INTO product_modules (product_id, module_id)
SELECT p.id, m.id FROM producten p
JOIN cursussen c ON c.code = 'BT3'
JOIN modules m ON m.cursus_id = c.id
WHERE p.code = 'CRS-BT3'
ON CONFLICT DO NOTHING;
