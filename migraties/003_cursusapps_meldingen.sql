-- =====================================================================
-- 003 · Cursusapps, voortgang in de academie, meldingen, extra opleidingen
-- =====================================================================

-- Cursusapps (HTML en losse scripts) staan in de databank en niet in de publieke repo.
-- pad = 'index.html' (volledige cursus), 'demo.html' (ingekorte teaser) of een los script zoals 'm2.js'.
CREATE TABLE cursus_bestanden (
  cursus text NOT NULL,
  pad text NOT NULL,
  type text NOT NULL,
  inhoud text NOT NULL,
  bron text,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cursus, pad)
);

-- Wat een cursusapp bewaart (voortgang, eigen recepten, ...), per gebruiker en per cursus.
-- pad is het documentpad dat de app zelf gebruikt, bv. data/users/<id>/progress.
CREATE TABLE cursus_gegevens (
  gebruiker_id uuid NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
  cursus text NOT NULL,
  pad text NOT NULL,
  data jsonb NOT NULL,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gebruiker_id, cursus, pad)
);

-- Meldingen van gebruikers (fouten, inhoudelijke opmerkingen, wensen), zoals de bevindingen in Betosoft.
CREATE TABLE meldingen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titel text NOT NULL CHECK (length(titel) BETWEEN 1 AND 200),
  omschrijving text,
  verwacht text,
  ernst text NOT NULL CHECK (ernst IN ('Blokkerend', 'Inhoudelijke fout', 'Functioneel', 'Tekst en vorm', 'Wens')),
  status text NOT NULL DEFAULT 'Nieuw' CHECK (status IN ('Nieuw', 'In behandeling', 'Opgelost', 'Later', 'Niet weerhouden')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  afbeelding text,
  gebruiker_id uuid REFERENCES gebruikers(id) ON DELETE SET NULL,
  email citext,
  naam text,
  antwoord text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meldingen_status_idx ON meldingen (status, aangemaakt_op DESC);
CREATE INDEX meldingen_gebruiker_idx ON meldingen (gebruiker_id);

-- ---------------------------------------------------------------------
-- Cursussen uit het cursusproject (code = code op de startpagina en in cursus_bestanden)
-- ---------------------------------------------------------------------
INSERT INTO cursussen (code, titel, beschrijving, volgorde) VALUES
 ('LAB', 'Laborant stortklaar beton', 'Niveau 1 laborant, niveau 2 labo- of kwaliteitsverantwoordelijke.', 2),
 ('DSP', 'Betondispatcher', 'Niveau 1 basis, niveau 2 verdieping.', 3),
 ('MENG', 'Mengselontwerp van beton', 'Van grondstoffen tot vrijgegeven recept, met rekentool.', 4),
 ('AI', 'AI in de betoncentrale', 'AI veilig en nuttig gebruiken, leerpad per rol.', 5),
 ('VRK', 'Verkoop stortklaar beton', 'In opbouw.', 6),
 ('PLM', 'Plant manager stortklaar beton', 'In opbouw.', 7),
 ('CSC', 'CSC en duurzaamheid', 'In opbouw.', 8),
 ('BT1', 'Basis 1.0 · Beton begrijpen', 'Conceptversie.', 9),
 ('BT2', 'Betontechnologie 2.0', 'Conceptversie.', 10);

-- Modules van de vier opleidingen die opengaan
INSERT INTO modules (cursus_id, code, titel, traject, volgorde)
SELECT c.id, m.code, m.titel, m.traject, m.volgorde
FROM (VALUES
 ('LAB', '1', 'Het labo in de centrale', 'niveau1', 1), ('LAB', '2', 'De grondstoffen', 'niveau1', 2),
 ('LAB', '3', 'Proeven op granulaten', 'niveau1', 3), ('LAB', '4', 'Van recept tot menging', 'niveau1', 4),
 ('LAB', '5', 'Proeven op vers beton', 'niveau1', 5), ('LAB', '6', 'Proefstukken en drukproef', 'niveau1', 6),
 ('LAB', '7', 'Specificatie van beton', 'niveau2', 7), ('LAB', '8', 'Productiecontrole volgens TRA 550', 'niveau2', 8),
 ('LAB', '9', 'Conformiteit en statistiek', 'niveau2', 9), ('LAB', '10', 'Receptontwerp en initiële proeven', 'niveau2', 10),
 ('LAB', '11', 'Klachten en problemen', 'niveau2', 11),
 ('DSP', '1', 'De rol van dispatch', 'niveau1', 1), ('DSP', '2', 'De rit van een truckmixer', 'niveau1', 2),
 ('DSP', '3', 'De bestelling opnemen', 'niveau1', 3), ('DSP', '4', 'Basisplanning', 'niveau1', 4),
 ('DSP', '5', 'Uitleveren en chauffeurs', 'niveau1', 5), ('DSP', '6', 'Richtlijnen en organisatie', 'niveau2', 6),
 ('DSP', '7', 'Geavanceerde planning', 'niveau2', 7), ('DSP', '8', 'Problemen in het schema', 'niveau2', 8),
 ('DSP', '9', 'Statussen, GPS en telematica', 'niveau2', 9), ('DSP', '10', 'Prestaties meten', 'niveau2', 10),
 ('DSP', '11', 'De economie van de levering', 'niveau2', 11),
 ('MENG', '1', 'Grondstoffen', 'deelA', 1), ('MENG', '2', 'Geschiktheid en variabiliteit', 'deelA', 2),
 ('MENG', '3', 'Het granulair skelet', 'deelB', 3), ('MENG', '4', 'Rekenmodellen', 'deelB', 4),
 ('MENG', '5', 'Berekening volgens de normen', 'deelB', 5), ('MENG', '6', 'Bijzondere betons', 'deelC', 6),
 ('MENG', '7', 'Rekentool en oefeningen', 'deelC', 7),
 ('AI', '1', 'AI begrijpen', 'iedereen', 1), ('AI', '2', 'Veilig en wettelijk', 'iedereen', 2),
 ('AI', '3', 'Goed vragen stellen', 'iedereen', 3), ('AI', '4', 'AI in kwaliteit en certificatie', 'rol', 4),
 ('AI', '5', 'AI in planning en verkoop', 'rol', 5), ('AI', '6', 'AI in het management', 'rol', 6)
) AS m(cursus, code, titel, traject, volgorde)
JOIN cursussen c ON c.code = m.cursus;

-- Elke nieuwe module krijgt een eerste versie, zoals de modules van BMC-BPB
INSERT INTO module_versies (module_id, label, status)
SELECT m.id, '2026.1', 'concept' FROM modules m JOIN cursussen c ON c.id = m.cursus_id
WHERE c.code IN ('LAB', 'DSP', 'MENG', 'AI') AND NOT EXISTS (SELECT 1 FROM module_versies v WHERE v.module_id = m.id);

-- Producten (prijs wordt ingesteld in Beheer > Instellingen; 3 maanden toegang)
INSERT INTO producten (code, naam, type, periode, geldigheid_maanden, beschrijving) VALUES
 ('CRS-LAB', 'Volledige cursus laborant en kwaliteitsverantwoordelijke', 'traject', 'eenmalig', 3, 'Niveau 1 en 2, modules 1–11'),
 ('TRJ-LAB-1', 'Laborant · niveau 1', 'traject', 'eenmalig', 3, 'Modules 1–6: labo, grondstoffen, proeven en proefstukken'),
 ('TRJ-LAB-2', 'Kwaliteitsverantwoordelijke · niveau 2', 'traject', 'eenmalig', 3, 'Modules 7–11: specificatie, productiecontrole, conformiteit, recepten en klachten'),
 ('CRS-DSP', 'Volledige cursus betondispatcher', 'traject', 'eenmalig', 3, 'Niveau 1 en 2, modules 1–11'),
 ('TRJ-DSP-1', 'Dispatcher · niveau 1 basis', 'traject', 'eenmalig', 3, 'Modules 1–5'),
 ('TRJ-DSP-2', 'Dispatcher · niveau 2 verdieping', 'traject', 'eenmalig', 3, 'Modules 6–11'),
 ('CRS-MENG', 'Cursus mengselontwerp van beton', 'traject', 'eenmalig', 3, 'Modules 1–7, met rekentool'),
 ('CRS-AI', 'AI in de betoncentrale', 'traject', 'eenmalig', 3, 'Modules 1–6, leerpad per rol');

INSERT INTO product_modules (product_id, module_id)
SELECT p.id, m.id
FROM producten p
JOIN cursussen c ON c.code = CASE WHEN p.code LIKE '%-LAB%' THEN 'LAB' WHEN p.code LIKE '%-DSP%' THEN 'DSP' WHEN p.code = 'CRS-MENG' THEN 'MENG' WHEN p.code = 'CRS-AI' THEN 'AI' END
JOIN modules m ON m.cursus_id = c.id
WHERE p.code IN ('CRS-LAB', 'TRJ-LAB-1', 'TRJ-LAB-2', 'CRS-DSP', 'TRJ-DSP-1', 'TRJ-DSP-2', 'CRS-MENG', 'CRS-AI')
  AND (p.code NOT LIKE 'TRJ-%-1' OR m.traject = 'niveau1')
  AND (p.code NOT LIKE 'TRJ-%-2' OR m.traject = 'niveau2');
