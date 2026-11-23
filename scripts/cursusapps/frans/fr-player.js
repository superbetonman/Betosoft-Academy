const Player = (function () {
  /* Lecture à voix haute. Version française : chaque paragraphe a un enregistrement (voix française fixe).
     Sans enregistrement pour un texte, la voix française du navigateur prend le relais. */
  const synth = window.speechSynthesis;
  const synthOk = !!synth && typeof window.SpeechSynthesisUtterance === "function";
  const ok = true;
  const aud = new Audio();
  aud.preload = "auto";
  const ui = { pp: $("#ppBtn"), title: $("#pTitle"), sub: $("#pSub"), bar: $("#pBar"), set: $("#pSet"), panel: $("#psettings"), voice: $("#voiceSel"), rates: $("#rates"), note: $("#voiceNote"), back: $("#pBack"), fwd: $("#pFwd") };
  let q = [], idx = 0, playing = false, token = 0, voices = [], voice = null, rate = 1, keep = [], pageTitle = "", audIdx = -1;
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem("betoncursus-voix") || "{}") || {}; } catch (e) {}
  rate = prefs.rate || 1;

  const RATES = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
  ui.rates.innerHTML = RATES.map(r => `<button type="button" data-r="${r}" aria-pressed="${r === rate}">${String(r).replace(".", ",")}×</button>`).join("");
  ui.rates.onclick = e => { const b = e.target.closest("button"); if (!b) return; rate = +b.dataset.r; savePrefs(); ui.rates.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.r === rate))); aud.playbackRate = rate; if (playing && !q[idx].audio) speakFrom(idx); };

  function savePrefs() { try { localStorage.setItem("betoncursus-voix", JSON.stringify({ rate, voice: voice ? voice.name : null })); } catch (e) {} }
  function score(v) {
    let s = 0; const l = (v.lang || "").toLowerCase().replace("_", "-"); const n = v.name || "";
    if (l === "fr-be") s += 50; else if (l === "fr-fr") s += 35; else if (l.startsWith("fr")) s += 30;
    if (/natural|online|neural/i.test(n)) s += 25;
    if (/google/i.test(n)) s += 8;
    return s;
  }
  function loadVoices() {
    if (!synthOk) return;
    const all = synth.getVoices() || [];
    voices = all.filter(v => (v.lang || "").toLowerCase().startsWith("fr")).sort((a, b) => score(b) - score(a));
    voice = voices.find(v => v.name === prefs.voice) || voices[0] || null;
    ui.voice.innerHTML = '<option value="-1">Voix de la formation (enregistrée)</option>' + voices.map((v, i) => `<option value="${i}">${v.name.replace(/^Microsoft /, "")} (${v.lang})</option>`).join("");
    ui.voice.value = prefs.voice === "navigateur" && voice ? String(voices.indexOf(voice)) : "-1";
  }
  const VOIX_NAV = () => prefs.voice === "navigateur";
  ui.note.textContent = "Les leçons sont lues par la voix de la formation. Vous pouvez aussi choisir une voix de votre navigateur.";
  if (synthOk) { loadVoices(); try { synth.addEventListener("voiceschanged", loadVoices); } catch (e) { synth.onvoiceschanged = loadVoices; } }
  else ui.voice.innerHTML = '<option value="-1">Voix de la formation (enregistrée)</option>';
  ui.voice.onchange = () => {
    const v = +ui.voice.value;
    if (v < 0) prefs.voice = null; else { voice = voices[v] || voice; prefs.voice = "navigateur"; }
    try { localStorage.setItem("betoncursus-voix", JSON.stringify({ rate, voice: prefs.voice })); } catch (e) {}
    const was = playing; const i = idx; stop(); rebuild(); if (was) speakFrom(Math.min(i, q.length - 1));
  };

  ui.set.onclick = () => { const open = ui.panel.hidden; ui.panel.hidden = !open; ui.set.setAttribute("aria-expanded", String(open)); };
  document.addEventListener("click", e => { if (!ui.panel.hidden && !e.target.closest("#psettings") && !e.target.closest("#pSet")) { ui.panel.hidden = true; ui.set.setAttribute("aria-expanded", "false"); } });

  function setBtn() {
    ui.pp.innerHTML = playing ? I.pause : I.play;
    ui.pp.setAttribute("aria-label", playing ? "Mettre la lecture en pause" : "Lancer la lecture");
    const lb = document.getElementById("listenBtn");
    if (lb) lb.querySelector("span").textContent = playing ? "Mettre en pause" : (idx > 0 && idx < q.length ? "Continuer l'écoute" : "Écouter cette leçon");
  }
  function clearHl() { document.querySelectorAll(".speaking").forEach(e => e.classList.remove("speaking")); }
  function status() {
    const n = q.length; ui.bar.style.width = (n ? Math.min(idx, n) / n * 100 : 0) + "%";
  }
  let lastRoot = null;
  function rebuild() {
    q = []; idx = 0; audIdx = -1;
    if (!lastRoot) return;
    lastRoot.querySelectorAll("[data-say]").forEach(el => {
      const text = el.dataset.sayText || strip(el.innerHTML);
      if (!text) return;
      const step = el.dataset.step ? +el.dataset.step : null;
      const h = voixCle(text);
      if (!VOIX_NAV() && VOIX_FR[h]) { q.push({ el, text, step, para: true, audio: VOIX_BASE + h + ".mp3" }); return; }
      const parts = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [text];
      parts.map(s => s.trim()).filter(Boolean).forEach((s, i) => q.push({ el, text: s, step: i === 0 ? step : null, para: i === 0 }));
    });
  }
  function build(root, title) {
    stop(); lastRoot = root || null; pageTitle = title || "";
    if (!root) { q = []; idx = 0; ui.title.textContent = "Lecture à voix haute"; ui.sub.textContent = "Choisissez une leçon à écouter."; status(); setBtn(); return; }
    rebuild();
    ui.title.textContent = title || "Lecture à voix haute";
    ui.sub.textContent = q.length ? "Cliquez sur lecture pour écouter cette page." : "Cette page n'a pas de texte à lire.";
    status(); setBtn();
  }
  function next(i, my) { if (my !== token) return; idx = i + 1; status(); if (idx >= q.length) finish(); else speakFrom(idx); }
  function speakFrom(i) {
    token++; const my = token;
    try { if (synthOk) synth.cancel(); } catch (e) {}
    if (i >= q.length) { finish(); return; }
    const item = q[i];
    const resume = item.audio && audIdx === i && aud.currentTime > 0 && !aud.ended;
    idx = i; playing = true; setBtn();
    clearHl(); item.el.classList.add("speaking");
    if (item.para && !resume) {
      const r = item.el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top < 70 || r.bottom > vh - 110) item.el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    if (item.step != null && A && !resume) { A.stop(); A.go(item.step); }
    status();
    if (item.audio) {
      if (!resume) { aud.pause(); aud.src = item.audio; audIdx = i; }
      aud.playbackRate = rate;
      aud.onended = () => next(i, my);
      aud.onerror = () => { if (my !== token) return; q[i] = Object.assign({}, item, { audio: null }); if (synthOk) speakFrom(i); else next(i, my); };
      const p = aud.play(); if (p && p.catch) p.catch(() => { if (my === token) { playing = false; setBtn(); } });
      return;
    }
    if (!synthOk) { next(i, my); return; }
    const u = new SpeechSynthesisUtterance(item.text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "fr-BE";
    u.rate = rate;
    u.onend = () => next(i, my);
    u.onerror = ev => { if (my !== token) return; if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return; next(i, my); };
    keep = [u];
    setTimeout(() => { if (my === token) synth.speak(u); }, 60);
  }
  function finish() { playing = false; clearHl(); idx = q.length; status(); ui.sub.textContent = "Terminé. Répondez maintenant à la question de contrôle."; setBtn(); idx = 0; audIdx = -1; }
  function pause() { token++; playing = false; aud.pause(); try { if (synthOk) synth.cancel(); } catch (e) {} setBtn(); }
  function stop() { token++; playing = false; aud.pause(); audIdx = -1; try { if (synthOk) synth.cancel(); } catch (e) {} clearHl(); setBtn(); }
  function toggle() {
    if (!q.length) return;
    if (A) A.stop();
    if (playing) pause(); else speakFrom(idx);
  }
  function jump(dir) {
    if (!q.length) return;
    let i = idx;
    if (dir < 0) { i = Math.max(0, i - 1); while (i > 0 && !q[i].para) i--; if (playing && i === idx && i > 0) { i--; while (i > 0 && !q[i].para) i--; } }
    else { i = Math.min(q.length - 1, i + 1); while (i < q.length - 1 && !q[i].para) i++; }
    audIdx = -1;
    if (playing) speakFrom(i); else { idx = i; clearHl(); q[i].el.classList.add("speaking"); if (q[i].step != null && A) A.go(q[i].step); status(); setBtn(); }
  }
  ui.pp.onclick = toggle;
  ui.back.onclick = () => jump(-1);
  ui.fwd.onclick = () => jump(1);
  setBtn();
  return {
    build, toggle, stop, ok,
    onAnimStep(cap, s) { if (playing && s > 0) ui.sub.textContent = cap; },
    isPlaying: () => playing
  };
})();
