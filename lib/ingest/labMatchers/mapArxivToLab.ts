// lib/ingest/labMatchers/mapArxivToLab.ts
type LabMatch = {
  slug: string;
  score: number;
};

const LAB_KEYWORDS = [
  {
    slug: "mbari",
    keywords: [
      "mbari",
      "monterey bay aquarium research institute",
      "monterey bay",
    ],
  },
  {
    slug: "whoi-dsl",
    keywords: [
      "woods hole",
      "whoi",
      "deep submergence laboratory",
      "oceanographic institution",
    ],
  },
  {
    slug: "uw-apl-ocean",
    keywords: [
      "applied physics laboratory",
      "university of washington",
      "uw apl",
      "ocean engineering",
    ],
  },
  {
    slug: "ntnu-amos",
    keywords: [
      "ntnu",
      "amos",
      "centre for autonomous marine operations and systems",
      "autonomous marine operations",
    ],
  },
  {
    slug: "eth-asl",
    keywords: [
      "eth zürich",
      "eth zurich",
      "autonomous systems lab",
      "asl.ethz",
      "ethz",
    ],
  },
  {
    slug: "stanford-oceanic-robotics",
    keywords: [
      "stanford",
      "oceanic robotics",
      "stanford university",
    ],
  },
  {
    slug: "uw-reality-lab",
    keywords: [
      "reality lab",
      "university of washington",
      "uw reality lab",
    ],
  },
  {
    slug: "mit-media-lab",
    keywords: [
      "mit media lab",
      "media lab",
      "massachusetts institute of technology",
      "mit",
    ],
  },
  {
    slug: "tum-visual-computing",
    keywords: [
      "tum",
      "technical university of munich",
      "visual computing group",
    ],
  },
  {
    slug: "max-planck-perceiving-systems",
    keywords: [
      "max planck",
      "perceiving systems",
      "mpi",
      "max-planck institute",
    ],
  },
];

function countHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((sum, kw) => {
    return sum + (lower.includes(kw.toLowerCase()) ? 1 : 0);
  }, 0);
}

export function mapArxivToLab(input: {
  title?: string | null;
  summary?: string | null;
  authors?: string[];
  sourceText?: string | null;
}): LabMatch | null {
  const blob = [
    input.title ?? "",
    input.summary ?? "",
    (input.authors ?? []).join(" "),
    input.sourceText ?? "",
  ]
    .join(" \n ")
    .toLowerCase();

  let best: LabMatch | null = null;

  for (const lab of LAB_KEYWORDS) {
    const score = countHits(blob, lab.keywords);

    if (!best || score > best.score) {
      best = { slug: lab.slug, score };
    }
  }

  if (!best) return null;

  // MVP: allow 1 keyword hit
  if (best.score < 1) return null;

  return best;
}