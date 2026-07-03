// types/feed.ts
export type FeedItem = {
  id: string;
  title: string;
  url: string;
  summary?: string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
  score?: number | null;
  source?: {
    name: string;
    type: string;
  };
  lab?: {
    name: string;
    slug: string;
  };
  tags?: string[];
};