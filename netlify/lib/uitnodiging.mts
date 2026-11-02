import { db } from "./db.mts"
import { nieuwToken } from "./wachtwoord.mts"

/** Maakt een uitnodigingslink (14 dagen geldig). Eerdere open uitnodigingen voor dezelfde persoon vervallen. */
export async function maakUitnodiging(req: Request, gebruikerId: string, doorId: string | null) {
  const sql = db()
  const { token, hash } = nieuwToken()
  await sql.transaction([
    sql`UPDATE uitnodigingen SET vervalt_op = now() WHERE gebruiker_id = ${gebruikerId} AND gebruikt_op IS NULL AND vervalt_op > now()`,
    sql`INSERT INTO uitnodigingen (gebruiker_id, token_hash, aangemaakt_door) VALUES (${gebruikerId}, ${hash}, ${doorId})`,
    sql`SELECT log_actie('uitnodiging_gemaakt', 'gebruiker', ${gebruikerId}::uuid, ${JSON.stringify({ door: doorId })}::jsonb)`,
  ])
  const basis = new URL(req.url).origin
  return { link: `${basis}/welkom/?t=${token}`, geldig_tot: new Date(Date.now() + 14 * 864e5).toISOString() }
}
