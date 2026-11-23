-- =====================================================================
-- 014 · Demo: altijd via de mail (link of code), nooit meer meteen
-- =====================================================================
-- Beslist 23 november 2026: de demo opent enkel met de link of de code uit de mail. Lukt de mail niet, dan geen toegang.
-- De code (6 cijfers) werkt 24 uur, maximaal 5 pogingen; de link 30 dagen. Uitgevoerd op 23 november 2026, na migratie 013.

ALTER TABLE demo_bezoekers ADD COLUMN IF NOT EXISTS code_hash text;
ALTER TABLE demo_bezoekers ADD COLUMN IF NOT EXISTS code_pogingen int NOT NULL DEFAULT 0;
