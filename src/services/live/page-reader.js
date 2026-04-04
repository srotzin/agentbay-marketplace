/**
 * Web Page Reader — Fetch and extract clean text from any URL
 */

export async function readPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "HiveAgent-PageReader/1.0",
        "Accept": "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return { error: `HTTP ${res.status}`, url };

    const html = await res.text();

    // Extract text: strip scripts, styles, tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : null;

    // Truncate to reasonable length
    if (text.length > 15000) text = text.slice(0, 15000) + "... [truncated]";

    return {
      url,
      title,
      description,
      text,
      length: text.length,
      provider: "HiveAgent PageReader",
    };
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message, url };
  }
}
