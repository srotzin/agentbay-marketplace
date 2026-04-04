/**
 * Web Search — Real search results via multiple free engines
 */

const SEARCH_ENGINES = [
  // DuckDuckGo instant answer API (free, no key)
  async (query) => {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading, url: data.AbstractURL, snippet: data.AbstractText, source: data.AbstractSource });
    }
    for (const topic of (data.RelatedTopics || []).slice(0, 8)) {
      if (topic.Text && topic.FirstURL) {
        results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text });
      }
    }
    return results;
  },

  // Wikipedia search (free, no key)
  async (query) => {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.query?.search || []).map(r => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      snippet: r.snippet.replace(/<[^>]+>/g, ''),
    }));
  },
];

export async function webSearch(query) {
  const allResults = [];

  for (const engine of SEARCH_ENGINES) {
    try {
      const results = await engine(query);
      if (results) allResults.push(...results);
    } catch {}
  }

  // Dedupe by URL
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return {
    query,
    results: unique.slice(0, 10),
    total: unique.length,
    provider: "HiveAgent Search",
  };
}
