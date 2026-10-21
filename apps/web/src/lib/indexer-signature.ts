import { createHmac, timingSafeEqual } from "node:crypto";

export const INDEXER_SIGNATURE_HEADER = "x-indexer-signature";

export function signIndexerPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function verifyIndexerSignature(
  body: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return true;
  if (!signature) return false;

  const expected = signIndexerPayload(body, secret);
  const received = signature.trim().toLowerCase();
  if (received.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
