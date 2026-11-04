-- =====================================================================
-- 008 · CSC wordt "Milieu, CSC en maatschappelijk verantwoord ondernemen"
-- =====================================================================
-- Nieuwe insteek: voor betoncentrales en prefabfabrieken, gericht op wie mee beslist (niveau 1) en de coördinator
-- (niveau 2). Geen betontechnologie of chauffeursinhoud meer: die zit in MENG, LAB, BT1, BT2, BMC en BPB.
-- Niveau 1 (modules 1–5) is herbouwd in de cursusapp. Niveau 2 (6–12) volgt; het oude niveau 2 (6–11) staat
-- verborgen in de app, om om te zetten. Module 12 is nieuw. De code CSC en de bestaande versies blijven.

UPDATE cursussen
SET titel = 'Milieu, CSC en maatschappelijk verantwoord ondernemen',
    beschrijving = 'Voor betoncentrales en prefabfabrieken: wat klanten, overheid en bank vragen over milieu, CSC en MVO, en hoe je het aantoont. Niveau 1 online, niveau 2 volgt.'
WHERE code = 'CSC';

UPDATE modules m SET titel = v.titel
FROM (VALUES
 ('1', 'Wie vraagt wat'),
 ('2', 'Milieu in de centrale en de fabriek'),
 ('3', 'CO2 tellen'),
 ('4', 'CSC begrijpen'),
 ('5', 'Maatschappelijk verantwoord ondernemen'),
 ('6', 'Eén dataset voor alles'),
 ('7', 'Het CSC-dossier'),
 ('8', 'De CSC-audit en een hoger niveau'),
 ('9', 'ISO 14001 en milieuwetgeving'),
 ('10', 'CO2-footprint en prestatieladder'),
 ('11', 'VSME, EPD en vragen uit de keten')
) AS v(code, titel), cursussen c
WHERE c.id = m.cursus_id AND c.code = 'CSC' AND m.code = v.code;

INSERT INTO modules (cursus_id, code, titel, traject, volgorde, gepubliceerd)
SELECT c.id, '12', 'Het jaarplan milieu en MVO', 'niveau2', 12, false FROM cursussen c WHERE c.code = 'CSC'
ON CONFLICT (cursus_id, code) DO NOTHING;

INSERT INTO module_versies (module_id, label, status)
SELECT m.id, '2026.1', 'concept' FROM modules m JOIN cursussen c ON c.id = m.cursus_id
WHERE c.code = 'CSC' AND NOT EXISTS (SELECT 1 FROM module_versies v WHERE v.module_id = m.id);

INSERT INTO product_modules (product_id, module_id)
SELECT p.id, m.id FROM producten p
JOIN cursussen c ON c.code = 'CSC'
JOIN modules m ON m.cursus_id = c.id
WHERE p.code = 'CRS-CSC'
ON CONFLICT DO NOTHING;

UPDATE producten SET naam = 'Cursus milieu, CSC en MVO', beschrijving = 'Niveau 1 (modules 1–5); niveau 2 volgt'
WHERE code = 'CRS-CSC';
