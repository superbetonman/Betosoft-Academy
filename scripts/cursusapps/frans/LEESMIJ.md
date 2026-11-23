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
