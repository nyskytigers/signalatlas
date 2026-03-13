// lib/tagging.ts
export function extractTags(input: {
  title?: string | null;
  summary?: string | null;
  sourceType?: string | null;
  existingTags?: string[] | null;
}) {
  const text = `${input.title ?? ""} ${input.summary ?? ""}`.toLowerCase();
  const tags = new Set<string>(input.existingTags ?? []);

  if (
    text.includes("robot") ||
    text.includes("robotics") ||
    text.includes("auv") ||
    text.includes("rov") ||
    text.includes("autonomous") ||
    text.includes("slam")
  ) {
    tags.add("robotics");
  }

  if (
    text.includes("marine") ||
    text.includes("ocean") ||
    text.includes("underwater") ||
    text.includes("bathymetry") ||
    text.includes("sonar") ||
    text.includes("multibeam")
  ) {
    tags.add("marine");
  }

  if (
    text.includes("sensing") ||
    text.includes("sensor") ||
    text.includes("imaging") ||
    text.includes("backscatter")
  ) {
    tags.add("sensing");
  }

  if (
    text.includes("vision") ||
    text.includes("3d") ||
    text.includes("reconstruction") ||
    text.includes("tracking")
  ) {
    tags.add("computer-vision");
  }

  if (
    text.includes("xr") ||
    text.includes("virtual reality") ||
    text.includes("augmented reality") ||
    text.includes("spatial computing") ||
    text.includes("ar/vr")
  ) {
    tags.add("xr");
  }

  if (input.sourceType?.toUpperCase() === "YOUTUBE") {
    tags.add("video");
  }

  if (input.sourceType?.toUpperCase() === "GITHUB") {
    tags.add("code");
  }

  return Array.from(tags);
}