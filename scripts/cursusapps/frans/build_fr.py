#!/usr/bin/env python3
"""Bouwt demo-fr.html (Franse demo BMC) uit src-demo.html (NL demo van BMC-BPB)."""
import json, re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
s = open(f"{D}/src-demo.html", encoding="utf-8").read()
rd = lambda n: open(f"{D}/{n}", encoding="utf-8").read()

def cut(s, a, b, new, label):
    i = s.index(a); j = s.index(b, i)
    return s[:i] + new + s[j:]

# 1. META, GB/TM/TP, MODS, CAST, ANIMS (start)
s = cut(s, "const META = {", "const FICHES = {};", rd("fr-data.js") + "\n", "meta")
# 2. COURSE
i = s.index("const COURSE = [")
j = s.index("\ntry { if (typeof window.ACADEMIE_FILTER", i)
s = s[:i] + rd("fr-course.js").rstrip() + s[j:]
# 3. alle animaties en fiches van andere lessen weg, enkel de demo-animaties in het Frans
i = s.index("Object.assign(ANIMS, {", s.index("window.ACADEMIE_FILTER(COURSE"))
k = s.index("\nconst REG = ", i)
s = s[:i] + rd("fr-anims.js") + "\n" + s[k:]
# 4. speler
i = s.index("const Player = (function () {")
k = s.index("})();", i) + len("})();")
voix = json.load(open(f"{D}/voix-fr.json")) if os.path.exists(f"{D}/voix-fr.json") else {}
VOIX = ("function voixCle(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, \"0\"); }\n"
        f"const VOIX_BASE = \"/media/bmc/fr/voix/\";\nconst VOIX_FR = {json.dumps({h: 1 for h in voix}, separators=(',', ':'))};\n")
s = s[:i] + VOIX + rd("fr-player.js").rstrip() + s[k:]

# 5. media
media = json.load(open(f"{D}/media.json")) if os.path.exists(f"{D}/media.json") else {}
def msrc(m):
    key = m.group(1)
    p = media.get(key, {}).get("fr")
    return f'"{p}"' if p else '""'
s = re.sub(r'"@@([0-9A-Z.\-]+)@@"', msrc, s)
sol = media.get("1.1-F1", {}).get("solution_fr") or "1. Un ouvrier se tient entre le camion malaxeur et la trémie de la pompe. 2. Un stabilisateur est posé sur un sol mou sans plaque. 3. Une tranchée se trouve à 1 mètre de la roue arrière. 4. L'homme au flexible ne porte pas de lunettes. 5. Un enfant se tient derrière la clôture du chantier, tout près du camion. 6. Une ligne à haute tension passe au-dessus de la rue, à portée de la flèche. 7. Sam ne porte pas de casque. 8. La goulotte repliable du camion malaxeur n'a pas de cliquet de sécurité."
s = s.replace('"@@SOLUTION_1.1-F1@@"', json.dumps(sol, ensure_ascii=False))

# 6. interface
R = [
 ('<html><head>', '<html lang="fr-BE"><head>'),
 ('<title>Cursus mixerchauffeur en pompist</title>', '<title>Formation chauffeur de camion malaxeur</title>'),
 ('aria-label="Inhoud openen"', 'aria-label="Ouvrir la table des matières"'),
 ('aria-label="Betosoft · Cursus betonmixerchauffeur en betonpompbediende"', 'aria-label="Betosoft · Formation chauffeur de camion malaxeur et opérateur de pompe à béton"'),
 ('<b>Betonmixerchauffeur en betonpompbediende</b>', '<b>Chauffeur de camion malaxeur et opérateur de pompe</b>'),
 ('aria-label="Voortgang"', 'aria-label="Progression"'),
 ('<span class="txt" id="topTxt">0 van 0</span>', '<span class="txt" id="topTxt">0 sur 0</span>'),
 ('aria-label="Cursusinhoud">\n    <h2>Cursusinhoud</h2>', 'aria-label="Contenu de la formation">\n    <h2>Contenu de la formation</h2>'),
 ('<span>Voortgang wordt in deze browser bewaard</span>', '<span>Progression enregistrée dans ce navigateur</span>'),
 ('<a href="#afdruk">Afdrukversie</a>', '<a href="#afdruk">Version imprimable</a>'),
 ('<label for="voiceSel">Stem', '<label for="voiceSel">Voix'),
 ('margin-bottom:6px">Snelheid</span>', 'margin-bottom:6px">Vitesse</span>'),
 ('De beste Vlaamse stemmen vind je in Microsoft Edge (bv. Arnaud of Dena, "Natural").', 'Les leçons sont lues par la voix de la formation.'),
 ('aria-label="Voorlezen starten"></button>', 'aria-label="Lancer la lecture"></button>'),
 ('<b id="pTitle">Voorlezen</b>', '<b id="pTitle">Lecture à voix haute</b>'),
 ('<span id="pSub">Klik op afspelen om deze pagina te beluisteren.</span>', '<span id="pSub">Cliquez sur lecture pour écouter cette page.</span>'),
 ('aria-label="Vorige alinea"', 'aria-label="Paragraphe précédent"'),
 ('aria-label="Volgende alinea"', 'aria-label="Paragraphe suivant"'),
 ('aria-label="Stem en snelheid"', 'aria-label="Voix et vitesse"'),
 ('"Voortgang wordt in je account bewaard" : "Voortgang wordt in deze browser bewaard"', '"Progression enregistrée dans votre compte" : "Progression enregistrée dans ce navigateur"'),
 ('${m.demo ? "in de volledige cursus" : "in voorbereiding"}', '${m.demo ? "dans la formation complète" : "en préparation"}'),
 ('${st.done} van ${st.total} voltooid</span>', '${st.done} sur ${st.total} terminé(s)</span>'),
 ('t.done + " van " + t.total + " onderdelen"', 't.done + " sur " + t.total + " parties"'),
 ('aria-label="Vorige stap"', 'aria-label="Étape précédente"'),
 ('aria-label="Volgende stap"', 'aria-label="Étape suivante"'),
 ('setAttribute("aria-label", "Animatie pauzeren")', 'setAttribute("aria-label", "Mettre l\'animation en pause")'),
 ('setAttribute("aria-label", "Animatie afspelen")', 'setAttribute("aria-label", "Lancer l\'animation")'),
 ('b.sum || "Verdieping · niet nodig voor de basis"', 'b.sum || "Approfondissement · pas nécessaire pour la base"'),
 ('b.okT || "Wel"', 'b.okT || "Oui"'),
 ('b.noT || "Niet"', 'b.noT || "Non"'),
 ('<span class="c-t">Fiche om op te hangen</span><b>', '<span class="c-t">Fiche à afficher</span><b>'),
 ('Bekijk en druk af (A4)</a>', 'Voir et imprimer (A4)</a>'),
 ('<h2 data-say>Kernbegrippen</h2>', '<h2 data-say>Notions clés</h2>'),
 ('const KIND = { foto: ["Foto", "foto"], video: ["Filmpje", "video"], anim: ["AI-animatie", "anim"] };', 'const KIND = { foto: ["Photo", "foto"], video: ["Film", "video"], anim: ["Animation", "anim"] };'),
 ('btn.textContent = ok ? "Gekopieerd" : "Selecteer de tekst hieronder"', 'btn.textContent = ok ? "Copié" : "Sélectionnez le texte ci-dessous"'),
 ('[["Start", m => m.id === "m0"], [GB + " · voor iedereen"', '[["Départ", m => m.id === "m0"], [GB + " · pour tous"'),
 ('${m.demo ? "Volledige cursus" : "In voorbereiding"}', '${m.demo ? "Formation complète" : "En préparation"}'),
 ('${all ? "Voltooid" : s.done ? "Bezig" : "Beschikbaar"}', '${all ? "Terminé" : s.done ? "En cours" : "Disponible"}'),
 ('s.total + " van " + m.demoVan + " onderdelen in de demo" : s.total + " " + (s.total === 1 ? "onderdeel" : "onderdelen")', 's.total + " sur " + m.demoVan + " parties dans la démo" : s.total + " " + (s.total === 1 ? "partie" : "parties")'),
 ('${s.done} van ${s.total} voltooid</span></div></a>', '${s.done} sur ${s.total} terminé(s)</span></div></a>'),
 ('started ? "Ga verder: " + nxt.code + " " + nxt.title : "Start de cursus"', 'started ? "Continuer : " + nxt.code + " " + nxt.title : "Commencer la formation"'),
 ('>Direct naar module 1</a>', '>Aller au module 1</a>'),
 ('${I.print}Afdrukversie</a>', '${I.print}Version imprimable</a>'),
 ('<h2 class="sec-h">Zo werkt het</h2>', '<h2 class="sec-h">Comment ça marche</h2>'),
 ('<div><b>Beluister</b><p>Klik op afspelen in de speler onderaan. De tekst licht op terwijl hij wordt voorgelezen. Kies stem en snelheid via het instellingenicoon.</p></div>',
  '<div><b>Écoutez</b><p>Cliquez sur lecture dans le lecteur en bas. Le texte s\'allume pendant la lecture. Choisissez la voix et la vitesse avec l\'icône des réglages.</p></div>'),
 ('<div><b>Kijk</b><p>De animatie volgt het voorlezen stap per stap. Je kan ook zelf door de stappen klikken.</p></div>',
  '<div><b>Regardez</b><p>L\'animation suit la lecture étape par étape. Vous pouvez aussi cliquer vous-même d\'étape en étape.</p></div>'),
 ('<div><b>Doe</b><p>Elke les eindigt met een controlevraag. Elke module eindigt met een praktijkopdracht in je eigen bedrijf en een toets.</p></div>',
  '<div><b>Faites</b><p>Chaque leçon se termine par une question de contrôle. Chaque module se termine par un exercice pratique dans votre entreprise et un test.</p></div>'),
 ('<div><b>Bewaar</b><p>Je voortgang wordt bewaard in je account. Zo ga je verder op een ander toestel.</p></div>',
  '<div><b>Enregistrez</b><p>Votre progression est enregistrée dans votre compte. Vous continuez ainsi sur un autre appareil.</p></div>'),
 ('<div><b>Druk af</b><p>Elke module bestaat ook als gedrukt handboek op A4. Fiches om op te hangen druk je apart af.</p></div>',
  '<div><b>Imprimez</b><p>Chaque module existe aussi en manuel imprimé au format A4. Les fiches à afficher s\'impriment à part.</p></div>'),
 ('I.check + "Voltooid" : I.check + (l.kind === "toets" ? "Slaag voor de toets om af te ronden" : l.kind === "opdracht" ? "Opdracht voltooid" : "Les voltooid")',
  'I.check + "Terminé" : I.check + (l.kind === "toets" ? "Réussissez le test pour terminer" : l.kind === "opdracht" ? "Exercice terminé" : "Leçon terminée")'),
 ('const kindLbl = l.kind === "opdracht" ? "Praktijkopdracht" : l.kind === "toets" ? "Toets" : "Les " + l.code;', 'const kindLbl = l.kind === "opdracht" ? "Exercice pratique" : l.kind === "toets" ? "Test" : "Leçon " + l.code;'),
 ('"ca. " + (l.hours || 10) + " uur werk" : "ca. " + l.min + " min"', '"env. " + (l.hours || 10) + " heures de travail" : "env. " + l.min + " min"'),
 ('<h2 data-say>Wat je oplevert</h2>', '<h2 data-say>Ce que vous remettez</h2>'),
 ('<span class="c-t">Controlevraag</span>', '<span class="c-t">Question de contrôle</span>'),
 ('<span>Module ${l.mod.n} · ${l.mod.title}</span><span>${kindLbl}</span>', '<span>Module ${l.mod.n} · ${l.mod.title}</span><span>${kindLbl}</span>'),
 ('"<span>Met animatie</span>"', '"<span>Avec animation</span>"'),
 ('${I.speaker}<span>Beluister deze les</span></button>', '${I.speaker}<span>Écouter cette leçon</span></button>'),
 ('${I.prev}<span>Vorige</span>', '${I.prev}<span>Précédente</span>'),
 ('href="#start">${I.prev}Overzicht</a>', 'href="#start">${I.prev}Aperçu</a>'),
 ('<span>Volgende</span>${I.next}', '<span>Suivante</span>${I.next}'),
 ('href="#start">Overzicht${I.next}</a>', 'href="#start">Aperçu${I.next}</a>'),
 ('<b>${right ? "Juist." : "Niet juist."}</b> ${l.check.why} <button class="btn" type="button" id="retry" style="margin-top:10px">Opnieuw</button>',
  '<b>${right ? "Exact." : "Pas tout à fait."}</b> ${l.check.why} <button class="btn" type="button" id="retry" style="margin-top:10px">Réessayer</button>'),
 ('<span>Je beste score tot nu toe.${best.best >= need(l) ? " Je bent geslaagd." : " Je hebt " + need(l) + " juiste antwoorden nodig."}</span>',
  '<span>Votre meilleur score jusqu\'ici.${best.best >= need(l) ? " Vous avez réussi." : " Il vous faut " + need(l) + " bonnes réponses."}</span>'),
 ('<span class="n">Vraag ${i + 1} van ${l.quiz.length}</span>', '<span class="n">Question ${i + 1} sur ${l.quiz.length}</span>'),
 ('id="qCheck">Controleer mijn antwoorden</button>', 'id="qCheck">Vérifier mes réponses</button>'),
 ('<b>${ok ? "Juist." : "Niet juist."}</b> ${x.why}', '<b>${ok ? "Exact." : "Pas tout à fait."}</b> ${x.why}'),
 ('"Geslaagd. Module " + l.mod.n + " is afgerond zodra ook de praktijkopdracht klaar is." : "Nog niet geslaagd. Herlees de lessen bij de foute antwoorden en probeer opnieuw."',
  '"Réussi. Le module " + l.mod.n + " est terminé dès que l\'exercice pratique est fait aussi." : "Pas encore réussi. Relisez les leçons liées aux mauvaises réponses et réessayez."'),
 ('"Bekijk online: " + esc(b.src) : "Online te bekijken in de cursus. QR-code volgt."', '"À voir en ligne : " + esc(b.src) : "À voir en ligne dans la formation. Code QR à venir."'),
 ('`<div class="callout"><span class="c-t">${b.sum || "Verdieping"}</span>', '`<div class="callout"><span class="c-t">${b.sum || "Approfondissement"}</span>'),
 ('<span class="c-t">Fiche om op te hangen</span><p><b>${f.title}</b>. Druk de fiche apart af op A4 of A3.</p>', '<span class="c-t">Fiche à afficher</span><p><b>${f.title}</b>. Imprimez la fiche à part en A4 ou A3.</p>'),
 ('l.kind === "opdracht" ? "Praktijkopdracht" : l.kind === "toets" ? "Toets" : "Les " + l.code}</div>', 'l.kind === "opdracht" ? "Exercice pratique" : l.kind === "toets" ? "Test" : "Leçon " + l.code}</div>'),
 ('<h3>Wat je oplevert</h3>', '<h3>Ce que vous remettez</h3>'),
 ('<label class="pv-sel">Inhoud <select id="pvSel"><option value="">Hele cursus (beschikbare modules)</option>', '<label class="pv-sel">Contenu <select id="pvSel"><option value="">Toute la formation (modules disponibles)</option>'),
 ('Kies in het afdrukvenster A4, staand, en vink "Achtergrondafbeeldingen" aan. Filmpjes verschijnen als kader met QR-plaats.', 'Dans la fenêtre d\'impression, choisissez A4, portrait, et cochez « Graphiques d\'arrière-plan ». Les films apparaissent comme un cadre avec une place pour le code QR.'),
 ('<h2 class="pv-h">Inhoud</h2>', '<h2 class="pv-h">Sommaire</h2>'),
 ('${m.avail ? "" : " · in voorbereiding"}', '${m.avail ? "" : " · en préparation"}'),
 ('<h2 class="pv-h">Antwoorden module ${m.n}</h2><table><thead><tr><th>Vraag</th><th>Antwoord</th><th>Uitleg</th></tr></thead>', '<h2 class="pv-h">Réponses module ${m.n}</h2><table><thead><tr><th>Question</th><th>Réponse</th><th>Explication</th></tr></thead>'),
 ('${I.prev}Terug naar de les</a>', '${I.prev}Retour à la leçon</a>'),
 ('${I.print}Afdrukken (A4 of A3)</button>', '${I.print}Imprimer (A4 ou A3)</button>'),
]
R += [
 ('aria-label="Animatie opnieuw"', "aria-label=\"Recommencer l'animation\""),
 ('id="aPlay" type="button" aria-label="Animatie afspelen"', "id=\"aPlay\" type=\"button\" aria-label=\"Lancer l'animation\""),
 ('"Beantwoord eerst alle vragen. Nog " + open + " open."', '"Répondez d\'abord à toutes les questions. Encore " + open + " sans réponse."'),
 ('$("#qCheck").textContent = "Toets opnieuw afleggen"', '$("#qCheck").textContent = "Refaire le test"'),
]
miss = []
for a, b in R:
    n = s.count(a)
    if n == 0: miss.append(a[:90]); continue
    s = s.replace(a, b)
open(f"{D}/demo-fr.html", "w", encoding="utf-8").write(s)
print("ontbrekend:", len(miss)); [print("  -", m) for m in miss]
