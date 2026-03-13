// lib/scoring/scoreItem.ts
type ScoreInput = {
  title: string;
  summary?: string;
  tags: string[];
  publishedAt?: Date;
  sourceType: "RSS" | "ARXIV" | "GITHUB" | "YOUTUBE" | "WEBSITE";
  labMatchConfidence?: number;
  labPriority?: number;
  githubStars?: number;
  arxivCategories?: string[];
};

export function scoreItem(input: ScoreInput) {
  let score = 0;

  if (input.publishedAt) {
    const ageHours = (Date.now() - input.publishedAt.getTime()) / (1000 * 60 * 60);

    if (ageHours < 24) score += 32;
    else if (ageHours < 72) score += 24;
    else if (ageHours < 168) score += 14;
    else if (ageHours < 720) score += 6;
    else score += 2;
  }

  if (input.sourceType === "ARXIV") score += 22;
  if (input.sourceType === "GITHUB") score += 18;
  if (input.sourceType === "YOUTUBE") score += 14;
  if (input.sourceType === "RSS") score += 12;
  if (input.sourceType === "WEBSITE") score += 10;

  const importantTags = [
    "xr",
    "marine",
    "robotics",
    "autonomy",
    "perception",
    "simulation",
    "mapping",
    "sensing",
  ];

  score += input.tags.filter((t) => importantTags.includes(t)).length * 5;

  const text = `${input.title} ${input.summary ?? ""}`.toLowerCase();

  const noveltyWords = [
    "new",
    "novel",
    "introducing",
    "first",
    "benchmark",
    "real-time",
    "digital twin",
    "underwater",
    "telepresence",
    "3d reconstruction",
    "release",
    "open-source",
    "dataset",
  ];

  score += noveltyWords.filter((w) => text.includes(w)).length * 4;

  if (input.labMatchConfidence) {
    score += Math.round(input.labMatchConfidence * 20);
  }

  if (input.labPriority) {
    score += Math.min(input.labPriority, 10);
  }

  if (input.githubStars) {
    if (input.githubStars >= 5000) score += 12;
    else if (input.githubStars >= 1000) score += 8;
    else if (input.githubStars >= 250) score += 4;
  }

  if (input.arxivCategories?.length) {
    score += Math.min(input.arxivCategories.length * 2, 6);
  }

  return Math.min(Math.round(score), 100);
}