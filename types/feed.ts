// types/feed.ts
export type FeedItem = {
  id: string
  title: string
  url: string | null
  score: number | null
  publishedAt: Date | null
  createdAt: Date
  lab: {
    name: string
    slug: string
  }
  source: {
    name: string
    type: string
  }
}