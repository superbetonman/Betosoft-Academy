import { db } from "./db.mts"
import { isBeheer, type Gebruiker } from "./sessie.mts"

export const CURSUSCODE = /^[A-Z0-9-]{1,20}$/

/**
 * Mag deze gebruiker de volledige cursusapp openen?
 * Beheerders altijd (als tester). Een cursist enkel als de cursus online staat (cursussen.gepubliceerd) en hij toegang heeft
 * tot alle modules van de cursus (volledige cursus, pakket of abonnement): de app bevat alle modules, dus een losse module of
 * een deeltraject volstaat niet. De modules van een cursus komen uit v_cursus_modules (bij BMC en BPB: de gekozen modules
 * van de bron BMC-BPB).
 */
export async function magCursus(g: Gebruiker | null, code: string): Promise<boolean> {
  if (!g) return false
  if (isBeheer(g)) return true
  const [r] = await db()`
    SELECT count(*)::int AS modules, count(mt.module_id)::int AS met_toegang
    FROM cursussen c
    JOIN v_cursus_modules cm ON cm.cursus_id = c.id
    LEFT JOIN (SELECT DISTINCT module_id FROM v_module_toegang WHERE gebruiker_id = ${g.id}) mt ON mt.module_id = cm.module_id
    WHERE c.code = ${code} AND c.gepubliceerd`
  return !!r && r.modules > 0 && r.modules === r.met_toegang
}

/**
 * Mag deze gebruiker de gegevens (voortgang) onder deze code lezen en schrijven?
 * Bij de cursus zelf, of bij de bron als hij een cursus mag openen die van die bron afgeleid is: BMC en BPB bewaren hun
 * voortgang bij BMC-BPB, zodat de gemeenschappelijke basis één keer gevolgd wordt.
 */
export async function magGegevens(g: Gebruiker | null, code: string): Promise<boolean> {
  if (!g) return false
  if (await magCursus(g, code)) return true
  const afgeleid = await db()`SELECT code FROM cursussen WHERE bron = ${code} AND gepubliceerd`
  for (const r of afgeleid as any[]) if (await magCursus(g, r.code)) return true
  return false
}

export type CursusInfo = {
  id: string
  code: string
  titel: string
  gepubliceerd: boolean
  startpagina: string
  /** code van de bron (app en voortgang), of null */
  bron: string | null
  app_modules: string[] | null
  app_meta: Record<string, unknown> | null
  /** andere cursussen gebruiken deze cursus als bron */
  is_bron: boolean
}

export async function cursusInfo(code: string): Promise<CursusInfo | null> {
  const [c] = await db()`
    SELECT c.id, c.code, c.titel, c.gepubliceerd, c.startpagina, c.bron, c.app_modules, c.app_meta, is_bron(c.code) AS is_bron
    FROM cursussen c WHERE c.code = ${code}`
  return (c as CursusInfo) ?? null
}
