-- =====================================================================
-- 010 · Toegang tot het platform: 10 euro per maand per persoon, minimum één jaar
-- =====================================================================
-- Nieuw prijsmodel (beslist 23 november 2026): elke persoon betaalt de toegang tot het platform,
-- 10 euro per maand, altijd voor minimum één jaar (120 euro per jaar, vooraf gefactureerd), stilzwijgend
-- verlengd per jaar tenzij opgezegd vóór het einde. Daarbovenop betaalt hij per cursus die hij volgt
-- (de bestaande cursusprijzen en voorwaarden blijven).
-- Het product heeft geen modules: het geeft op zich geen toegang tot een cursus; het staat op de factuur.
-- De oude abonnementen voor alle cursussen (zonder prijs) gaan uit de verkoop.
-- Uitgevoerd op 23 november 2026.

INSERT INTO producten (code, naam, type, alle_modules, prijs_excl_btw, periode, geldigheid_maanden, actief, beschrijving)
VALUES ('ABO-PLATFORM', 'Toegang tot het platform', 'abonnement', false, 120.00, 'jaar', 12, true,
        'Per persoon. Minimum één jaar; verlengt telkens met een jaar, tenzij je opzegt vóór het einde.')
ON CONFLICT (code) DO UPDATE SET naam = EXCLUDED.naam, prijs_excl_btw = EXCLUDED.prijs_excl_btw, periode = EXCLUDED.periode,
  geldigheid_maanden = EXCLUDED.geldigheid_maanden, actief = true, beschrijving = EXCLUDED.beschrijving;

UPDATE producten SET actief = false WHERE code IN ('ABO-MAAND', 'ABO-JAAR');
