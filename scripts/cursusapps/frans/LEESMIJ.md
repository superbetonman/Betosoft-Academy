# Franse demo BMC (/fr/demo/BMC/)

De cursusinhoud zelf staat niet in deze publieke repo. Hier staan enkel de scripts.

1. `demo.html` van BMC-BPB uit de databank halen (`src-demo.html`).
2. `build_fr.py` vervangt META, COURSE (enkel de demolessen), de animaties van de demolessen, de speler en de teksten van de
   interface door de Franse versie (`fr-data.js`, `fr-course.js`, `fr-anims.js`: lokaal, niet in de repo) → `demo-fr.html`.
3. Voorleesstem: `verzamel.py` haalt per les de voorleesteksten op (zelfde sleutel als in de speler: FNV-1a van de tekst),
   `tts_tekst.py` maakt er de uitspraaktekst van, één opname per les met google/gemini-3.8-flash-tts (stem Charon, Frans),
   `uitlijn.py` knipt de opname per alinea met faster-whisper (woordtijden) → `public/media/bmc/fr/voix/<sleutel>.mp3`.
   Een alinea zonder opname leest de Franse stem van de browser.
4. `opladen-fr.mjs` zet `demo-fr.html` bij de bron in `cursus_bestanden`. `opladen.mjs` laat `*-fr.html` staan.

Wijzigt een tekst in de demo, dan verandert de sleutel: maak die alinea opnieuw op (stap 3), anders valt ze terug op de browserstem.

## Beeld en filmpjes (BMC-demo, stijl 01)
- Stilstaande beelden: `public/media/bmc/beeld/` (0.2-F1 groepsfoto, 1.1-F1 zoekplaat). Gedeeld door NL en FR.
- Filmpjes per taal: `public/media/bmc/nl/` en `public/media/bmc/fr/` (0.1-V1, 0.3-A1, 3.1-V1, M3.1-V1), elk met ingesproken stem.
- Gemonteerd met `maak_films.py` (clips + stem) en `maak_a03.py` (acht stilstaande beelden met zoom, getimed op de zinnen van de stem).
- `media.json` (werkmap) geeft per media-id het pad per taal en de oplossing van de zoekplaat; `build_fr.py` vult dat in de Franse demo in.
- In de NL-bestanden van BMC-BPB in de databank (demo.html, index.html, beheer.html) staat `src` bij dezelfde zes blokken. Wie die bestanden opnieuw oplaadt vanuit een oudere bron, moet die `src`-velden en de nieuwe oplossing van de zoekplaat meenemen.
