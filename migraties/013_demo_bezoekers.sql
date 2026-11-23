-- =====================================================================
-- 013 · Demo enkel na registratie: naam, e-mail en telefoon
-- =====================================================================
-- Beslist 23 november 2026: wie een demo wil bekijken, vult eerst naam, e-mail en telefoon in. Hij krijgt een persoonlijke
-- link per mail (en per sms als dat in Netlify ingesteld is). De link zet een cookie (90 dagen) voor alle demo's.
-- Zo ziet Betosoft in Beheer → Demo wie welke demo bekeek. Uitgevoerd op 23 november 2026, na migratie 012.

CREATE TABLE IF NOT EXISTS demo_bezoekers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  email citext NOT NULL,
  telefoon text NOT NULL,
  onderneming text,
  cursus text NOT NULL,                       -- demo waarvoor de aanvraag kwam
  taal text NOT NULL DEFAULT 'nl',
  token_hash text NOT NULL UNIQUE,            -- sha256 van de link in de mail
  verstuurd_via text,                          -- mail, mail+sms, direct (mail niet ingesteld of mislukt)
  aangevraagd_op timestamptz NOT NULL DEFAULT now(),
  bevestigd_op timestamptz,                    -- eerste klik op de link
  laatst_bezocht_op timestamptz,
  bezoeken int NOT NULL DEFAULT 0,
  cursussen_bekeken text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS demo_bezoekers_email ON demo_bezoekers (email);
CREATE INDEX IF NOT EXISTS demo_bezoekers_tijd ON demo_bezoekers (aangevraagd_op DESC);
