/**
 * Canonicalisation JSON isomorphe (serveur + navigateur).
 *
 * Reproduit à l'identique la sémantique de `canonicalReplayJson`
 * (`@/lib/agent/replay-contract`) sans dépendre de `node:crypto`, afin que la
 * vérification du hash puisse être rejouée côté client. La parité entre les deux
 * implémentations est verrouillée par un test dédié : toute divergence casse la
 * suite plutôt que de produire silencieusement deux hashes différents.
 */
export function canonicalJsonSafe(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonicalJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJsonSafe(item)]),
    );
  }
  return null;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalJsonSafe(value));
}

/** SHA-256 hex via Web Crypto — disponible dans le navigateur et sous Node 18+. */
export async function sha256HexAsync(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
