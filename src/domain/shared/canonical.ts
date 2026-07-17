import { sha256 as sha256Digest } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: unknown): string {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return bytesToHex(sha256Digest(new TextEncoder().encode(input)));
}
