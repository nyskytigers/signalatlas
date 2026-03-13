// lib/scoring/v0.ts
const XR_KEYWORDS = [
  "vr", "ar", "xr", "hci", "interaction", "headset", "tracking",
  "hand tracking", "spatial", "slam", "pose", "telepresence"
];

const MARINE_KEYWORDS = [
  "auv", "rov", "underwater", "sonar", "acoustic", "marine", "ocean",
  "subsea", "bathymetry", "navigation", "localization"
];

function containsAny(text: string, kws: string[]) {
  const t = text.toLowerCase();
  return kws.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
}

export function scoreItemV0(opts: {
  title: string;
  summary?: string | null;
  publishedAt?: Date | null;
  labDomain: "XR" | "MARINE" | "BOTH";
  sourceType: string;
}) {
  const text = `${opts.title}\n${opts.summary ?? ""}`;
  const now = Date.now();
  const pub = opts.publishedAt?.getTime?.() ?? now;

  // Recency: 0..50 over ~14 days
  const ageDays = Math.max(0, (now - pub) / (1000 * 60 * 60 * 24));
  const recency = Math.max(0, 50 - (ageDays * (50 / 14)));

  // Keyword boost
  const xrHits = containsAny(text, XR_KEYWORDS);
  const marineHits = containsAny(text, MARINE_KEYWORDS);

  let domainBoost = 0;
  if (opts.labDomain === "XR") domainBoost = xrHits * 6;
  if (opts.labDomain === "MARINE") domainBoost = marineHits * 6;
  if (opts.labDomain === "BOTH") domainBoost = Math.max(xrHits, marineHits) * 4;

  // Source confidence (RSS/arXiv are decent)
  const sourceBoost =
    opts.sourceType === "RSS" ? 8 :
    opts.sourceType === "ARXIV" ? 10 : 0;

  const score = recency + domainBoost + sourceBoost;

  return {
    score,
    novelty: Math.min(100, domainBoost),
    impact: Math.min(100, recency),
  };
}