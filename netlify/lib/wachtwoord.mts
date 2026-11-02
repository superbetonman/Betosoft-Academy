import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto"

const N = 16384, R = 8, P = 1, LEN = 64

function scryptAsync(wachtwoord: string, zout: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((ok, nok) =>
    scrypt(wachtwoord.normalize("NFKC"), zout, LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? nok(err) : ok(key))),
  )
}

export async function hashWachtwoord(wachtwoord: string) {
  const zout = randomBytes(16)
  const key = await scryptAsync(wachtwoord, zout)
  return `scrypt$${N}$${R}$${P}$${zout.toString("base64url")}$${key.toString("base64url")}`
}

export async function controleerWachtwoord(wachtwoord: string, opgeslagen: string | null | undefined) {
  if (!opgeslagen) {
    // Zelfde rekentijd als bij een echt account, zodat het antwoord niets verraadt
    await scryptAsync(wachtwoord, Buffer.alloc(16))
    return false
  }
  const [alg, n, r, p, zout, hash] = opgeslagen.split("$")
  if (alg !== "scrypt") return false
  const key = await scryptAsync(wachtwoord, Buffer.from(zout, "base64url"), Number(n), Number(r), Number(p))
  const verwacht = Buffer.from(hash, "base64url")
  return key.length === verwacht.length && timingSafeEqual(key, verwacht)
}

export function wachtwoordFout(w: string): string | null {
  if (typeof w !== "string" || w.length < 12) return "Kies een wachtwoord van minstens 12 tekens."
  if (w.length > 200) return "Wachtwoord is te lang."
  return null
}

export function nieuwToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: tokenHash(token) }
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
