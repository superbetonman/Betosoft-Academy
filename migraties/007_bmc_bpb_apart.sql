-- =====================================================================
-- 007 · BMC en BPB als aparte cursussen, met één gemeenschappelijke bron
-- =====================================================================
-- Betonmixerchauffeur (BMC) en betonpompbediende (BPB) worden twee cursussen, elk met een eigen kaart op de
-- startpagina, eigen product, leerlijn en attest. De inhoud blijft één geheel in de bron BMC-BPB:
--   - één cursusapp (cursus_bestanden 'BMC-BPB') met de start, de basis (1–4) en de trajecten M1–M4 en P1–P4;
--   - de modules en hun versies hangen aan BMC-BPB (Beheer → Versies): de basis onderhoud je dus één keer;
--   - de voortgang staat bij de bron: wie BMC en BPB volgt, doet de basis één keer (punten tellen ook één keer).
-- Een afgeleide cursus (kolom bron ingevuld) neemt de modules van de bron waarvan modules.app_id in app_modules staat.
-- De app toont enkel die modules (app_modules bevat ook de startmodule m0); app_meta past titel en inleiding aan.
-- Een bron verschijnt zelf niet: niet op de startpagina, niet in de leerlijn, geen attest. Beheerders kunnen ze openen.

-- 1. Kolommen
ALTER TABLE cursussen ADD COLUMN IF NOT EXISTS bron text REFERENCES cursussen(code) ON UPDATE CASCADE;
ALTER TABLE cursussen ADD COLUMN IF NOT EXISTS app_modules text[];
ALTER TABLE cursussen ADD COLUMN IF NOT EXISTS app_meta jsonb;
ALTER TABLE cursussen DROP CONSTRAINT IF EXISTS cursussen_bron_check;
ALTER TABLE cursussen ADD CONSTRAINT cursussen_bron_check
  CHECK (bron IS DISTINCT FROM code AND (bron IS NULL) = (app_modules IS NULL));
-- id van de module in de cursusapp (COURSE[].id), om modules van de databank en de app te koppelen
ALTER TABLE modules ADD COLUMN IF NOT EXISTS app_id text;

-- 2. Welke modules horen bij welke cursus: eigen modules, of voor een afgeleide cursus de gekozen modules van de bron.
--    Een module van de basis hoort zo bij BMC-BPB, BMC en BPB.
CREATE OR REPLACE VIEW v_cursus_modules AS
SELECT c.id AS cursus_id, m.id AS module_id
FROM cursussen c
JOIN cursussen b ON b.code = coalesce(c.bron, c.code)
JOIN modules m ON m.cursus_id = b.id
WHERE c.bron IS NULL OR m.app_id = ANY (c.app_modules);

CREATE OR REPLACE FUNCTION is_bron(p_code text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM cursussen WHERE bron = p_code)
$$;

-- 3. Cursussen van een product (zonder bron): het product is een deel van de cursus (volledige cursus, traject, module)
--    of omvat ze helemaal (een pakket van meerdere cursussen). Een abonnement (alle modules) hoort bij geen enkele cursus.
CREATE OR REPLACE FUNCTION product_cursussen(p_product uuid) RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(c.code ORDER BY c.volgorde, c.code), '{}')
  FROM cursussen c
  WHERE NOT is_bron(c.code)
    AND EXISTS (SELECT 1 FROM v_cursus_modules cm JOIN product_modules pm ON pm.module_id = cm.module_id
                WHERE cm.cursus_id = c.id AND pm.product_id = p_product)
    AND (NOT EXISTS (SELECT 1 FROM product_modules pm WHERE pm.product_id = p_product
                       AND pm.module_id NOT IN (SELECT module_id FROM v_cursus_modules WHERE cursus_id = c.id))
      OR NOT EXISTS (SELECT 1 FROM v_cursus_modules cm WHERE cm.cursus_id = c.id
                       AND cm.module_id NOT IN (SELECT module_id FROM product_modules WHERE product_id = p_product)))
$$;

-- 4. Te koop (vervangt 006): een actief product waarvan elke module in een cursus zit die op "inschrijven" staat.
--    Een abonnement blijft te koop. Een basismodule is dus te koop zodra BMC of BPB open staat.
CREATE OR REPLACE FUNCTION product_te_koop(p_product uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM producten p
    WHERE p.id = p_product AND p.actief
      AND (p.alle_modules OR NOT EXISTS (
        SELECT 1 FROM product_modules pm
        WHERE pm.product_id = p.id AND NOT EXISTS (
          SELECT 1 FROM v_cursus_modules cm JOIN cursussen c ON c.id = cm.cursus_id
          WHERE cm.module_id = pm.module_id AND c.startpagina = 'inschrijven' AND NOT is_bron(c.code)))))
$$;

-- 5. Koppeling met de app: B1 → m1, M1 → mM1, P1 → mP1
UPDATE modules m SET app_id = CASE WHEN m.traject = 'basis' THEN 'm' || substr(m.code, 2) ELSE 'm' || m.code END
FROM cursussen c WHERE c.id = m.cursus_id AND c.code = 'BMC-BPB' AND m.app_id IS NULL;

-- 6. De twee cursussen. Ze nemen de stand op de startpagina over van BMC-BPB; de bron zelf blijft "niet tonen".
INSERT INTO cursussen (code, titel, beschrijving, gepubliceerd, startpagina, volgorde, bron, app_modules, app_meta)
SELECT v.code, v.titel, v.beschrijving, b.gepubliceerd, b.startpagina, 1, 'BMC-BPB', v.modules, v.meta
FROM cursussen b, (VALUES
  ('BMC', 'Betonmixerchauffeur',
   'Lever beton veilig, op tijd en in de juiste kwaliteit met de truckmixer: eerst de gemeenschappelijke basis, daarna het traject betonmixerchauffeur.',
   ARRAY['m0','m1','m2','m3','m4','mM1','mM2','mM3','mM4'],
   '{"title": "Cursus betonmixerchauffeur",
     "eyebrow": ["Online cursus", "Voor betonmixerchauffeurs"],
     "lead": "Lever beton veilig, op tijd en in de juiste kwaliteit. Eerst de gemeenschappelijke basis: veiligheid, betonkennis, de klant en het milieu. Daarna het traject betonmixerchauffeur: de truckmixer, rijden, laden en lossen, reinigen en onderhoud. Rijd je met een mixerpomp, volg dan ook de cursus betonpompbediende: de basis doe je maar één keer. Alle voorbeelden spelen bij één verzonnen centrale, Beter BetonCentrale.",
     "printSub": "Gemeenschappelijke basis en traject betonmixerchauffeur"}'::jsonb),
  ('BPB', 'Betonpompbediende',
   'Pomp beton veilig, op tijd en in de juiste kwaliteit: eerst de gemeenschappelijke basis, daarna het traject betonpompbediende.',
   ARRAY['m0','m1','m2','m3','m4','mP1','mP2','mP3','mP4'],
   '{"title": "Cursus betonpompbediende",
     "eyebrow": ["Online cursus", "Voor betonpompbedienden"],
     "lead": "Pomp beton veilig, op tijd en in de juiste kwaliteit. Eerst de gemeenschappelijke basis: veiligheid, betonkennis, de klant en het milieu. Daarna het traject betonpompbediende: de betonpomp, opstellen en stabiliseren, pompen, en reinigen, keuring en onderhoud. Rijd je met een mixerpomp, volg dan ook de cursus betonmixerchauffeur: de basis doe je maar één keer. Alle voorbeelden spelen bij één verzonnen centrale, Beter BetonCentrale.",
     "printSub": "Gemeenschappelijke basis en traject betonpompbediende"}'::jsonb)
) AS v(code, titel, beschrijving, modules, meta)
WHERE b.code = 'BMC-BPB'
ON CONFLICT (code) DO NOTHING;
UPDATE cursussen SET volgorde = 0, startpagina = 'niet_tonen', gepubliceerd = false WHERE code = 'BMC-BPB';

-- 7. Producten: de trajecten worden de volledige cursussen, de oude volledige cursus een pakket van beide.
--    Prijzen blijven ongewijzigd; bestaande toegangsrechten en aanvragen verwijzen naar het product (id), niet naar de code.
UPDATE producten SET code = 'CRS-BMC', naam = 'Volledige cursus betonmixerchauffeur', beschrijving = 'Basis 1–4 en traject M1–M4'
WHERE code = 'TRJ-BMC';
UPDATE producten SET code = 'CRS-BPB', naam = 'Volledige cursus betonpompbediende', beschrijving = 'Basis 1–4 en traject P1–P4'
WHERE code = 'TRJ-BPB';
UPDATE producten SET code = 'PAK-BMC-BPB', naam = 'Pakket betonmixerchauffeur en betonpompbediende',
  beschrijving = 'Beide cursussen: de basis één keer, plus M1–M4 en P1–P4 (bv. voor een mixerpomp)'
WHERE code = 'CRS-BMC-BPB';

-- 8. Lessenlijst van BMC en BPB: de bevestigde lessenlijst van de bron, beperkt tot hun modules.
--    Een beheerder die de cursus opent, meldt dezelfde lijst (de app toont enkel die modules).
INSERT INTO cursus_structuur (cursus, structuur, lessen, toetsen, bevestigd, door, bijgewerkt_op)
SELECT c.code,
       jsonb_set(s.structuur, '{modules}',
         (SELECT jsonb_agg(m ORDER BY o) FROM jsonb_array_elements(s.structuur -> 'modules') WITH ORDINALITY x(m, o)
          WHERE m ->> 'id' = ANY (c.app_modules))),
       0, 0, s.bevestigd, s.door, now()
FROM cursussen c JOIN cursus_structuur s ON s.cursus = c.bron
WHERE c.bron IS NOT NULL
ON CONFLICT (cursus) DO NOTHING;
UPDATE cursus_structuur cs SET
  lessen = (SELECT count(*) FROM jsonb_array_elements(cs.structuur -> 'modules') m, jsonb_array_elements(m -> 'lessen') l
            WHERE (m ->> 'avail')::boolean),
  toetsen = (SELECT count(*) FROM jsonb_array_elements(cs.structuur -> 'modules') m, jsonb_array_elements(m -> 'lessen') l
             WHERE (m ->> 'avail')::boolean AND l ->> 'soort' = 'toets')
WHERE cs.cursus IN (SELECT code FROM cursussen WHERE bron IS NOT NULL);

-- 9. De cursusapp van de bron krijgt een tweede haak: direct na `const COURSE = [...]` mag de academie modules
--    weglaten (window.ACADEMIE_FILTER, uit cursus-academie.js). Dat gebeurt met scripts/cursusapps/haak-filter.mjs
--    (de app is te groot en te gevoelig voor een regexp hier); bouw.mjs zet de haak voortaan zelf.
