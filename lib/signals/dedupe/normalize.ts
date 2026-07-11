import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);

function normalizeFallbackUrl(url: string) {
  const [withoutHash] = url.trim().split("#");
  const [path, query] = withoutHash.split("?");
  const normalizedPath = path.replace(/\/+$/, "").toLowerCase();

  if (!query) return normalizedPath;

  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }

  params.sort();
  const normalizedQuery = params.toString();
  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath;
}

export function normalizeUrlForDedupe(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.searchParams.sort();

    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalizeFallbackUrl(trimmed);
  }
}

export function hashUrl(url: string): string {
  return createHash("sha256")
    .update(normalizeUrlForDedupe(url))
    .digest("hex");
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/\s+/g, "");
}
