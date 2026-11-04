import { db } from "./db.mts"
import { nieuwToken } from "./wachtwoord.mts"

/**
 * Maakt een link naar /welkom/ om een wachtwoord te kiezen. Standaard een uitnodiging van 14 dagen; voor "wachtwoord vergeten"
 * een herstellink van 1 uur (uren: 1). De link werkt één keer. Eerdere open links voor dezelfde persoon vervallen.
 */
export async function maakUitnodiging(
  req: Request,
  gebruikerId: string,
  doorId: string | null,
  { uren = 14 * 24, actie = "uitnodiging_gemaakt" }: { uren?: number; actie?: string } = {},
) {
  const sql = db()
  const { token, hash } = nieuwToken()
  const geldigTot = new Date(Date.now() + uren * 36e5)
  await sql.transaction([
    sql`UPDATE uitnodigingen SET vervalt_op = now() WHERE gebruiker_id = ${gebruikerId} AND gebruikt_op IS NULL AND vervalt_op > now()`,
    sql`INSERT INTO uitnodigingen (gebruiker_id, token_hash, aangemaakt_door, vervalt_op) VALUES (${gebruikerId}, ${hash}, ${doorId}, ${geldigTot.toISOString()})`,
    sql`SELECT log_actie(${actie}, 'gebruiker', ${gebruikerId}::uuid, ${JSON.stringify({ door: doorId })}::jsonb)`,
  ])
  const basis = new URL(req.url).origin
  return { link: `${basis}/welkom/?t=${token}`, geldig_tot: geldigTot.toISOString() }
}
