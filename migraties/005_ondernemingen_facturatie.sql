-- =====================================================================
-- 005 · Ondernemingen in plaats van centrales, factuur op een bedrijf voor personen
-- =====================================================================
-- Op het scherm heet een klant met meerdere medewerkers voortaan een onderneming. In de databank blijven de
-- namen ongewijzigd: aanvraagtype 'centrale', rol 'centrale_verantwoordelijke' (= beheerder van de onderneming),
-- tabel organisaties. Een persoon (aanvraagtype 'individueel') kan een bedrijf en btw-nummer opgeven voor de
-- factuur: die staan in aanvragen.organisatie_naam en aanvragen.btw_nummer. Er komt dan geen organisatie bij;
-- de persoon blijft een gewone cursist.

-- Verlenging: neem de facturatiegegevens mee in de nieuwe aanvraag.
--   onderneming: naam, btw-nummer en adres uit organisaties
--   persoon: bedrijf, btw-nummer en adres uit de oorspronkelijke aanvraag van het toegangsrecht
CREATE OR REPLACE FUNCTION vraag_verlenging(p_recht uuid, p_opmerking text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r toegangsrechten%ROWTYPE; s v_verlenging_stand%ROWTYPE; v_email citext; v_naam text; v_org text; v_btw text; v_adres text; v_id uuid;
BEGIN
  SELECT * INTO r FROM toegangsrechten WHERE id = p_recht FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Toegangsrecht niet gevonden'; END IF;
  IF r.status = 'ingetrokken' THEN RAISE EXCEPTION 'Dit toegangsrecht is ingetrokken'; END IF;
  SELECT * INTO s FROM v_verlenging_stand WHERE toegangsrecht_id = p_recht;
  IF current_date > s.aanvragen_tot THEN
    RAISE EXCEPTION 'Verlengen kon tot % (binnen % maanden na de start)', to_char(s.aanvragen_tot, 'DD.MM.YYYY'), instelling_getal('verlenging_venster_maanden')::int;
  END IF;
  IF s.gebruikt >= s.maximum THEN RAISE EXCEPTION 'Maximum aantal verlengingen bereikt (%)', s.maximum; END IF;
  IF s.prijs_excl_btw IS NULL THEN RAISE EXCEPTION 'Stel eerst een prijs in voor dit product'; END IF;
  -- nullif: concat_ws geeft '' (geen NULL) als er geen persoon is; dan de contactpersoon van de onderneming
  SELECT coalesce(g.email, o.contact_email), coalesce(nullif(concat_ws(' ', g.voornaam, g.achternaam), ''), o.contact_naam),
         CASE WHEN tr.organisatie_id IS NOT NULL THEN o.naam ELSE oa.organisatie_naam END,
         CASE WHEN tr.organisatie_id IS NOT NULL THEN o.btw_nummer ELSE oa.btw_nummer END,
         CASE WHEN tr.organisatie_id IS NOT NULL THEN o.adres ELSE oa.adres END
    INTO v_email, v_naam, v_org, v_btw, v_adres
  FROM toegangsrechten tr
  LEFT JOIN gebruikers g ON g.id = tr.gebruiker_id
  LEFT JOIN organisaties o ON o.id = tr.organisatie_id
  LEFT JOIN aanvragen oa ON oa.id = tr.aanvraag_id
  WHERE tr.id = p_recht;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Geen e-mailadres gekend voor deze klant'; END IF;
  INSERT INTO aanvragen (type, email, voornaam, organisatie_naam, btw_nummer, adres, product_id, aantal_plaatsen, toegangsrecht_id,
                         bedrag_excl_btw, opmerking, organisatie_id, gebruiker_id)
  VALUES ('verlenging', v_email, v_naam, v_org, v_btw, v_adres, r.product_id, r.aantal_plaatsen, r.id,
          s.prijs_excl_btw, concat_ws(' · ', 'Verlenging ' || (s.gebruikt + 1) || ' van ' || s.maximum, p_opmerking), r.organisatie_id, r.gebruiker_id)
  RETURNING id INTO v_id;
  PERFORM log_actie('verlenging_aangevraagd', 'aanvraag', v_id, jsonb_build_object('recht', r.id, 'nr', s.gebruikt + 1, 'bedrag', s.prijs_excl_btw));
  RETURN v_id;
END $$;

-- Meldingen die de beheerder van een onderneming of de superadmin te zien krijgt: centrale -> onderneming.
-- De functies blijven verder ongewijzigd: we vervangen enkel de tekst in de huidige definitie. Opnieuw uitvoeren mag.
DO $$
DECLARE
  t record;
  def text;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('activeer_aanvraag', 'Naam van de centrale ontbreekt', 'Naam van de onderneming ontbreekt'),
    ('activeer_aanvraag', 'Dit e-mailadres hoort al bij een andere centrale', 'Dit e-mailadres hoort al bij een andere onderneming'),
    ('voeg_cursist_toe', 'Dit e-mailadres hoort al bij een andere centrale', 'Dit e-mailadres hoort al bij een andere onderneming'),
    ('wijs_plaats_toe', 'Dit is geen toegangsrecht van een centrale', 'Dit is geen toegangsrecht van een onderneming'),
    ('wijs_plaats_toe', 'Deze persoon hoort niet bij deze centrale', 'Deze persoon hoort niet bij deze onderneming'),
    ('publiceer_versie', 'Voeg eerst personen of centrales toe aan de proefgroep', 'Voeg eerst personen of ondernemingen toe aan de proefgroep')
  ) AS v(functie, oud, nieuw) LOOP
    def := pg_get_functiondef(t.functie::regproc);
    IF position(t.oud IN def) > 0 THEN
      EXECUTE replace(def, t.oud, t.nieuw);
    ELSIF position(t.nieuw IN def) = 0 THEN
      RAISE EXCEPTION 'Tekst "%" niet gevonden in %', t.oud, t.functie;
    END IF;
  END LOOP;
END $$;
