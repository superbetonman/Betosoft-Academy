import { db } from "./db.mts"
import { isBeheer, type Gebruiker } from "./sessie.mts"

export const CURSUSCODE = /^[A-Z0-9-]{1,20}$/

/**
 * Mag deze gebruiker de volledige cursusapp openen?
 * Beheerders altijd (als tester). Een cursist enkel als hij toegang heeft tot alle modules van de cursus
 * (volledige cursus of abonnement): de app bevat alle modules, dus een losse module of een deeltraject volstaat niet.
 */
export async function magCursus(g: Gebruiker | null, code: string): Promise<boolean> {
  if (!g) return false
  if (isBeheer(g)) return true
  const [r] = await db()`
    SELECT count(*)::int AS modules, count(mt.module_id)::int AS met_toegang
    FROM modules m
    JOIN cursussen c ON c.id = m.cursus_id
    LEFT JOIN (SELECT DISTINCT module_id FROM v_module_toegang WHERE gebruiker_id = ${g.id}) mt ON mt.module_id = m.id
    WHERE c.code = ${code}`
  return !!r && r.modules > 0 && r.modules === r.met_toegang
}
