//lib/ingest/adapters/github.ts
export type GithubNormalizedItem = {
  sourceId?: string;
  sourceType: "GITHUB";
  sourceName?: string;
  externalId?: string;
  url: string;
  title: string;
  summary?: string;
  contentText?: string;
  publishedAt?: Date;
  authors?: string[];
  tags?: string[];
  raw?: unknown;
};

function parseGithubRepo(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

export async function fetchGithubItems(
  repoUrl: string,
  sourceId?: string,
  sourceName = "GitHub"
): Promise<GithubNormalizedItem[]> {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) return [];

  const { owner, repo } = parsed;

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const [repoRes, releasesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers }),
  ]);

  if (!repoRes.ok) {
    throw new Error(`GitHub repo fetch failed: ${repoRes.status}`);
  }

  const repoJson = await repoRes.json();
  const releasesJson = releasesRes.ok ? await releasesRes.json() : [];

  const items: GithubNormalizedItem[] = [];

  items.push({
    sourceId,
    sourceType: "GITHUB",
    sourceName,
    externalId: `repo:${repoJson.full_name}:${repoJson.pushed_at}`,
    url: repoJson.html_url,
    title: `${repoJson.full_name} repository activity`,
    summary: repoJson.description || "Repository updated",
    contentText: repoJson.description || "",
    publishedAt: repoJson.pushed_at ? new Date(repoJson.pushed_at) : undefined,
    authors: repoJson.owner?.login ? [repoJson.owner.login] : [],
    tags: Array.isArray(repoJson.topics) ? repoJson.topics : [],
    raw: repoJson,
  });

  for (const rel of Array.isArray(releasesJson) ? releasesJson : []) {
    items.push({
      sourceId,
      sourceType: "GITHUB",
      sourceName,
      externalId: `release:${rel.id}`,
      url: rel.html_url,
      title: rel.name || rel.tag_name || `${repoJson.full_name} release`,
      summary: rel.body ? String(rel.body).slice(0, 1000) : "New GitHub release",
      contentText: rel.body || "",
      publishedAt: rel.published_at ? new Date(rel.published_at) : undefined,
      authors: rel.author?.login ? [rel.author.login] : [],
      tags: Array.isArray(repoJson.topics) ? repoJson.topics : [],
      raw: rel,
    });
  }

  return items.filter((item) => item.url && item.title);
}