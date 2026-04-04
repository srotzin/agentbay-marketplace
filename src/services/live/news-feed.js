/**
 * News Feed — Real-time news via free RSS feeds + Wikipedia current events
 */

async function parseRSSFeed(url, source) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HiveAgent-NewsFeed/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const link = item.match(/<link[^>]*>(.*?)<\/link>/)?.[1]?.trim();
      const desc = item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]
        ?.replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];

      if (title && link) {
        items.push({ title, url: link, description: desc, published: pubDate, source });
      }
    }
    return items;
  } catch {
    return [];
  }
}

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/rss.xml", source: "BBC News" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", source: "New York Times" },
  { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://www.wired.com/feed/rss", source: "Wired" },
];

export async function getNews(topic = null, limit = 15) {
  const allArticles = [];

  const feedPromises = FEEDS.map(f => parseRSSFeed(f.url, f.source));
  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status === "fulfilled") allArticles.push(...result.value);
  }

  // Filter by topic if provided
  let filtered = allArticles;
  if (topic) {
    const t = topic.toLowerCase();
    filtered = allArticles.filter(a =>
      a.title?.toLowerCase().includes(t) ||
      a.description?.toLowerCase().includes(t)
    );
  }

  // Sort by date (newest first) and dedupe
  const seen = new Set();
  const unique = filtered.filter(a => {
    const key = a.title?.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    topic: topic || "top stories",
    articles: unique.slice(0, limit),
    total: unique.length,
    sources: [...new Set(allArticles.map(a => a.source))],
    provider: "HiveAgent NewsFeed",
  };
}
