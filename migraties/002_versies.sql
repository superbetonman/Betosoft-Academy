-- 002 Versiebeheer per module, toegang 3 maanden, verlengingsaanvragen
-- Voer eerst apart (buiten transactie) uit:
--   ALTER TYPE aanvraag_type ADD VALUE IF NOT EXISTS 'verlenging';

CREATE TYPE versie_status AS ENUM ('concept','proef','actueel','archief');
CREATE TYPE wijziging_soort AS ENUM ('inhoudelijk','redactioneel');

CREATE TABLE module_versies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  label text NOT NULL,
  status versie_status NOT NULL DEFAULT 'concept',
  vorige_versie_id uuid REFERENCES module_versies(id),
  wijzigingsnota text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  gepubliceerd_op timestamptz,
  gearchiveerd_op timestamptz,
  UNIQUE (module_id, label)
);
CREATE UNIQUE INDEX een_actuele_versie ON module_versies (module_id) WHERE status = 'actueel';
CREATE UNIQUE INDEX een_open_versie ON module_versies (module_id) WHERE status IN ('concept','proef');

-- Lessen, toetsen en vragen horen voortaan bij een moduleversie.
-- sleutel = vaste naam over versies heen; inhoudsrevisie stijgt enkel bij een inhoudelijke wijziging.
ALTER TABLE lessen DROP COLUMN module_id;
ALTER TABLE lessen
  ADD COLUMN module_versie_id uuid NOT NULL REFERENCES module_versies(id) ON DELETE CASCADE,
  ADD COLUMN sleutel text NOT NULL DEFAULT ('les-' || substr(gen_random_uuid()::text, 1, 8)),
  ADD COLUMN inhoud_hash text,
  ADD COLUMN wijziging wijziging_soort,
  ADD COLUMN wijzigingsnota text,
  ADD COLUMN inhoudsrevisie int NOT NULL DEFAULT 1,
  ADD CONSTRAINT les_sleutel_uniek UNIQUE (module_versie_id, sleutel);

ALTER TABLE toetsen DROP COLUMN module_id;
ALTER TABLE toetsen
  ADD COLUMN module_versie_id uuid NOT NULL REFERENCES module_versies(id) ON DELETE CASCADE,
  ADD COLUMN sleutel text NOT NULL DEFAULT ('toets-' || substr(gen_random_uuid()::text, 1, 8)),
  ADD CONSTRAINT toets_sleutel_uniek UNIQUE (module_versie_id, sleutel);

ALTER TABLE vragen
  ADD COLUMN sleutel text NOT NULL DEFAULT ('vraag-' || substr(gen_random_uuid()::text, 1, 8)),
  ADD COLUMN inhoud_hash text,
  ADD COLUMN wijziging wijziging_soort,
  ADD COLUMN wijzigingsnota text,
  ADD COLUMN inhoudsrevisie int NOT NULL DEFAULT 1,
  ADD CONSTRAINT vraag_sleutel_uniek UNIQUE (toets_id, sleutel);

ALTER TABLE toetspogingen ADD COLUMN overgenomen_van uuid REFERENCES toetspogingen(id);
ALTER TABLE attesten ADD COLUMN module_versie_id uuid REFERENCES module_versies(id);
ALTER TABLE aanvragen ADD COLUMN toegangsrecht_id uuid REFERENCES toegangsrechten(id);

-- Welke versie volgt een cursist per module
CREATE TABLE cursist_moduleversie (
  gebruiker_id uuid NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  module_versie_id uuid NOT NULL REFERENCES module_versies(id),
  sinds timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gebruiker_id, module_id)
);

-- Proefgroep: personen of hele centrales die een proefversie zien
CREATE TABLE versie_proefgroep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_versie_id uuid NOT NULL REFERENCES module_versies(id) ON DELETE CASCADE,
  gebruiker_id uuid REFERENCES gebruikers(id) ON DELETE CASCADE,
  organisatie_id uuid REFERENCES organisaties(id) ON DELETE CASCADE,
  CHECK ((gebruiker_id IS NULL) <> (organisatie_id IS NULL))
);
CREATE UNIQUE INDEX proef_gebruiker_uniek ON versie_proefgroep (module_versie_id, gebruiker_id) WHERE gebruiker_id IS NOT NULL;
CREATE UNIQUE INDEX proef_org_uniek ON versie_proefgroep (module_versie_id, organisatie_id) WHERE organisatie_id IS NOT NULL;

-- Spoor van overgangen
CREATE TABLE versie_overgangen (
  id bigserial PRIMARY KEY,
  gebruiker_id uuid NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id),
  van_versie_id uuid REFERENCES module_versies(id),
  naar_versie_id uuid NOT NULL REFERENCES module_versies(id),
  lessen_overgenomen int NOT NULL DEFAULT 0,
  lessen_open int NOT NULL DEFAULT 0,
  reden text,
  tijdstip timestamptz NOT NULL DEFAULT now()
);

-- Eerste versie per module (nog geen inhoud, dus concept)
INSERT INTO module_versies (module_id, label, status) SELECT id, '2026.1', 'concept' FROM modules;

-- ---------- Inhoud bewaken ----------
CREATE FUNCTION versie_bewerkbaar(p_versie uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s versie_status;
BEGIN
  SELECT status INTO s FROM module_versies WHERE id = p_versie;
  IF s = 'archief' THEN RAISE EXCEPTION 'Een gearchiveerde versie kan niet meer gewijzigd worden'; END IF;
END $$;

CREATE FUNCTION les_hash() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM versie_bewerkbaar(NEW.module_versie_id);
  NEW.inhoud_hash := md5(coalesce(NEW.titel,'') || '|' || coalesce(NEW.inhoud::text,''));
  IF TG_OP = 'UPDATE' AND NEW.inhoud_hash IS DISTINCT FROM OLD.inhoud_hash AND NEW.wijziging IS NOT DISTINCT FROM OLD.wijziging THEN
    NEW.wijziging := NULL; -- opnieuw te beoordelen na elke inhoudswijziging
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER les_hash_trg BEFORE INSERT OR UPDATE ON lessen FOR EACH ROW EXECUTE FUNCTION les_hash();

CREATE FUNCTION vraag_hash() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  SELECT module_versie_id INTO v FROM toetsen WHERE id = NEW.toets_id;
  PERFORM versie_bewerkbaar(v);
  NEW.inhoud_hash := md5(coalesce(NEW.vraag,'') || '|' || NEW.opties::text || '|' || NEW.juist::text || '|' || NEW.type::text || '|' || NEW.gewicht::text);
  IF TG_OP = 'UPDATE' AND NEW.inhoud_hash IS DISTINCT FROM OLD.inhoud_hash AND NEW.wijziging IS NOT DISTINCT FROM OLD.wijziging THEN
    NEW.wijziging := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vraag_hash_trg BEFORE INSERT OR UPDATE ON vragen FOR EACH ROW EXECUTE FUNCTION vraag_hash();

-- ---------- Wijzigingsoverzicht ----------
-- soort: nieuw | inhoudelijk | redactioneel | te_beoordelen | weggevallen | verplaatst | ongewijzigd
CREATE VIEW v_versie_verschil AS
SELECT v.id AS versie_id, 'les'::text AS onderdeel, x.sleutel, x.titel, NULL::text AS toets,
       x.nieuw_id, x.oud_id, x.volgorde_oud, x.volgorde_nieuw,
       CASE WHEN x.oud_id IS NULL THEN 'nieuw'
            WHEN x.nieuw_id IS NULL THEN 'weggevallen'
            WHEN x.hash_n <> x.hash_o THEN coalesce(x.wijziging::text, 'te_beoordelen')
            WHEN x.volgorde_n_rel <> x.volgorde_o_rel THEN 'verplaatst'
            ELSE 'ongewijzigd' END AS soort,
       x.nota
FROM module_versies v
CROSS JOIN LATERAL (
  SELECT coalesce(n.sleutel, o.sleutel) AS sleutel, coalesce(n.titel, o.titel) AS titel,
         n.id AS nieuw_id, o.id AS oud_id, o.volgorde AS volgorde_oud, n.volgorde AS volgorde_nieuw,
         n.inhoud_hash AS hash_n, o.inhoud_hash AS hash_o, n.wijziging, n.wijzigingsnota AS nota,
         n.rang AS volgorde_n_rel, o.rang AS volgorde_o_rel
  FROM (SELECT l.*, sum(CASE WHEN EXISTS (SELECT 1 FROM lessen z WHERE z.module_versie_id = v.vorige_versie_id AND z.sleutel = l.sleutel) THEN 1 ELSE 0 END) OVER (ORDER BY l.volgorde, l.sleutel) AS rang FROM lessen l WHERE l.module_versie_id = v.id) n
  FULL JOIN (SELECT l.*, sum(CASE WHEN EXISTS (SELECT 1 FROM lessen z WHERE z.module_versie_id = v.id AND z.sleutel = l.sleutel) THEN 1 ELSE 0 END) OVER (ORDER BY l.volgorde, l.sleutel) AS rang FROM lessen l WHERE l.module_versie_id = v.vorige_versie_id) o
    ON o.sleutel = n.sleutel
) x
UNION ALL
SELECT v.id, 'vraag', x.sleutel, left(x.titel, 140), x.toets,
       x.nieuw_id, x.oud_id, x.volgorde_oud, x.volgorde_nieuw,
       CASE WHEN x.oud_id IS NULL THEN 'nieuw'
            WHEN x.nieuw_id IS NULL THEN 'weggevallen'
            WHEN x.hash_n <> x.hash_o THEN coalesce(x.wijziging::text, 'te_beoordelen')
            ELSE 'ongewijzigd' END,
       x.nota
FROM module_versies v
CROSS JOIN LATERAL (
  SELECT coalesce(n.sleutel, o.sleutel) AS sleutel, coalesce(n.vraag, o.vraag) AS titel, coalesce(n.toets, o.toets) AS toets,
         n.id AS nieuw_id, o.id AS oud_id, o.volgorde AS volgorde_oud, n.volgorde AS volgorde_nieuw,
         n.inhoud_hash AS hash_n, o.inhoud_hash AS hash_o, n.wijziging, n.wijzigingsnota AS nota
  FROM (SELECT q.*, t.sleutel AS toets_sleutel, t.titel AS toets FROM vragen q JOIN toetsen t ON t.id = q.toets_id WHERE t.module_versie_id = v.id) n
  FULL JOIN (SELECT q.*, t.sleutel AS toets_sleutel, t.titel AS toets FROM vragen q JOIN toetsen t ON t.id = q.toets_id WHERE t.module_versie_id = v.vorige_versie_id) o
    ON o.toets_sleutel = n.toets_sleutel AND o.sleutel = n.sleutel
) x;

-- ---------- Nieuwe versie maken (kopie van de laatste versie) ----------
CREATE FUNCTION nieuwe_versie(p_module uuid, p_label text, p_nota text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE bron module_versies%ROWTYPE; v_nieuw uuid; t record; v_toets uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM module_versies WHERE module_id = p_module AND status IN ('concept','proef')) THEN
    RAISE EXCEPTION 'Er is al een versie in voorbereiding (concept of proef) voor deze module';
  END IF;
  SELECT * INTO bron FROM module_versies WHERE module_id = p_module AND status = 'actueel';
  IF NOT FOUND THEN RAISE EXCEPTION 'Deze module heeft nog geen actuele versie om van te vertrekken'; END IF;
  INSERT INTO module_versies (module_id, label, status, vorige_versie_id, wijzigingsnota)
  VALUES (p_module, p_label, 'concept', bron.id, p_nota) RETURNING id INTO v_nieuw;
  INSERT INTO lessen (module_versie_id, sleutel, volgorde, titel, inhoud, duur_min, punten, inhoudsrevisie)
  SELECT v_nieuw, sleutel, volgorde, titel, inhoud, duur_min, punten, inhoudsrevisie FROM lessen WHERE module_versie_id = bron.id;
  FOR t IN SELECT * FROM toetsen WHERE module_versie_id = bron.id LOOP
    INSERT INTO toetsen (module_versie_id, sleutel, titel, slaagdrempel, max_pogingen, aantal_vragen, is_eindtoets)
    VALUES (v_nieuw, t.sleutel, t.titel, t.slaagdrempel, t.max_pogingen, t.aantal_vragen, t.is_eindtoets) RETURNING id INTO v_toets;
    INSERT INTO vragen (toets_id, sleutel, les_id, type, vraag, opties, juist, uitleg, gewicht, volgorde, inhoudsrevisie)
    SELECT v_toets, q.sleutel, nl.id, q.type, q.vraag, q.opties, q.juist, q.uitleg, q.gewicht, q.volgorde, q.inhoudsrevisie
    FROM vragen q LEFT JOIN lessen ol ON ol.id = q.les_id LEFT JOIN lessen nl ON nl.module_versie_id = v_nieuw AND nl.sleutel = ol.sleutel
    WHERE q.toets_id = t.id;
  END LOOP;
  PERFORM log_actie('versie_aangemaakt', 'module_versie', v_nieuw, jsonb_build_object('label', p_label, 'van', bron.label));
  RETURN v_nieuw;
END $$;

-- ---------- Wijziging beoordelen ----------
CREATE FUNCTION beoordeel_wijziging(p_onderdeel text, p_id uuid, p_soort wijziging_soort, p_nota text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_onderdeel = 'les' THEN
    UPDATE lessen SET wijziging = p_soort, wijzigingsnota = p_nota WHERE id = p_id;
  ELSIF p_onderdeel = 'vraag' THEN
    UPDATE vragen SET wijziging = p_soort, wijzigingsnota = p_nota WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Onbekend onderdeel'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onderdeel niet gevonden'; END IF;
END $$;

-- ---------- Welke versie geldt voor een cursist ----------
CREATE FUNCTION versie_voor(p_gebruiker uuid, p_module uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT module_versie_id FROM cursist_moduleversie WHERE gebruiker_id = p_gebruiker AND module_id = p_module),
    (SELECT mv.id FROM module_versies mv JOIN versie_proefgroep pg ON pg.module_versie_id = mv.id
       LEFT JOIN gebruikers g ON g.id = p_gebruiker
     WHERE mv.module_id = p_module AND mv.status = 'proef' AND (pg.gebruiker_id = p_gebruiker OR pg.organisatie_id = g.organisatie_id) LIMIT 1),
    (SELECT id FROM module_versies WHERE module_id = p_module AND status = 'actueel')
  )
$$;

-- Doelversie voor iemand met lopende toegang: proefversie als hij in de proefgroep zit, anders de actuele
CREATE FUNCTION doelversie(p_gebruiker uuid, p_module uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT mv.id FROM module_versies mv JOIN versie_proefgroep pg ON pg.module_versie_id = mv.id
       LEFT JOIN gebruikers g ON g.id = p_gebruiker
     WHERE mv.module_id = p_module AND mv.status = 'proef' AND (pg.gebruiker_id = p_gebruiker OR pg.organisatie_id = g.organisatie_id) LIMIT 1),
    (SELECT id FROM module_versies WHERE module_id = p_module AND status = 'actueel')
  )
$$;

-- ---------- Cursist overzetten naar een versie, met behoud van wat geldig blijft ----------
CREATE FUNCTION zet_op_versie(p_gebruiker uuid, p_module uuid, p_versie uuid, p_reden text DEFAULT NULL) RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_oud uuid; v_over int := 0; v_open int := 0; t record; v_poging uuid;
BEGIN
  IF p_versie IS NULL THEN RETURN 0; END IF;
  SELECT module_versie_id INTO v_oud FROM cursist_moduleversie WHERE gebruiker_id = p_gebruiker AND module_id = p_module FOR UPDATE;
  IF v_oud = p_versie THEN RETURN 0; END IF;
  IF v_oud IS NOT NULL THEN
    -- Lessen: overnemen als dezelfde sleutel en dezelfde inhoudsrevisie
    INSERT INTO voortgang (gebruiker_id, les_id, voltooid_op)
    SELECT p_gebruiker, n.id, vg.voltooid_op
    FROM lessen n JOIN lessen o ON o.sleutel = n.sleutel AND o.module_versie_id = v_oud
    JOIN voortgang vg ON vg.les_id = o.id AND vg.gebruiker_id = p_gebruiker
    WHERE n.module_versie_id = p_versie AND n.inhoudsrevisie = o.inhoudsrevisie
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_over = ROW_COUNT;
    -- Toetsen: geslaagde poging overnemen als alle vragen dezelfde sleutel en inhoudsrevisie hebben
    FOR t IN
      SELECT nt.id AS nieuw, ot.id AS oud FROM toetsen nt JOIN toetsen ot ON ot.sleutel = nt.sleutel AND ot.module_versie_id = v_oud
      WHERE nt.module_versie_id = p_versie
        AND NOT EXISTS (
          (SELECT sleutel, inhoudsrevisie FROM vragen WHERE toets_id = nt.id EXCEPT SELECT sleutel, inhoudsrevisie FROM vragen WHERE toets_id = ot.id)
          UNION ALL
          (SELECT sleutel, inhoudsrevisie FROM vragen WHERE toets_id = ot.id EXCEPT SELECT sleutel, inhoudsrevisie FROM vragen WHERE toets_id = nt.id))
    LOOP
      SELECT id INTO v_poging FROM toetspogingen WHERE gebruiker_id = p_gebruiker AND toets_id = t.oud AND geslaagd ORDER BY score DESC LIMIT 1;
      IF v_poging IS NOT NULL THEN
        INSERT INTO toetspogingen (gebruiker_id, toets_id, gestart_op, ingediend_op, score, geslaagd, overgenomen_van)
        SELECT gebruiker_id, t.nieuw, gestart_op, ingediend_op, score, geslaagd, id FROM toetspogingen WHERE id = v_poging;
      END IF;
    END LOOP;
  END IF;
  SELECT count(*) INTO v_open FROM lessen n WHERE n.module_versie_id = p_versie
    AND NOT EXISTS (SELECT 1 FROM voortgang vg WHERE vg.les_id = n.id AND vg.gebruiker_id = p_gebruiker);
  INSERT INTO cursist_moduleversie (gebruiker_id, module_id, module_versie_id) VALUES (p_gebruiker, p_module, p_versie)
  ON CONFLICT (gebruiker_id, module_id) DO UPDATE SET module_versie_id = EXCLUDED.module_versie_id, sinds = now();
  INSERT INTO versie_overgangen (gebruiker_id, module_id, van_versie_id, naar_versie_id, lessen_overgenomen, lessen_open, reden)
  VALUES (p_gebruiker, p_module, v_oud, p_versie, v_over, v_open, p_reden);
  RETURN 1;
END $$;

-- Iedereen met lopende toegang tot een module naar zijn doelversie brengen (enkel wie de module al volgt)
CREATE FUNCTION breng_bij(p_module uuid, p_reden text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT cm.gebruiker_id, doelversie(cm.gebruiker_id, cm.module_id) AS doel
    FROM cursist_moduleversie cm
    JOIN v_module_toegang mt ON mt.gebruiker_id = cm.gebruiker_id AND mt.module_id = cm.module_id
    WHERE cm.module_id = p_module
  LOOP
    n := n + zet_op_versie(r.gebruiker_id, p_module, r.doel, p_reden);
  END LOOP;
  RETURN n;
END $$;

-- Wie zou overgezet worden bij publicatie (zonder iets te wijzigen)
CREATE FUNCTION versie_impact(p_versie uuid, p_status versie_status DEFAULT 'actueel') RETURNS TABLE (cursisten int, zonder_toegang int) LANGUAGE sql STABLE AS $$
  WITH mv AS (SELECT * FROM module_versies WHERE id = p_versie),
  volgers AS (
    SELECT cm.gebruiker_id, g.organisatie_id,
           EXISTS (SELECT 1 FROM v_module_toegang mt WHERE mt.gebruiker_id = cm.gebruiker_id AND mt.module_id = cm.module_id) AS toegang
    FROM cursist_moduleversie cm JOIN mv ON mv.module_id = cm.module_id JOIN gebruikers g ON g.id = cm.gebruiker_id
    WHERE cm.module_versie_id <> p_versie
      AND (p_status = 'actueel' OR EXISTS (SELECT 1 FROM versie_proefgroep pg WHERE pg.module_versie_id = p_versie
                                           AND (pg.gebruiker_id = cm.gebruiker_id OR pg.organisatie_id = g.organisatie_id)))
  )
  SELECT count(*) FILTER (WHERE toegang)::int, count(*) FILTER (WHERE NOT toegang)::int FROM volgers
$$;

-- ---------- Publiceren ----------
CREATE FUNCTION publiceer_versie(p_versie uuid, p_status versie_status) RETURNS int LANGUAGE plpgsql AS $$
DECLARE v module_versies%ROWTYPE; v_open int; n int;
BEGIN
  IF p_status NOT IN ('proef','actueel') THEN RAISE EXCEPTION 'Publiceer als proef of als actueel'; END IF;
  SELECT * INTO v FROM module_versies WHERE id = p_versie FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versie niet gevonden'; END IF;
  IF v.status NOT IN ('concept','proef') THEN RAISE EXCEPTION 'Deze versie is al %', v.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM lessen WHERE module_versie_id = p_versie) THEN RAISE EXCEPTION 'Deze versie heeft nog geen lessen'; END IF;
  SELECT count(*) INTO v_open FROM v_versie_verschil WHERE versie_id = p_versie AND soort = 'te_beoordelen';
  IF v_open > 0 THEN RAISE EXCEPTION 'Beoordeel eerst % gewijzigde onderdelen (inhoudelijk of redactioneel)', v_open; END IF;
  IF p_status = 'proef' AND NOT EXISTS (SELECT 1 FROM versie_proefgroep WHERE module_versie_id = p_versie) THEN
    RAISE EXCEPTION 'Voeg eerst personen of centrales toe aan de proefgroep';
  END IF;

  -- Inhoudsrevisie vastleggen: stijgt enkel bij een inhoudelijke wijziging
  UPDATE lessen n SET inhoudsrevisie = CASE WHEN n.inhoud_hash <> o.inhoud_hash AND n.wijziging = 'inhoudelijk' THEN o.inhoudsrevisie + 1 ELSE o.inhoudsrevisie END
  FROM lessen o WHERE n.module_versie_id = p_versie AND o.module_versie_id = v.vorige_versie_id AND o.sleutel = n.sleutel;
  UPDATE vragen n SET inhoudsrevisie = CASE WHEN n.inhoud_hash <> o.inhoud_hash AND n.wijziging = 'inhoudelijk' THEN o.inhoudsrevisie + 1 ELSE o.inhoudsrevisie END
  FROM toetsen nt, toetsen ot, vragen o
  WHERE n.toets_id = nt.id AND nt.module_versie_id = p_versie AND ot.module_versie_id = v.vorige_versie_id
    AND ot.sleutel = nt.sleutel AND o.toets_id = ot.id AND o.sleutel = n.sleutel;

  IF p_status = 'actueel' THEN
    UPDATE module_versies SET status = 'archief', gearchiveerd_op = now() WHERE module_id = v.module_id AND status = 'actueel';
    UPDATE module_versies SET status = 'actueel', gepubliceerd_op = now() WHERE id = p_versie;
  ELSE
    UPDATE module_versies SET status = 'proef', gepubliceerd_op = coalesce(gepubliceerd_op, now()) WHERE id = p_versie;
  END IF;
  n := breng_bij(v.module_id, 'publicatie ' || v.label || ' als ' || p_status::text);
  PERFORM log_actie('versie_gepubliceerd', 'module_versie', p_versie, jsonb_build_object('label', v.label, 'status', p_status, 'overgezet', n));
  RETURN n;
END $$;

-- ---------- Toegang: 3 maanden, verlengingsaanvragen ----------
UPDATE producten SET geldigheid_maanden = 3,
       beschrijving = replace(coalesce(beschrijving, ''), '12 maanden toegang', '3 maanden toegang')
WHERE type IN ('module','traject');

-- Na verlenging: wie de module al volgt, gaat mee naar de actuele versie
CREATE FUNCTION breng_bij_voor_recht(p_recht uuid) RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT cm.gebruiker_id, cm.module_id FROM cursist_moduleversie cm
    JOIN v_module_toegang mt ON mt.gebruiker_id = cm.gebruiker_id AND mt.module_id = cm.module_id AND mt.recht_id = p_recht
  LOOP
    n := n + zet_op_versie(r.gebruiker_id, r.module_id, doelversie(r.gebruiker_id, r.module_id), 'verlenging');
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION verleng_recht(p_recht uuid, p_maanden int DEFAULT NULL, p_eind date DEFAULT NULL, p_factuur text DEFAULT NULL, p_opmerking text DEFAULT NULL) RETURNS date LANGUAGE plpgsql AS $$
DECLARE r toegangsrechten%ROWTYPE; v_basis date; v_nieuw date;
BEGIN
  SELECT * INTO r FROM toegangsrechten WHERE id = p_recht FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Toegangsrecht niet gevonden'; END IF;
  IF p_eind IS NULL AND p_maanden IS NULL THEN RAISE EXCEPTION 'Geef een aantal maanden of een einddatum'; END IF;
  IF p_eind IS NOT NULL THEN v_nieuw := p_eind;
  ELSE
    v_basis := GREATEST(COALESCE(r.eind_datum, current_date - 1), current_date - 1);
    v_nieuw := (v_basis + make_interval(months => p_maanden))::date;
  END IF;
  IF v_nieuw < r.start_datum THEN RAISE EXCEPTION 'Nieuwe einddatum ligt voor de startdatum'; END IF;
  INSERT INTO verlengingen (toegangsrecht_id, oude_eind_datum, nieuwe_eind_datum, factuurnummer, opmerking) VALUES (r.id, r.eind_datum, v_nieuw, p_factuur, p_opmerking);
  UPDATE toegangsrechten SET eind_datum = v_nieuw, status = 'actief', factuurnummer = COALESCE(p_factuur, factuurnummer) WHERE id = r.id;
  PERFORM breng_bij_voor_recht(r.id);
  PERFORM log_actie('recht_verlengd', 'toegangsrecht', r.id, jsonb_build_object('van', r.eind_datum, 'tot', v_nieuw, 'factuur', p_factuur));
  RETURN v_nieuw;
END $$;

-- Verlengingsaanvraag (cursist of centrale die niet klaar is) loopt via dezelfde activatie
CREATE OR REPLACE FUNCTION activeer_aanvraag(p_aanvraag uuid, p_factuur text DEFAULT NULL, p_start date DEFAULT current_date) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a aanvragen%ROWTYPE; p producten%ROWTYPE; v_org uuid; v_gebr uuid; v_recht uuid; v_bestaande_org uuid;
BEGIN
  SELECT * INTO a FROM aanvragen WHERE id = p_aanvraag FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aanvraag niet gevonden'; END IF;
  IF a.status NOT IN ('nieuw','gefactureerd') THEN RAISE EXCEPTION 'Aanvraag is al %', a.status; END IF;

  IF a.type::text = 'verlenging' THEN
    IF a.toegangsrecht_id IS NULL THEN RAISE EXCEPTION 'Verlengingsaanvraag zonder toegangsrecht'; END IF;
    SELECT p2.* INTO p FROM toegangsrechten tr JOIN producten p2 ON p2.id = tr.product_id WHERE tr.id = a.toegangsrecht_id;
    PERFORM verleng_recht(a.toegangsrecht_id, instelling_getal('verlenging_maanden')::int, NULL, COALESCE(p_factuur, a.factuurnummer), 'verlengingsaanvraag');
    UPDATE aanvragen SET status = 'geactiveerd', factuurnummer = COALESCE(p_factuur, factuurnummer), verwerkt_op = now() WHERE id = a.id;
    RETURN a.toegangsrecht_id;
  END IF;

  IF a.product_id IS NULL THEN RAISE EXCEPTION 'Aanvraag heeft geen product'; END IF;
  SELECT * INTO p FROM producten WHERE id = a.product_id;
  IF a.type = 'centrale' THEN
    IF a.organisatie_naam IS NULL THEN RAISE EXCEPTION 'Naam van de centrale ontbreekt'; END IF;
    IF a.btw_nummer IS NOT NULL THEN SELECT id INTO v_org FROM organisaties WHERE btw_nummer = a.btw_nummer AND ouder_id IS NULL; END IF;
    IF v_org IS NULL THEN
      INSERT INTO organisaties (naam, btw_nummer, adres, contact_naam, contact_email, telefoon)
      VALUES (a.organisatie_naam, a.btw_nummer, a.adres, concat_ws(' ', a.voornaam, a.achternaam), a.email, a.telefoon) RETURNING id INTO v_org;
    END IF;
  END IF;
  SELECT id, organisatie_id INTO v_gebr, v_bestaande_org FROM gebruikers WHERE email = a.email;
  IF v_gebr IS NULL THEN
    INSERT INTO gebruikers (email, voornaam, achternaam, rol, organisatie_id)
    VALUES (a.email, a.voornaam, a.achternaam, CASE WHEN a.type = 'centrale' THEN 'centrale_verantwoordelijke'::gebruiker_rol ELSE 'cursist'::gebruiker_rol END, v_org) RETURNING id INTO v_gebr;
  ELSIF a.type = 'centrale' THEN
    IF v_bestaande_org IS NOT NULL AND v_bestaande_org <> v_org THEN RAISE EXCEPTION 'Dit e-mailadres hoort al bij een andere centrale'; END IF;
    UPDATE gebruikers SET organisatie_id = v_org, rol = CASE WHEN rol = 'beheerder' THEN rol ELSE 'centrale_verantwoordelijke' END WHERE id = v_gebr;
  END IF;
  INSERT INTO toegangsrechten (gebruiker_id, organisatie_id, product_id, aantal_plaatsen, start_datum, eind_datum, factuurnummer, aanvraag_id)
  VALUES (CASE WHEN a.type = 'individueel' THEN v_gebr END, CASE WHEN a.type = 'centrale' THEN v_org END, a.product_id,
          CASE WHEN a.type = 'centrale' THEN a.aantal_plaatsen ELSE 1 END, p_start, eind_voor(p_start, p.geldigheid_maanden), COALESCE(p_factuur, a.factuurnummer), a.id)
  RETURNING id INTO v_recht;
  UPDATE aanvragen SET status = 'geactiveerd', factuurnummer = COALESCE(p_factuur, factuurnummer), organisatie_id = v_org, gebruiker_id = v_gebr, verwerkt_op = now() WHERE id = a.id;
  -- Een cursist die een module eerder volgde (bv. na verlopen toegang) gaat mee naar de actuele versie
  PERFORM breng_bij_voor_recht(v_recht);
  PERFORM log_actie('aanvraag_geactiveerd', 'toegangsrecht', v_recht, jsonb_build_object('aanvraag', a.id, 'product', p.code, 'factuur', COALESCE(p_factuur, a.factuurnummer)));
  RETURN v_recht;
END $$;

-- Wie heeft binnen 14 dagen geen toegang meer en is nog niet klaar
CREATE OR REPLACE VIEW v_aflopend AS
SELECT tr.*, COALESCE(g.email, o.contact_email) AS email,
       COALESCE(o.naam, concat_ws(' ', g.voornaam, g.achternaam)) AS klant, p.naam AS product_naam,
       tr.eind_datum - current_date AS dagen_resterend,
       (SELECT count(*)::int FROM v_module_toegang mt
          WHERE mt.recht_id = tr.id
            AND NOT EXISTS (SELECT 1 FROM attesten at WHERE at.gebruiker_id = mt.gebruiker_id AND at.module_id = mt.module_id AND at.ingetrokken_op IS NULL)
       ) AS modules_niet_af,
       EXISTS (SELECT 1 FROM aanvragen av WHERE av.toegangsrecht_id = tr.id AND av.status IN ('nieuw','gefactureerd')) AS verlenging_aangevraagd
FROM toegangsrechten tr
JOIN producten p ON p.id = tr.product_id
LEFT JOIN gebruikers g ON g.id = tr.gebruiker_id
LEFT JOIN organisaties o ON o.id = tr.organisatie_id
WHERE tr.status = 'actief' AND tr.eind_datum IS NOT NULL AND tr.eind_datum <= current_date + 14;

-- =====================================================================
-- Instellingen, beheerders, prijs per aanvraag, verlengingsregels
-- Voer eerst apart uit:  ALTER TYPE gebruiker_rol ADD VALUE IF NOT EXISTS 'superadmin';
-- =====================================================================
CREATE TABLE instellingen (
  sleutel text PRIMARY KEY,
  waarde jsonb NOT NULL,
  omschrijving text,
  gewijzigd_op timestamptz NOT NULL DEFAULT now()
);
INSERT INTO instellingen (sleutel, waarde, omschrijving) VALUES
 ('verlenging_maanden', '1', 'Duur van één verlenging, in maanden'),
 ('verlenging_prijs_pct', '25', 'Prijs van één verlenging, in % van de oorspronkelijke prijs'),
 ('verlenging_max', '3', 'Maximaal aantal verlengingen per toegangsrecht'),
 ('verlenging_venster_maanden', '3', 'Verlengen kan enkel binnen dit aantal maanden na de start'),
 ('btw_pct', '21', 'Btw-tarief in %, enkel voor weergave'),
 ('herinnering_dagen', '[14, 3]', 'Herinnering voor het einde van de toegang, dagen vooraf');

CREATE FUNCTION instelling_getal(p_sleutel text) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT (waarde #>> '{}')::numeric FROM instellingen WHERE sleutel = p_sleutel
$$;

ALTER TABLE gebruikers ADD COLUMN gebruikersnaam citext UNIQUE, ADD COLUMN wachtwoord_hash text;
ALTER TABLE aanvragen ADD COLUMN bedrag_excl_btw numeric(10,2);

-- Bedrag vastleggen bij elke aanvraag (prijs op dat moment x plaatsen)
CREATE FUNCTION aanvraag_bedrag() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_prijs numeric;
BEGIN
  IF NEW.bedrag_excl_btw IS NULL AND NEW.type::text <> 'verlenging' AND NEW.product_id IS NOT NULL THEN
    SELECT prijs_excl_btw INTO v_prijs FROM producten WHERE id = NEW.product_id;
    IF v_prijs IS NOT NULL THEN NEW.bedrag_excl_btw := round(v_prijs * NEW.aantal_plaatsen, 2); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER aanvraag_bedrag_trg BEFORE INSERT ON aanvragen FOR EACH ROW EXECUTE FUNCTION aanvraag_bedrag();

-- Stand van de verlengingen voor een toegangsrecht
CREATE VIEW v_verlenging_stand AS
SELECT tr.id AS toegangsrecht_id,
       (SELECT count(*)::int FROM aanvragen a WHERE a.toegangsrecht_id = tr.id AND a.type::text = 'verlenging' AND a.status IN ('nieuw','gefactureerd','geactiveerd')) AS gebruikt,
       instelling_getal('verlenging_max')::int AS maximum,
       (tr.start_datum + make_interval(months => instelling_getal('verlenging_venster_maanden')::int) - interval '1 day')::date AS aanvragen_tot,
       round(coalesce(
         (SELECT a.bedrag_excl_btw FROM aanvragen a WHERE a.id = tr.aanvraag_id),
         p.prijs_excl_btw * tr.aantal_plaatsen) * instelling_getal('verlenging_prijs_pct') / 100, 2) AS prijs_excl_btw
FROM toegangsrechten tr JOIN producten p ON p.id = tr.product_id;

-- Verlengingsaanvraag registreren, met controle van de regels
CREATE FUNCTION vraag_verlenging(p_recht uuid, p_opmerking text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r toegangsrechten%ROWTYPE; s v_verlenging_stand%ROWTYPE; v_email citext; v_naam text; v_org text; v_id uuid;
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
  SELECT coalesce(g.email, o.contact_email), coalesce(concat_ws(' ', g.voornaam, g.achternaam), o.contact_naam), o.naam
    INTO v_email, v_naam, v_org
  FROM toegangsrechten tr LEFT JOIN gebruikers g ON g.id = tr.gebruiker_id LEFT JOIN organisaties o ON o.id = tr.organisatie_id
  WHERE tr.id = p_recht;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Geen e-mailadres gekend voor deze klant'; END IF;
  INSERT INTO aanvragen (type, email, voornaam, organisatie_naam, product_id, aantal_plaatsen, toegangsrecht_id, bedrag_excl_btw, opmerking,
                         organisatie_id, gebruiker_id)
  VALUES ('verlenging', v_email, v_naam, v_org, r.product_id, r.aantal_plaatsen, r.id, s.prijs_excl_btw,
          concat_ws(' · ', 'Verlenging ' || (s.gebruikt + 1) || ' van ' || s.maximum, p_opmerking), r.organisatie_id, r.gebruiker_id)
  RETURNING id INTO v_id;
  PERFORM log_actie('verlenging_aangevraagd', 'aanvraag', v_id, jsonb_build_object('recht', r.id, 'nr', s.gebruikt + 1, 'bedrag', s.prijs_excl_btw));
  RETURN v_id;
END $$;

-- =====================================================================
-- Centrales met locaties, uitnodigingen, beheerder per centrale of locatie
-- =====================================================================
ALTER TABLE organisaties ADD COLUMN ouder_id uuid REFERENCES organisaties(id) ON DELETE CASCADE,
  ADD CONSTRAINT geen_eigen_ouder CHECK (ouder_id IS DISTINCT FROM id);
ALTER TABLE organisaties ALTER COLUMN btw_nummer DROP NOT NULL;
-- Een locatie deelt het btw-nummer van het hoofdbedrijf: uniek enkel op hoofdniveau
ALTER TABLE organisaties DROP CONSTRAINT IF EXISTS organisaties_btw_nummer_key;
CREATE UNIQUE INDEX organisatie_btw_uniek ON organisaties (btw_nummer) WHERE ouder_id IS NULL AND btw_nummer IS NOT NULL;

-- Organisaties die een gebruiker mag beheren: eigen organisatie, plus locaties als het een hoofdbedrijf is
CREATE FUNCTION beheerde_organisaties(p_gebruiker uuid) RETURNS TABLE (organisatie_id uuid) LANGUAGE sql STABLE AS $$
  SELECT o.id FROM gebruikers g JOIN organisaties o ON o.id = g.organisatie_id OR o.ouder_id = g.organisatie_id
  WHERE g.id = p_gebruiker AND g.rol = 'centrale_verantwoordelijke' AND g.actief
$$;

-- Hoofdbedrijf van een organisatie
CREATE FUNCTION hoofdorganisatie(p_org uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(ouder_id, id) FROM organisaties WHERE id = p_org
$$;

CREATE TABLE uitnodigingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gebruiker_id uuid NOT NULL REFERENCES gebruikers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  vervalt_op timestamptz NOT NULL DEFAULT now() + interval '14 days',
  gebruikt_op timestamptz,
  aangemaakt_door uuid REFERENCES gebruikers(id),
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

-- Plaats toewijzen: ook aan medewerkers van een locatie van de centrale die de plaatsen kocht
CREATE OR REPLACE FUNCTION wijs_plaats_toe(p_recht uuid, p_gebruiker uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r toegangsrechten%ROWTYPE; v_org uuid; v_id uuid;
BEGIN
  SELECT * INTO r FROM toegangsrechten WHERE id = p_recht;
  IF NOT FOUND OR r.organisatie_id IS NULL THEN RAISE EXCEPTION 'Dit is geen toegangsrecht van een centrale'; END IF;
  IF r.status <> 'actief' OR (r.eind_datum IS NOT NULL AND r.eind_datum < current_date) THEN RAISE EXCEPTION 'Dit toegangsrecht is niet meer geldig'; END IF;
  SELECT organisatie_id INTO v_org FROM gebruikers WHERE id = p_gebruiker;
  IF v_org IS NULL OR (v_org <> r.organisatie_id AND hoofdorganisatie(v_org) <> r.organisatie_id) THEN
    RAISE EXCEPTION 'Deze persoon hoort niet bij deze centrale';
  END IF;
  INSERT INTO plaats_toewijzingen (toegangsrecht_id, gebruiker_id) VALUES (p_recht, p_gebruiker) RETURNING id INTO v_id;
  PERFORM log_actie('plaats_toegewezen', 'plaats', v_id, jsonb_build_object('recht', p_recht, 'gebruiker', p_gebruiker));
  RETURN v_id;
END $$;

-- Medewerker toevoegen aan centrale of locatie
CREATE OR REPLACE FUNCTION voeg_cursist_toe(p_org uuid, p_email citext, p_voornaam text, p_achternaam text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_org uuid;
BEGIN
  SELECT id, organisatie_id INTO v_id, v_org FROM gebruikers WHERE email = p_email;
  IF v_id IS NULL THEN
    INSERT INTO gebruikers (email, voornaam, achternaam, rol, organisatie_id) VALUES (p_email, p_voornaam, p_achternaam, 'cursist', p_org) RETURNING id INTO v_id;
  ELSIF v_org IS NULL THEN UPDATE gebruikers SET organisatie_id = p_org WHERE id = v_id;
  ELSIF v_org <> p_org THEN
    IF hoofdorganisatie(v_org) = hoofdorganisatie(p_org) THEN UPDATE gebruikers SET organisatie_id = p_org WHERE id = v_id; -- verhuist naar andere locatie
    ELSE RAISE EXCEPTION 'Dit e-mailadres hoort al bij een andere centrale'; END IF;
  END IF;
  PERFORM log_actie('cursist_toegevoegd', 'gebruiker', v_id, jsonb_build_object('organisatie', p_org));
  RETURN v_id;
END $$;

-- Stand per medewerker: voortgang, score, attesten, punten (voor overzicht en scorebord)
CREATE VIEW v_medewerker_stand AS
WITH toegang AS (
  SELECT mt.gebruiker_id, mt.module_id, min(mt.eind_datum) FILTER (WHERE mt.eind_datum IS NOT NULL) AS eind_datum
  FROM v_module_toegang mt GROUP BY mt.gebruiker_id, mt.module_id
), lessen_per AS (
  SELECT t.gebruiker_id,
         count(l.id)::int AS lessen_totaal,
         count(vg.les_id)::int AS lessen_af
  FROM toegang t
  JOIN lessen l ON l.module_versie_id = versie_voor(t.gebruiker_id, t.module_id)
  LEFT JOIN voortgang vg ON vg.les_id = l.id AND vg.gebruiker_id = t.gebruiker_id
  GROUP BY t.gebruiker_id
), score AS (
  SELECT gebruiker_id, round(avg(beste), 1) AS gem_score
  FROM (SELECT tp.gebruiker_id, tp.toets_id, max(tp.score) AS beste
        FROM toetspogingen tp JOIN toetsen t ON t.id = tp.toets_id JOIN module_versies mv ON mv.id = t.module_versie_id
        WHERE tp.score IS NOT NULL AND t.module_versie_id = versie_voor(tp.gebruiker_id, mv.module_id)
        GROUP BY 1, 2) b
  GROUP BY gebruiker_id
)
SELECT g.id AS gebruiker_id, g.organisatie_id, g.voornaam, g.achternaam, g.email, g.rol, g.actief,
       (SELECT count(*)::int FROM toegang t WHERE t.gebruiker_id = g.id) AS modules_toegang,
       (SELECT count(*)::int FROM attesten a WHERE a.gebruiker_id = g.id AND a.ingetrokken_op IS NULL AND a.module_id IS NOT NULL) AS modules_af,
       coalesce(lp.lessen_totaal, 0) AS lessen_totaal, coalesce(lp.lessen_af, 0) AS lessen_af,
       CASE WHEN coalesce(lp.lessen_totaal, 0) = 0 THEN NULL ELSE round(100.0 * lp.lessen_af / lp.lessen_totaal) END AS voortgang_pct,
       s.gem_score,
       (SELECT count(*)::int FROM attesten a WHERE a.gebruiker_id = g.id AND a.ingetrokken_op IS NULL) AS attesten,
       (SELECT coalesce(sum(punten), 0)::int FROM punten p WHERE p.gebruiker_id = g.id) AS punten,
       (SELECT min(t.eind_datum) FROM toegang t WHERE t.gebruiker_id = g.id) AS eerste_einde,
       greatest(g.laatst_aangemeld_op,
                (SELECT max(voltooid_op) FROM voortgang v WHERE v.gebruiker_id = g.id),
                (SELECT max(ingediend_op) FROM toetspogingen tp WHERE tp.gebruiker_id = g.id)) AS laatste_activiteit,
       (g.wachtwoord_hash IS NOT NULL) AS account_actief
FROM gebruikers g
LEFT JOIN lessen_per lp ON lp.gebruiker_id = g.id
LEFT JOIN score s ON s.gebruiker_id = g.id
WHERE g.rol IN ('cursist','centrale_verantwoordelijke');
