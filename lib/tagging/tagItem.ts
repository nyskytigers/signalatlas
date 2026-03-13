// lib/tagging/tagItem.ts
const TAG_RULES: Record<string, string[]> = {
  xr: ["xr", "ar ", "vr ", "mixed reality", "spatial computing", "headset"],
  robotics: ["robot", "robotics", "manipulator", "autonomous system"],
  marine: ["marine", "ocean", "underwater", "sea", "deep-sea", "subsea"],
  autonomy: ["autonomy", "autonomous", "navigation", "planning"],
  perception: ["perception", "vision", "slam", "reconstruction", "tracking"],
  teleoperation: ["teleoperation", "telepresence", "remote operation"],
  mapping: ["mapping", "localization", "3d", "3-d", "point cloud"],
  sensing: ["sensor", "sonar", "lidar", "depth", "imaging"],
  hci: ["hci", "interaction", "user study", "interface"],
  simulation: ["simulation", "digital twin", "simulator"],
};

export function tagItem(input: {
  title: string;
  summary?: string;
  contentText?: string;
}): string[] {
  const text = `${input.title} ${input.summary ?? ""} ${input.contentText ?? ""}`.toLowerCase();

  const tags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}