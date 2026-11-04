import { db } from "./db.mts"

/**
 * Leerlijn, punten, badges en attesten.
 *
 * Bronnen:
 *  - cursus_gegevens: het voortgangsdocument dat de cursusapp zelf bewaart (pad data/users/<id>/progress):
 *      { done: { <les-id>: tijdstip }, quiz: { <les-id>: { best, total, at } }, tasks: {...}, updatedAt }
 *    Een toets telt als "done" zodra ze geslaagd is (zo werkt de app).
 *  - cursus_structuur: de modules en lessen zoals de app ze toont (doorgegeven door cursus-academie.js).
 * Zonder structuur kennen we enkel het aantal afgeronde lessen, niet het totaal.
 *
 * Bron en afgeleide cursussen (migratie 007): BMC en BPB gebruiken de app en de voortgang van de bron BMC-BPB.
 * De bron zelf staat niet in de leerlijn. De gemeenschappelijke modules (start en basis) tellen in elke cursus mee voor
 * de voortgang, maar voor punten, lessen, toetsen en badges maar één keer (CursusStand.gedeeld).
 */

export type Soort = "les" | "toets" | "opdracht"
export type Les = { id: string; code: string; titel: string; soort: Soort; vragen: number; min: number | null }
export type Module = { id: string; n: string; titel: string; sub: string; avail: boolean; lessen: Les[] }
export type Structuur = { v: 1; soort: string; modules: Module[] }
export type StructuurRij = { structuur: Structuur; bevestigd: boolean; bijgewerkt_op: string | null }
export type Voortgang = {
  done?: Record<string, unknown>
  quiz?: Record<string, { best?: number; total?: number; at?: number } | null>
  updatedAt?: number
}

export const PUNTEN = { les: 10, opdracht: 15, toets: 20, foutloos: 10, module: 25, cursus: 100, badge: 20 } as const

export const NIVEAUS = [
  { naam: "Starter", min: 0 },
  { naam: "Leerling", min: 100 },
  { naam: "Gevorderde", min: 300 },
  { naam: "Vakkracht", min: 750 },
  { naam: "Expert", min: 1500 },
  { naam: "Meester", min: 3000 },
]

type Totaal = {
  lessen_af: number
  toetsen_geslaagd: number
  foutloos: number
  modules_af: number
  cursussen_af: number
  leerdagen: number
  langste_reeks: number
}
export const BADGES: { code: string; naam: string; uitleg: string; test: (t: Totaal) => boolean }[] = [
  { code: "eerste_stap", naam: "Eerste stap", uitleg: "Je eerste les afgerond", test: (t) => t.lessen_af >= 1 },
  { code: "op_dreef", naam: "Op dreef", uitleg: "10 lessen afgerond", test: (t) => t.lessen_af >= 10 },
  { code: "leergierig", naam: "Leergierig", uitleg: "50 lessen afgerond", test: (t) => t.lessen_af >= 50 },
  { code: "geslaagd", naam: "Geslaagd", uitleg: "Je eerste toets geslaagd", test: (t) => t.toetsen_geslaagd >= 1 },
  { code: "foutloos", naam: "Foutloos", uitleg: "Een toets zonder één fout", test: (t) => t.foutloos >= 1 },
  { code: "module_af", naam: "Module af", uitleg: "Een volledige module afgerond", test: (t) => t.modules_af >= 1 },
  { code: "vijf_modules", naam: "Vijf modules", uitleg: "Vijf modules afgerond", test: (t) => t.modules_af >= 5 },
  { code: "cursus_af", naam: "Cursus af", uitleg: "Een volledige cursus afgerond", test: (t) => t.cursussen_af >= 1 },
  { code: "veelzijdig", naam: "Veelzijdig", uitleg: "Twee cursussen afgerond", test: (t) => t.cursussen_af >= 2 },
  { code: "reeks", naam: "Reeks van 3", uitleg: "Drie dagen na elkaar geleerd", test: (t) => t.langste_reeks >= 3 },
  { code: "volhouder", naam: "Volhouder", uitleg: "Op 7 verschillende dagen geleerd", test: (t) => t.leerdagen >= 7 },
]

// ---------- Structuur controleren (komt uit de browser) ----------
const S = (v: unknown, max = 200) => (v === null || v === undefined ? "" : String(v).slice(0, max))
const ID = /^[A-Za-z0-9_.\-]{1,60}$/

export function valideerStructuur(x: any): Structuur | null {
  if (!x || typeof x !== "object" || !Array.isArray(x.modules)) return null
  if (x.modules.length < 1 || x.modules.length > 80) return null
  const gezien = new Set<string>()
  const modules: Module[] = []
  for (const m of x.modules) {
    if (!m || typeof m !== "object" || !ID.test(S(m.id, 60)) || !Array.isArray(m.lessen) || m.lessen.length > 120) return null
    const lessen: Les[] = []
    for (const l of m.lessen) {
      const id = S(l?.id, 60)
      if (!ID.test(id) || gezien.has(id)) return null
      gezien.add(id)
      const soort: Soort = l.soort === "toets" || l.soort === "opdracht" ? l.soort : "les"
      const vragen = Number.isInteger(l.vragen) && l.vragen >= 0 && l.vragen < 500 ? l.vragen : 0
      const min = typeof l.min === "number" && l.min >= 0 && l.min < 1000 ? l.min : null
      lessen.push({ id, code: S(l.code, 20), titel: S(l.titel), soort, vragen, min })
    }
    modules.push({ id: S(m.id, 60), n: S(m.n, 10), titel: S(m.titel), sub: S(m.sub), avail: m.avail === true, lessen })
  }
  if (!modules.some((m) => m.avail && m.lessen.length)) return null
  return { v: 1, soort: S(x.soort, 20) || "app", modules }
}

/** Lessen in beschikbare modules (wat een cursist kan afwerken). */
export const beschikbaar = (s: Structuur) => s.modules.filter((m) => m.avail && m.lessen.length)
export const telLessen = (s: Structuur) => beschikbaar(s).reduce((t, m) => t + m.lessen.length, 0)
export const telToetsen = (s: Structuur) => beschikbaar(s).reduce((t, m) => t + m.lessen.filter((l) => l.soort === "toets").length, 0)

// ---------- Stand per cursus ----------
export type ModuleStand = {
  id: string
  n: string
  titel: string
  lessen: number
  af: number
  toets: { best: number; total: number; pct: number } | null
  status: "nog" | "bezig" | "af"
  geslaagd: number
  foutloos: number
  /** punten van deze module (lessen, toetsen, foutloos en module af) */
  punten: number
}
/** Wat al meetelt in een andere cursus met dezelfde bron: wordt in het totaal niet nog eens geteld. */
export type Gedeeld = { af: number; geslaagd: number; foutloos: number; modules_af: number; punten: number }
export type CursusStand = {
  code: string
  titel: string
  structuur: boolean
  bevestigd: boolean
  lessen: number | null
  af: number
  pct: number | null
  toetsen: number | null
  geslaagd: number
  gem_score: number | null
  foutloos: number
  modules: ModuleStand[]
  modules_af: number
  modules_totaal: number | null
  volgende: { id: string; titel: string; module: string } | null
  gestart_op: string | null
  laatst: string | null
  afgerond: boolean
  afgerond_op: string | null
  punten: number
  dagen: string[]
  gedeeld?: Gedeeld | null
}

const datumFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" })
const tijd = (v: unknown): number | null => (typeof v === "number" && v > 1_500_000_000_000 && v < 4_000_000_000_000 ? v : null)
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString())

export function stand(code: string, titel: string, rij: StructuurRij | null, P: Voortgang | null): CursusStand {
  const done = (P && typeof P.done === "object" && P.done) || {}
  const quiz = (P && typeof P.quiz === "object" && P.quiz) || {}
  const isDone = (id: string) => !!done[id]
  const tijden: number[] = []
  for (const v of Object.values(done)) { const t = tijd(v); if (t) tijden.push(t) }
  for (const q of Object.values(quiz)) { const t = tijd(q?.at); if (t) tijden.push(t) }
  const dagen = [...new Set(tijden.map((t) => datumFmt.format(new Date(t))))].sort()
  const gestart = tijden.length ? Math.min(...tijden) : null
  const laatst = Math.max(tijden.length ? Math.max(...tijden) : 0, tijd(P?.updatedAt) ?? 0) || null
  const perfect = (q: any) => q && Number(q.total) > 0 && Number(q.best) >= Number(q.total)
  const pctVan = (q: any) => (q && Number(q.total) > 0 ? Math.round((100 * Number(q.best || 0)) / Number(q.total)) : null)

  if (!rij) {
    // geen structuur: enkel wat in de voortgang staat
    const af = Object.keys(done).filter(isDone).length
    const scores = Object.values(quiz).map(pctVan).filter((x): x is number => x !== null)
    const foutloos = Object.values(quiz).filter(perfect).length
    return {
      code, titel, structuur: false, bevestigd: false, lessen: null, af, pct: null, toetsen: null,
      geslaagd: 0, gem_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, foutloos,
      modules: [], modules_af: 0, modules_totaal: null, volgende: null,
      gestart_op: iso(gestart), laatst: iso(laatst), afgerond: false, afgerond_op: null,
      punten: af * PUNTEN.les + foutloos * PUNTEN.foutloos, dagen,
    }
  }

  const mods = beschikbaar(rij.structuur)
  let lessen = 0, af = 0, toetsen = 0, geslaagd = 0, foutloos = 0, punten = 0, modulesAf = 0, modulesTeller = 0
  let volgende: CursusStand["volgende"] = null
  let afgerondOp = 0
  const scores: number[] = []
  const modules: ModuleStand[] = mods.map((m) => {
    let mAf = 0, mGeslaagd = 0, mFoutloos = 0
    const puntenVoor = punten
    let toets: ModuleStand["toets"] = null
    for (const l of m.lessen) {
      lessen++
      const d = isDone(l.id)
      if (d) {
        mAf++
        af++
        punten += PUNTEN[l.soort]
        afgerondOp = Math.max(afgerondOp, tijd(done[l.id]) ?? 0)
      } else if (!volgende) volgende = { id: l.id, titel: l.titel, module: m.n ? `${m.n} · ${m.titel}` : m.titel }
      if (l.soort === "toets") {
        toetsen++
        if (d) { geslaagd++; mGeslaagd++ }
        const q = quiz[l.id]
        const p = pctVan(q)
        if (p !== null) {
          scores.push(p)
          if (!toets || p > toets.pct) toets = { best: Number(q!.best || 0), total: Number(q!.total), pct: p }
        }
        if (perfect(q)) { foutloos++; mFoutloos++; punten += PUNTEN.foutloos }
      }
    }
    const status = mAf === 0 ? "nog" : mAf === m.lessen.length ? "af" : "bezig"
    // de startmodule (n = 0) telt niet als module
    if (m.n !== "0") {
      modulesTeller++
      if (status === "af") { modulesAf++; punten += PUNTEN.module }
    }
    return { id: m.id, n: m.n, titel: m.titel, lessen: m.lessen.length, af: mAf, toets, status, geslaagd: mGeslaagd, foutloos: mFoutloos, punten: punten - puntenVoor }
  })
  const afgerond = lessen > 0 && af === lessen
  if (afgerond) punten += PUNTEN.cursus
  return {
    code, titel, structuur: true, bevestigd: rij.bevestigd, lessen, af,
    pct: lessen ? Math.round((100 * af) / lessen) : null,
    toetsen, geslaagd, gem_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    foutloos, modules, modules_af: modulesAf, modules_totaal: modulesTeller, volgende,
    gestart_op: iso(gestart), laatst: iso(laatst), afgerond, afgerond_op: afgerond ? iso(afgerondOp || laatst) : null, punten, dagen,
  }
}

// ---------- Totaal per deelnemer: punten, badges, niveau ----------
function reeksen(dagen: string[]) {
  const ms = [...new Set(dagen)].sort().map((d) => Date.parse(d + "T12:00:00Z"))
  let langste = 0, huidig = 0
  for (let i = 0; i < ms.length; i++) {
    huidig = i > 0 && ms[i] - ms[i - 1] === 86_400_000 ? huidig + 1 : 1
    langste = Math.max(langste, huidig)
  }
  return langste
}

export function niveau(punten: number) {
  let i = 0
  while (i + 1 < NIVEAUS.length && punten >= NIVEAUS[i + 1].min) i++
  const nu = NIVEAUS[i], volgende = NIVEAUS[i + 1] ?? null
  return {
    nr: i + 1,
    naam: nu.naam,
    min: nu.min,
    volgende: volgende ? volgende.naam : null,
    volgende_min: volgende ? volgende.min : null,
    pct: volgende ? Math.round((100 * (punten - nu.min)) / (volgende.min - nu.min)) : 100,
  }
}

export function totaal(standen: CursusStand[]) {
  const dagen = standen.flatMap((s) => s.dagen)
  // gemeenschappelijke modules (bron) maar één keer: wat al in een andere cursus telde, gaat eraf
  const zonder = (s: CursusStand, k: keyof Gedeeld) => s[k] - (s.gedeeld?.[k] ?? 0)
  const t: Totaal = {
    lessen_af: standen.reduce((a, s) => a + zonder(s, "af"), 0),
    toetsen_geslaagd: standen.reduce((a, s) => a + zonder(s, "geslaagd"), 0),
    foutloos: standen.reduce((a, s) => a + zonder(s, "foutloos"), 0),
    modules_af: standen.reduce((a, s) => a + zonder(s, "modules_af"), 0),
    cursussen_af: standen.filter((s) => s.afgerond).length,
    leerdagen: new Set(dagen).size,
    langste_reeks: reeksen(dagen),
  }
  const badges = BADGES.map((b) => ({ code: b.code, naam: b.naam, uitleg: b.uitleg, behaald: b.test(t) }))
  const aantalBadges = badges.filter((b) => b.behaald).length
  const punten = standen.reduce((a, s) => a + zonder(s, "punten"), 0) + aantalBadges * PUNTEN.badge
  const scores = standen.map((s) => s.gem_score).filter((x): x is number => x !== null)
  const laatst = standen.map((s) => s.laatst).filter(Boolean).sort().pop() ?? null
  return {
    ...t,
    punten,
    badges,
    aantal_badges: aantalBadges,
    niveau: niveau(punten),
    gem_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    laatst,
  }
}

// ---------- Gegevens laden ----------
export type Deelnemer = {
  id: string
  voornaam: string | null
  achternaam: string | null
  email: string
  rol: string
  actief: boolean
  organisatie_id: string | null
  locatie: string | null
  bedrijf_id: string | null
  bedrijf: string | null
}
/** met_eigen: modules met toegang die niet ook in een andere cursus van dezelfde bron zitten (bij BMC: M1–M4). */
export type Toegang = { met: number; met_eigen: number; modules: number; eind: string | null }
export type AttestRij = {
  id: string
  nummer: string
  gebruiker_id: string
  cursus: string
  uitgereikt_op: string
  ingetrokken_op: string | null
  gemaild_op: string | null
  score: number | null
}
/** startpagina: 'niet_tonen' | 'voorbereiding' | 'inschrijven' (Beheer → Cursussen); gepubliceerd = online = 'inschrijven'. */
/** bron: code van de bron (app en voortgang) of null; is_bron: andere cursussen gebruiken deze cursus als bron. */
export type CursusRij = {
  id: string; code: string; titel: string; gepubliceerd: boolean; startpagina: string; volgorde: number; app: boolean; demo: boolean
  bron: string | null; app_modules: string[] | null; is_bron: boolean
}

export async function laadCursussen(): Promise<CursusRij[]> {
  return (await db()`
    SELECT c.id, c.code, c.titel, c.gepubliceerd, c.startpagina, c.volgorde, c.bron, c.app_modules, is_bron(c.code) AS is_bron,
           EXISTS (SELECT 1 FROM cursus_bestanden b WHERE b.cursus = coalesce(c.bron, c.code) AND b.pad = 'index.html') AS app,
           EXISTS (SELECT 1 FROM cursus_bestanden b WHERE b.cursus = coalesce(c.bron, c.code) AND b.pad = 'demo.html') AS demo
    FROM cursussen c ORDER BY c.volgorde, c.code`) as CursusRij[]
}

/** Gegevens (voortgang) van een cursus: bij de bron als ze afgeleid is. */
export const gegevensCode = (c: { code: string; bron: string | null }) => c.bron ?? c.code

export async function laadStructuren(): Promise<Map<string, StructuurRij>> {
  const rijen = await db()`SELECT cursus, structuur, bevestigd, bijgewerkt_op FROM cursus_structuur`
  return new Map(rijen.map((r: any) => [r.cursus, { structuur: r.structuur, bevestigd: r.bevestigd, bijgewerkt_op: r.bijgewerkt_op }]))
}

/** Deelnemers op id of per organisatie (null = alle cursisten en centraleverantwoordelijken). */
export async function laadDeelnemers(f: { ids?: string[]; orgs?: string[]; enkelActief?: boolean }): Promise<Deelnemer[]> {
  const ids = f.ids ?? null
  const orgs = f.orgs ?? null
  return (await db()`
    SELECT g.id, g.voornaam, g.achternaam, g.email::text AS email, g.rol::text AS rol, g.actief, g.organisatie_id,
           o.naam AS locatie, h.id AS bedrijf_id, h.naam AS bedrijf
    FROM gebruikers g
    LEFT JOIN organisaties o ON o.id = g.organisatie_id
    LEFT JOIN organisaties h ON h.id = coalesce(o.ouder_id, o.id)
    WHERE (${ids}::uuid[] IS NOT NULL AND g.id = ANY(${ids}::uuid[]))
       OR (${ids}::uuid[] IS NULL AND g.rol IN ('cursist', 'centrale_verantwoordelijke')
           AND (${orgs}::uuid[] IS NULL OR g.organisatie_id = ANY(${orgs}::uuid[]))
           AND (${!f.enkelActief} OR g.actief))
    ORDER BY g.achternaam NULLS LAST, g.voornaam`) as Deelnemer[]
}

export async function laadVoortgang(ids: string[]): Promise<Map<string, Map<string, Voortgang>>> {
  const uit = new Map<string, Map<string, Voortgang>>()
  if (!ids.length) return uit
  const rijen = await db()`
    SELECT gebruiker_id, cursus, data FROM cursus_gegevens
    WHERE gebruiker_id = ANY(${ids}::uuid[]) AND pad = 'data/users/' || gebruiker_id::text || '/progress'`
  for (const r of rijen as any[]) {
    if (!uit.has(r.gebruiker_id)) uit.set(r.gebruiker_id, new Map())
    uit.get(r.gebruiker_id)!.set(r.cursus, r.data)
  }
  return uit
}

export async function laadToegang(ids: string[]): Promise<Map<string, Map<string, Toegang>>> {
  const uit = new Map<string, Map<string, Toegang>>()
  if (!ids.length) return uit
  const rijen = await db()`
    SELECT mt.gebruiker_id, c.code, count(DISTINCT mt.module_id)::int AS met, min(mt.eind_datum)::text AS eind,
           (SELECT count(*)::int FROM v_cursus_modules x WHERE x.cursus_id = c.id) AS modules,
           count(DISTINCT mt.module_id) FILTER (WHERE c.bron IS NULL OR NOT EXISTS (
             SELECT 1 FROM v_cursus_modules x JOIN cursussen xc ON xc.id = x.cursus_id
             WHERE x.module_id = mt.module_id AND xc.id <> c.id AND xc.bron = c.bron))::int AS met_eigen
    FROM v_module_toegang mt JOIN v_cursus_modules cm ON cm.module_id = mt.module_id JOIN cursussen c ON c.id = cm.cursus_id
    WHERE mt.gebruiker_id = ANY(${ids}::uuid[])
    GROUP BY mt.gebruiker_id, c.id, c.code, c.bron`
  for (const r of rijen as any[]) {
    if (!uit.has(r.gebruiker_id)) uit.set(r.gebruiker_id, new Map())
    uit.get(r.gebruiker_id)!.set(r.code, { met: r.met, met_eigen: r.met_eigen, modules: r.modules, eind: r.eind })
  }
  return uit
}

export async function laadAttesten(ids: string[]): Promise<Map<string, AttestRij[]>> {
  const uit = new Map<string, AttestRij[]>()
  if (!ids.length) return uit
  const rijen = await db()`
    SELECT a.id, a.nummer, a.gebruiker_id, c.code AS cursus, a.uitgereikt_op, a.ingetrokken_op, a.gemaild_op, a.score
    FROM attesten a JOIN cursussen c ON c.id = a.cursus_id
    WHERE a.gebruiker_id = ANY(${ids}::uuid[]) AND a.module_id IS NULL
    ORDER BY a.uitgereikt_op DESC`
  for (const r of rijen as any[]) {
    if (!uit.has(r.gebruiker_id)) uit.set(r.gebruiker_id, [])
    uit.get(r.gebruiker_id)!.push(r)
  }
  return uit
}

// ---------- Leerlijn van een groep deelnemers ----------
export type LeerlijnCursus = CursusStand & {
  online: boolean
  demo: boolean
  toegang: boolean
  deels: boolean
  eind: string | null
  attest: { id: string; nummer: string; uitgereikt_op: string; gemaild_op: string | null } | null
}
export type LeerlijnDeelnemer = Deelnemer & {
  cursussen: LeerlijnCursus[]
  totaal: ReturnType<typeof totaal>
  attesten: AttestRij[]
}

/**
 * Bouwt de leerlijn voor een groep deelnemers. Afgeronde cursussen met een bevestigde structuur krijgen automatisch
 * een attest (één keer: een ingetrokken attest wordt niet vanzelf opnieuw uitgereikt).
 * alleCursussen: ook cursussen zonder toegang en zonder voortgang tonen (beheerders als tester).
 */
export async function leerlijn(deelnemers: Deelnemer[], opties: { alleCursussen?: (d: Deelnemer) => boolean } = {}): Promise<LeerlijnDeelnemer[]> {
  const ids = deelnemers.map((d) => d.id)
  const [cursussen, structuren, voortgang, toegang, attesten] = await Promise.all([
    laadCursussen(), laadStructuren(), laadVoortgang(ids), laadToegang(ids), laadAttesten(ids),
  ])
  // Afgeleide cursussen: welke app-modules hebben ze alleen (niet met een andere cursus van dezelfde bron gedeeld)?
  const eigen = new Map<string, Set<string>>()
  for (const c of cursussen) {
    if (!c.bron) continue
    const anderen = new Set(cursussen.filter((x) => x.bron === c.bron && x.code !== c.code).flatMap((x) => x.app_modules ?? []))
    eigen.set(c.code, new Set((c.app_modules ?? []).filter((id) => !anderen.has(id))))
  }
  const uit: LeerlijnDeelnemer[] = []
  for (const d of deelnemers) {
    const v = voortgang.get(d.id) ?? new Map()
    const t = toegang.get(d.id) ?? new Map()
    const a = attesten.get(d.id) ?? []
    const alle = opties.alleCursussen?.(d) ?? false
    const lijst: LeerlijnCursus[] = []
    const geteld = new Map<string, Set<string>>() // per bron: modules die al meetellen in het totaal
    for (const c of cursussen) {
      if (c.is_bron) continue
      const tg = t.get(c.code)
      const P = v.get(gegevensCode(c)) ?? null
      if (!c.app && !P) continue
      const s = stand(c.code, c.titel, structuren.get(c.code) ?? null, P)
      const volledig = !!tg && tg.modules > 0 && tg.met >= tg.modules
      // Bij BMC en BPB maakt de gedeelde basis een cursus niet zichtbaar: enkel toegang of voortgang in de eigen modules.
      const eigenToegang = !!tg && (c.bron ? tg.met_eigen > 0 : tg.met > 0)
      const eigenVoortgang = !!P && (!c.bron || s.modules.some((m) => m.af > 0 && eigen.get(c.code)!.has(m.id)))
      if (!alle && !volledig && !eigenToegang && !eigenVoortgang) continue
      if (c.bron) {
        const al = geteld.get(c.bron) ?? new Set<string>()
        const g: Gedeeld = { af: 0, geslaagd: 0, foutloos: 0, modules_af: 0, punten: 0 }
        for (const m of s.modules) {
          if (!al.has(m.id)) { al.add(m.id); continue }
          g.af += m.af; g.geslaagd += m.geslaagd; g.foutloos += m.foutloos; g.punten += m.punten
          if (m.n !== "0" && m.status === "af") g.modules_af++
        }
        geteld.set(c.bron, al)
        s.gedeeld = g.af || g.punten ? g : null
      }
      let at = a.find((x) => x.cursus === c.code && !x.ingetrokken_op) ?? null
      if (!at && s.afgerond && s.bevestigd && !a.some((x) => x.cursus === c.code)) {
        const nieuw = await reikAttestUit(d, c, s)
        if (nieuw) { a.unshift(nieuw); at = nieuw }
      }
      lijst.push({
        ...s,
        online: c.gepubliceerd,
        demo: c.demo,
        toegang: alle || (volledig && c.gepubliceerd),
        deels: !volledig && eigenToegang,
        eind: tg?.eind ?? null,
        attest: at ? { id: at.id, nummer: at.nummer, uitgereikt_op: at.uitgereikt_op, gemaild_op: at.gemaild_op } : null,
      })
    }
    uit.push({ ...d, cursussen: lijst, totaal: totaal(lijst), attesten: a })
  }
  return uit
}

export const volleNaam = (d: { voornaam?: string | null; achternaam?: string | null; email?: string }) =>
  [d.voornaam, d.achternaam].filter(Boolean).join(" ") || d.email || ""
/** Naam voor een klassement buiten het eigen beheer: voornaam en initiaal. */
export const korteNaam = (d: { voornaam?: string | null; achternaam?: string | null }) =>
  [d.voornaam, d.achternaam ? d.achternaam.trim().charAt(0).toUpperCase() + "." : ""].filter(Boolean).join(" ") || "Deelnemer"

/** Reikt een cursusattest uit (momentopname van naam, cursus en resultaat). Geeft null als er al een geldig attest is. */
export async function reikAttestUit(d: Deelnemer, c: { id: string; code: string; titel: string }, s: CursusStand, door: string | null = null): Promise<AttestRij | null> {
  const modules = s.modules.filter((m) => m.n !== "0").map((m) => ({ n: m.n, titel: m.titel, status: m.status }))
  const [r] = await db()`
    INSERT INTO attesten (gebruiker_id, cursus_id, score, naam, cursus_titel, modules, lessen, toetsen, gestart_op, afgerond_op)
    SELECT ${d.id}::uuid, ${c.id}::uuid, ${s.gem_score}::numeric, ${volleNaam(d)}::text, ${c.titel}::text, ${JSON.stringify(modules)}::jsonb,
           ${s.lessen}::int, ${s.toetsen}::int, ${s.gestart_op}::timestamptz, ${s.afgerond_op}::timestamptz
    WHERE NOT EXISTS (SELECT 1 FROM attesten x WHERE x.gebruiker_id = ${d.id} AND x.cursus_id = ${c.id} AND x.module_id IS NULL AND x.ingetrokken_op IS NULL)
    ON CONFLICT DO NOTHING
    RETURNING id, nummer, gebruiker_id, uitgereikt_op, ingetrokken_op, gemaild_op, score`
  if (!r) return null
  await db()`SELECT log_actie('attest_uitgereikt', 'attest', ${r.id}::uuid, ${JSON.stringify({ cursus: c.code, gebruiker: d.id, nummer: r.nummer, door })}::jsonb)`
  return { ...(r as any), cursus: c.code }
}
