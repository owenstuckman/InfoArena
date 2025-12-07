/**
 * Wikipedia API Service
 * Uses the MediaWiki REST API to fetch article summaries and content
 * API Docs: https://www.mediawiki.org/wiki/API:REST_API
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';
const USER_AGENT = 'KnowledgeArena/1.0 (https://github.com/knowledge-arena)';

export interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: { page: string };
    mobile: { page: string };
  };
}

export interface WikipediaSearchResult {
  id: number;
  key: string;
  title: string;
  description?: string;
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
}

/**
 * Fetch a summary for a Wikipedia article
 */
export async function fetchWikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  try {
    // Replace spaces with underscores for Wikipedia URLs
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    
    const response = await fetch(`${WIKIPEDIA_API}/page/summary/${encoded}`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Article not found
      }
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Wikipedia summary:', error);
    return null;
  }
}

/**
 * Get the extract text for a topic
 */
export async function getWikipediaContent(topic: string): Promise<string> {
  const summary = await fetchWikipediaSummary(topic);
  
  if (!summary) {
    return `No Wikipedia article found for "${topic}".`;
  }
  
  return summary.extract || `No summary available for "${topic}".`;
}

/**
 * Search Wikipedia for articles
 */
export async function searchWikipedia(query: string, limit: number = 5): Promise<WikipediaSearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    
    const response = await fetch(
      `${WIKIPEDIA_API}/search/page?q=${encoded}&limit=${limit}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Wikipedia search error: ${response.status}`);
    }

    const data = await response.json();
    return data.pages || [];
  } catch (error) {
    console.error('Failed to search Wikipedia:', error);
    return [];
  }
}

/**
 * Get related articles for a topic
 */
export async function getRelatedArticles(title: string, limit: number = 5): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    
    const response = await fetch(
      `${WIKIPEDIA_API}/page/related/${encoded}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.pages || []).slice(0, limit).map((p: any) => p.title);
  } catch (error) {
    console.error('Failed to get related articles:', error);
    return [];
  }
}

/**
 * Get a random Wikipedia article title
 */
export async function getRandomArticle(): Promise<string | null> {
  try {
    const response = await fetch(`${WIKIPEDIA_API}/page/random/summary`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia random error: ${response.status}`);
    }

    const data = await response.json();
    return data.title || null;
  } catch (error) {
    console.error('Failed to get random article:', error);
    return null;
  }
}
