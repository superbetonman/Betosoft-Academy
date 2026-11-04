/**
 * E-mail via Brevo (transactionele mail). Nodig in Netlify:
 *   BREVO_API_KEY   API-sleutel van Brevo (SMTP & API > API Keys)
 *   MAIL_AFZENDER   een afzenderadres dat in Brevo geverifieerd is (bv. academy@betosoft.be)
 *   MAIL_AFZENDER_NAAM (optioneel, standaard "Betosoft Academy")
 * Zonder die instellingen geeft verstuur() { geconfigureerd: false } terug; de pagina valt dan terug op het eigen mailprogramma.
 */
export type Mail = { naar: string; naarNaam?: string | null; onderwerp: string; html: string; tekst: string; antwoordAan?: string | null }

export function mailGeconfigureerd() {
  return !!(Netlify.env.get("BREVO_API_KEY") && Netlify.env.get("MAIL_AFZENDER"))
}

export async function verstuur(m: Mail): Promise<{ geconfigureerd: boolean; ok: boolean; fout?: string }> {
  const sleutel = Netlify.env.get("BREVO_API_KEY")
  const afzender = Netlify.env.get("MAIL_AFZENDER")
  if (!sleutel || !afzender) return { geconfigureerd: false, ok: false }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": sleutel, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: afzender, name: Netlify.env.get("MAIL_AFZENDER_NAAM") || "Betosoft Academy" },
      to: [{ email: m.naar, ...(m.naarNaam ? { name: m.naarNaam } : {}) }],
      ...(m.antwoordAan ? { replyTo: { email: m.antwoordAan } } : {}),
      subject: m.onderwerp,
      htmlContent: m.html,
      textContent: m.tekst,
    }),
  })
  if (!res.ok) {
    console.error("Brevo", res.status, (await res.text().catch(() => "")).slice(0, 300))
    return { geconfigureerd: true, ok: false, fout: "De mail kon niet verstuurd worden." }
  }
  return { geconfigureerd: true, ok: true }
}
