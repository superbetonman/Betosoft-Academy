-- =====================================================================
-- 011 · Een cursus blijft open zolang de toegang tot het platform loopt
-- =====================================================================
-- Beslist 23 november 2026: een gekochte cursus (of module, traject, pakket) heeft geen eigen einddatum meer.
-- Ze is open zolang de gebruiker een geldige toegang tot het platform heeft (product ABO-PLATFORM, persoonlijk of via
-- een plaats van zijn onderneming). Zonder platformtoegang is de cursus dicht; voortgang en resultaten blijven bewaard.
-- Bestaande rechten van vóór deze migratie houden de oude regel (eigen periode, geen platform nodig): platform_vereist = false.
-- Uitgevoerd op 23 november 2026, na migratie 010.

ALTER TABLE toegangsrechten ADD COLUMN IF NOT EXISTS platform_vereist boolean NOT NULL DEFAULT true;
UPDATE toegangsrechten SET platform_vereist = false WHERE aangemaakt_op < '2026-11-23 15:00+01';

-- Nieuwe rechten op een cursus krijgen geen einddatum meer (activeer_aanvraag: eind_voor(start, NULL) = NULL).
UPDATE producten SET geldigheid_maanden = NULL WHERE type <> 'abonnement';

-- Geldige platformtoegang per gebruiker, met de laatste einddatum (NULL = zonder einde)
CREATE OR REPLACE VIEW v_platform_toegang AS
SELECT x.gebruiker_id, NULLIF(max(COALESCE(x.eind_datum, 'infinity'::date)), 'infinity'::date) AS eind_datum
FROM (
  SELECT tr.gebruiker_id, tr.eind_datum
  FROM v_geldige_rechten tr JOIN producten p ON p.id = tr.product_id
  WHERE p.code = 'ABO-PLATFORM' AND tr.geldig AND tr.gebruiker_id IS NOT NULL
  UNION ALL
  SELECT pt.gebruiker_id, tr.eind_datum
  FROM plaats_toewijzingen pt JOIN v_geldige_rechten tr ON tr.id = pt.toegangsrecht_id JOIN producten p ON p.id = tr.product_id
  WHERE p.code = 'ABO-PLATFORM' AND tr.geldig AND pt.ingetrokken_op IS NULL
) x
GROUP BY x.gebruiker_id;

-- Toegang per module. Een recht "via platform" (platform_vereist, geen abonnement) telt zolang het actief en gestart is
-- en de gebruiker platformtoegang heeft; de einddatum is dan die van het platform. Andere rechten: hun eigen periode.
CREATE OR REPLACE VIEW v_module_toegang AS
WITH rechten AS (
  SELECT tr.*, (t.platform_vereist AND p.type <> 'abonnement') AS via_platform
  FROM v_geldige_rechten tr JOIN toegangsrechten t ON t.id = tr.id JOIN producten p ON p.id = tr.product_id
), alle AS (
  SELECT r.gebruiker_id, r.product_id, r.id AS recht_id, CASE WHEN r.via_platform THEN pf.eind_datum ELSE r.eind_datum END AS eind_datum
  FROM rechten r LEFT JOIN v_platform_toegang pf ON pf.gebruiker_id = r.gebruiker_id
  WHERE r.gebruiker_id IS NOT NULL
    AND CASE WHEN r.via_platform THEN r.status = 'actief' AND r.start_datum <= CURRENT_DATE AND pf.gebruiker_id IS NOT NULL ELSE r.geldig END
  UNION ALL
  SELECT pt.gebruiker_id, r.product_id, r.id, CASE WHEN r.via_platform THEN pf.eind_datum ELSE r.eind_datum END
  FROM plaats_toewijzingen pt JOIN rechten r ON r.id = pt.toegangsrecht_id
  LEFT JOIN v_platform_toegang pf ON pf.gebruiker_id = pt.gebruiker_id
  WHERE pt.ingetrokken_op IS NULL
    AND CASE WHEN r.via_platform THEN r.status = 'actief' AND r.start_datum <= CURRENT_DATE AND pf.gebruiker_id IS NOT NULL ELSE r.geldig END
)
SELECT DISTINCT a.gebruiker_id, m.id AS module_id, a.recht_id, a.eind_datum
FROM alle a
JOIN producten p ON p.id = a.product_id
JOIN modules m ON p.alle_modules OR m.id IN (SELECT pm.module_id FROM product_modules pm WHERE pm.product_id = p.id);

-- Verlengen: een cursus via het platform en de platformtoegang zelf verleng je niet met een aanvraag per maand
-- (de cursus loopt mee met het platform; het platform verlengt per jaar via Beheer).
CREATE OR REPLACE VIEW v_verlenging_stand AS
SELECT tr.id AS toegangsrecht_id,
  (SELECT count(*)::int FROM aanvragen a WHERE a.toegangsrecht_id = tr.id AND a.type::text = 'verlenging'
     AND a.status IN ('nieuw','gefactureerd','geactiveerd')) AS gebruikt,
  CASE WHEN (tr.platform_vereist AND p.type <> 'abonnement') OR p.code = 'ABO-PLATFORM' THEN 0
       ELSE instelling_getal('verlenging_max')::int END AS maximum,
  (tr.start_datum + make_interval(months => instelling_getal('verlenging_venster_maanden')::int) - interval '1 day')::date AS aanvragen_tot,
  round(COALESCE((SELECT a.bedrag_excl_btw FROM aanvragen a WHERE a.id = tr.aanvraag_id), p.prijs_excl_btw * tr.aantal_plaatsen)
        * instelling_getal('verlenging_prijs_pct') / 100, 2) AS prijs_excl_btw
FROM toegangsrechten tr JOIN producten p ON p.id = tr.product_id;
