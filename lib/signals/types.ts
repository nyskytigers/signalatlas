export const SIGNAL_TYPES = [
  "PAPER",
  "DATASET",
  "REPOSITORY",
  "VIDEO",
  "NEWS",
  "LAB_UPDATE",
  "DISCOVERY",
  "EXPEDITION",
  "GRANT",
  "SCHOLARSHIP",
  "INTERNSHIP",
  "PHD_POSITION",
  "EVENT",
  "REPORT",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export type Signal = {
  id?: string;
  title: string;
  summary: string | null;
  sourceId: string | null;
  sourceName: string | null;
  canonicalUrl: string;
  signalType: SignalType;
  publishedAt: Date | null;
  technologies: string[];
  organizations: string[];
  researchers: string[];
  domains: string[];
  keywords: string[];
  relevanceScore: number | null;
  raw: unknown | null;
};

export type SignalInput = Omit<Signal, "id"> & {
  id?: string;
};

export function isSignalType(value: unknown): value is SignalType {
  return (
    typeof value === "string" &&
    (SIGNAL_TYPES as readonly string[]).includes(value)
  );
}
