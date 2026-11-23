-- =====================================================================
-- 012 · Voortgang van een cursus resetten voor een medewerker
-- =====================================================================
-- Beslist 23 november 2026: de superadmin, een beheerder en de beheerder van een onderneming (voor de eigen medewerkers)
-- kunnen de voortgang van één cursus voor één persoon wissen. Uitgereikte attesten en behaalde badges blijven.
-- BMC en BPB bewaren hun voortgang samen bij de bron BMC-BPB (gedeelde basis): de reset geldt dan voor beide.
-- Uitgevoerd op 23 november 2026, na migratie 011.

CREATE OR REPLACE FUNCTION reset_voortgang(p_gebruiker uuid, p_cursus text, p_door uuid) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE v_c cursussen%ROWTYPE; v_sleutel text; n int; v_codes text[];
BEGIN
  SELECT * INTO v_c FROM cursussen WHERE code = p_cursus;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cursus niet gevonden'; END IF;
  v_sleutel := COALESCE(v_c.bron, v_c.code);
  -- voortgangsdocumenten van de cursusapp (bij de bron als de cursus afgeleid is)
  DELETE FROM cursus_gegevens WHERE gebruiker_id = p_gebruiker AND cursus = v_sleutel;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- lessen en toetspogingen in het platform zelf, voor de modules van deze cursus
  DELETE FROM voortgang WHERE gebruiker_id = p_gebruiker AND les_id IN (
    SELECT l.id FROM lessen l JOIN module_versies mv ON mv.id = l.module_versie_id
    JOIN v_cursus_modules cm ON cm.module_id = mv.module_id WHERE cm.cursus_id = v_c.id);
  DELETE FROM toetspogingen WHERE gebruiker_id = p_gebruiker AND toets_id IN (
    SELECT t.id FROM toetsen t JOIN module_versies mv ON mv.id = t.module_versie_id
    JOIN v_cursus_modules cm ON cm.module_id = mv.module_id WHERE cm.cursus_id = v_c.id);
  -- de cursussen die deze voortgang delen (zichtbare cursussen, niet de bron zelf als die andere cursussen voedt)
  SELECT array_agg(code ORDER BY code) INTO v_codes FROM cursussen
  WHERE COALESCE(bron, code) = v_sleutel AND NOT (code = v_sleutel AND is_bron(code));
  PERFORM log_actie('voortgang_gereset', 'gebruiker', p_gebruiker,
    jsonb_build_object('cursus', p_cursus, 'gegevens', v_sleutel, 'documenten', n, 'door', p_door));
  RETURN COALESCE(v_codes, ARRAY[p_cursus]);
END $$;
