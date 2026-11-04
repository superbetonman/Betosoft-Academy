-- =====================================================================
-- 006 · Cursussen op de startpagina: niet tonen, in voorbereiding, inschrijven mogelijk
-- =====================================================================
-- Per cursus kies je in Beheer → Cursussen hoe ze publiek verschijnt (kolom cursussen.startpagina):
--   niet_tonen     niet op de startpagina en de prijzenpagina, geen publieke demo, niet te koop
--   voorbereiding  op de startpagina als "in voorbereiding", met de demo, zonder prijs en zonder inschrijven
--   inschrijven    op de startpagina met prijs en inschrijfknop
-- Alleen "inschrijven" staat online (cursussen.gepubliceerd): cursisten met toegang kunnen de cursus openen.
-- In de twee andere standen is de cursus offline (enkel beheerders, als tester). De twee kolommen blijven
-- samen kloppen door een controle; zet ze dus altijd samen.
-- Overgang: een cursus die online stond, wordt "inschrijven"; een cursus die offline stond, "niet_tonen".

-- Enkel de eerste keer: opnieuw uitvoeren zet de gekozen standen niet terug.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cursussen' AND column_name = 'startpagina') THEN
    ALTER TABLE cursussen ADD COLUMN startpagina text NOT NULL DEFAULT 'niet_tonen';
    UPDATE cursussen SET startpagina = CASE WHEN gepubliceerd THEN 'inschrijven' ELSE 'niet_tonen' END;
  END IF;
END $$;
ALTER TABLE cursussen DROP CONSTRAINT IF EXISTS cursussen_startpagina_check;
ALTER TABLE cursussen ADD CONSTRAINT cursussen_startpagina_check
  CHECK (startpagina IN ('niet_tonen', 'voorbereiding', 'inschrijven'));
ALTER TABLE cursussen DROP CONSTRAINT IF EXISTS cursussen_online_is_inschrijven;
ALTER TABLE cursussen ADD CONSTRAINT cursussen_online_is_inschrijven
  CHECK (gepubliceerd = (startpagina = 'inschrijven'));

-- Te koop: een actief product waarvan elke cursus op "inschrijven" staat. Een abonnement (alle modules) blijft te koop.
-- Gebruikt door de startpagina, de prijzenpagina, het inschrijfformulier en de bestelling van een onderneming.
CREATE OR REPLACE FUNCTION product_te_koop(p_product uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM producten p
    WHERE p.id = p_product AND p.actief
      AND (p.alle_modules OR NOT EXISTS (
        SELECT 1 FROM product_modules pm
        JOIN modules m ON m.id = pm.module_id
        JOIN cursussen c ON c.id = m.cursus_id
        WHERE pm.product_id = p.id AND c.startpagina <> 'inschrijven')))
$$;
