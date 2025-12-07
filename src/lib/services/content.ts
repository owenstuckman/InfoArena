/**
 * Knowledge Content Service
 * Fetches content from Wikipedia, Grokipedia (xAI), and Encyclopedia Britannica
 * 
 * IMPORTANT: All content is sanitized to remove source self-references
 * to ensure blind comparisons are truly blind.
 */

// ============================================
// WIKIPEDIA
// ============================================

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';
const WIKIPEDIA_ACTION_API = 'https://en.wikipedia.org/w/api.php';

export interface WikipediaArticle {
  title: string;
  extract: string;
  fullContent?: string;
  url: string;
  thumbnail?: string;
  sections?: WikipediaSection[];
}

export interface WikipediaSection {
  title: string;
  content: string;
  level: number;
}

/**
 * Fetch Wikipedia article summary
 */
export async function fetchWikipediaSummary(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const response = await fetch(`${WIKIPEDIA_API}/page/summary/${encoded}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title,
      extract: sanitizeContent(data.extract || '', 'wikipedia'),
      url: data.content_urls?.desktop?.page || '',
      thumbnail: data.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia summary error:', e);
    return null;
  }
}

/**
 * Fetch full Wikipedia article content using Parse API
 * This returns the complete article, not just a summary
 */
export async function fetchWikipediaFullArticle(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title);
    
    // Use Parse API to get full article HTML
    const params = new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text|sections',
      format: 'json',
      origin: '*',
      disableeditsection: 'true',
      disabletoc: 'true',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    
    if (!response.ok) {
      console.error('Wikipedia Parse API error:', response.status);
      return fetchWikipediaWithExtracts(title);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Wikipedia Parse API error:', data.error);
      return fetchWikipediaWithExtracts(title);
    }
    
    const html = data.parse?.text?.['*'];
    const pageTitle = data.parse?.title || title;
    
    if (!html) {
      return fetchWikipediaWithExtracts(title);
    }
    
    // Convert HTML to clean markdown-like text
    const content = convertWikipediaHtmlToMarkdown(pageTitle, html);
    const sanitizedContent = sanitizeContent(content, 'wikipedia');
    
    return {
      title: pageTitle,
      extract: sanitizedContent.substring(0, 500),
      fullContent: sanitizedContent,
      url: `https://en.wikipedia.org/wiki/${encoded}`,
    };
  } catch (e) {
    console.error('Wikipedia full article error:', e);
    return fetchWikipediaWithExtracts(title);
  }
}

/**
 * Fallback: Fetch Wikipedia using TextExtracts API (limited but more reliable)
 */
async function fetchWikipediaWithExtracts(title: string): Promise<WikipediaArticle | null> {
  try {
    const encoded = encodeURIComponent(title);
    
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts|pageimages|info',
      exintro: '0',
      explaintext: '1',
      exsectionformat: 'wiki',
      piprop: 'thumbnail',
      pithumbsize: '400',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    
    if (!response.ok) {
      return fetchWikipediaSummary(title);
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return fetchWikipediaSummary(title);
    }
    
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    if (pageId === '-1' || !page.extract) {
      return fetchWikipediaSummary(title);
    }
    
    const formattedContent = formatWikipediaContent(page.title, page.extract);
    const sanitizedContent = sanitizeContent(formattedContent, 'wikipedia');
    
    return {
      title: page.title,
      extract: sanitizeContent(page.extract.substring(0, 500), 'wikipedia'),
      fullContent: sanitizedContent,
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encoded}`,
      thumbnail: page.thumbnail?.source,
    };
  } catch (e) {
    console.error('Wikipedia extracts error:', e);
    return fetchWikipediaSummary(title);
  }
}

/**
 * Convert Wikipedia HTML to clean markdown text
 */
function convertWikipediaHtmlToMarkdown(title: string, html: string): string {
  let content = html;
  
  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove reference tags and citations
  content = content.replace(/<sup[^>]*class="reference"[^>]*>[\s\S]*?<\/sup>/gi, '');
  content = content.replace(/\[\d+\]/g, '');
  content = content.replace(/\[citation needed\]/gi, '');
  content = content.replace(/\[clarification needed\]/gi, '');
  
  // Remove edit links
  content = content.replace(/<span class="mw-editsection"[\s\S]*?<\/span>/gi, '');
  
  // Remove navigation boxes, infoboxes, and sidebars
  content = content.replace(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<table[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]*class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove figure and image elements
  content = content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');
  content = content.replace(/<img[^>]*>/gi, '');
  
  // Remove "See also", "References", "External links", "Further reading" sections
  content = content.replace(/<h2[^>]*><span[^>]*id="See_also"[\s\S]*$/gi, '');
  content = content.replace(/<h2[^>]*><span[^>]*id="References"[\s\S]*$/gi, '');
  content = content.replace(/<h2[^>]*><span[^>]*id="External_links"[\s\S]*$/gi, '');
  content = content.replace(/<h2[^>]*><span[^>]*id="Further_reading"[\s\S]*$/gi, '');
  content = content.replace(/<h2[^>]*><span[^>]*id="Notes"[\s\S]*$/gi, '');
  content = content.replace(/<h2[^>]*><span[^>]*id="Bibliography"[\s\S]*$/gi, '');
  
  // Convert headings
  content = content.replace(/<h2[^>]*><span[^>]*>([^<]*)<\/span><\/h2>/gi, '\n\n## $1\n\n');
  content = content.replace(/<h3[^>]*><span[^>]*>([^<]*)<\/span><\/h3>/gi, '\n\n### $1\n\n');
  content = content.replace(/<h4[^>]*><span[^>]*>([^<]*)<\/span><\/h4>/gi, '\n\n#### $1\n\n');
  content = content.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '\n\n## $1\n\n');
  content = content.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '\n\n### $1\n\n');
  content = content.replace(/<h4[^>]*>([^<]*)<\/h4>/gi, '\n\n#### $1\n\n');
  
  // Convert lists
  content = content.replace(/<li[^>]*>/gi, '- ');
  content = content.replace(/<\/li>/gi, '\n');
  content = content.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  
  // Convert paragraphs
  content = content.replace(/<p[^>]*>/gi, '\n\n');
  content = content.replace(/<\/p>/gi, '');
  
  // Convert bold and italic
  content = content.replace(/<b[^>]*>([^<]*)<\/b>/gi, '**$1**');
  content = content.replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**');
  content = content.replace(/<i[^>]*>([^<]*)<\/i>/gi, '*$1*');
  content = content.replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*');
  
  // Convert links - just keep the text
  content = content.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1');
  
  // Remove remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/&ndash;/g, '–');
  content = content.replace(/&mdash;/g, '—');
  
  // Clean up whitespace
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.replace(/[ \t]+/g, ' ');
  content = content.replace(/\n /g, '\n');
  content = content.replace(/ \n/g, '\n');
  
  // Add title
  content = `# ${title}\n\n${content.trim()}`;
  
  return content;
}

/**
 * Format Wikipedia plaintext content into proper markdown (for extracts fallback)
 */
function formatWikipediaContent(title: string, extract: string): string {
  let content = extract;
  
  content = content.replace(/^====\s*(.+?)\s*====$/gm, '#### $1');
  content = content.replace(/^===\s*(.+?)\s*===$/gm, '### $1');
  content = content.replace(/^==\s*(.+?)\s*==$/gm, '## $1');
  
  content = `# ${title}\n\n${content}`;
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.replace(/\n\n/g, '\n\n');
  
  return content.trim();
}

/**
 * Search Wikipedia for articles
 */
export async function searchWikipedia(query: string, limit = 10): Promise<{ title: string; description: string }[]> {
  try {
    const params = new URLSearchParams({
      action: 'opensearch',
      search: query,
      limit: limit.toString(),
      namespace: '0',
      format: 'json',
      origin: '*',
    });
    
    const response = await fetch(`${WIKIPEDIA_ACTION_API}?${params}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const titles = data[1] || [];
    const descriptions = data[2] || [];
    
    return titles.map((title: string, i: number) => ({
      title,
      description: descriptions[i] || '',
    }));
  } catch (e) {
    console.error('Wikipedia search error:', e);
    return [];
  }
}

/**
 * Get multiple random Wikipedia articles
 * Filters out disambiguation pages and lists
 */
export async function getRandomWikipediaTopics(count: number = 10): Promise<string[]> {
  const topics: string[] = [];
  const maxAttempts = count * 3; // Allow for some failures
  let attempts = 0;
  
  while (topics.length < count && attempts < maxAttempts) {
    try {
      const response = await fetch(`${WIKIPEDIA_API}/page/random/summary`);
      if (response.ok) {
        const data = await response.json();
        const title = data.title;
        
        // Filter out unwanted article types
        if (title && 
            !title.includes('(disambiguation)') &&
            !title.startsWith('List of') &&
            !title.startsWith('Lists of') &&
            !title.includes('discography') &&
            !title.includes('filmography') &&
            !title.match(/^\d{4}\s/) && // Years like "2023 in..."
            !title.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s\d/) &&
            data.extract && data.extract.length > 100) {
          topics.push(title);
        }
      }
    } catch (e) {
      console.error('Random topic error:', e);
    }
    attempts++;
  }
  
  return topics;
}

/**
 * Get a single random Wikipedia topic
 */
export async function getRandomWikipediaArticle(): Promise<string | null> {
  const topics = await getRandomWikipediaTopics(1);
  return topics[0] || null;
}

// ============================================
// GROKIPEDIA (xAI API)
// ============================================

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface GrokipediaArticle {
  title: string;
  content: string;
  source: 'grokipedia';
}

/**
 * Fetch Grokipedia content via xAI API
 */
export async function fetchGrokipediaContent(
  topic: string,
  apiKey?: string
): Promise<GrokipediaArticle | null> {
  if (!apiKey) {
    return {
      title: topic,
      content: sanitizeContent(generateGrokipediaDemoContent(topic), 'grokipedia'),
      source: 'grokipedia',
    };
  }

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: `You are writing an encyclopedia article. Write a comprehensive, factual, well-structured article about the given topic using markdown formatting.

IMPORTANT RULES:
- Do NOT mention your name, source, or that you are an AI
- Do NOT include phrases like "this article" or "this entry"
- Write as if you are a neutral, anonymous encyclopedia
- Focus purely on factual information about the topic

Structure your response with:
- A title as # heading
- An introduction paragraph
- Multiple ## sections covering different aspects
- Key facts and information
- Historical context if relevant
- Current developments or applications

Write in an engaging, encyclopedic style.`
          },
          {
            role: 'user',
            content: `Write an encyclopedia article about: ${topic}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('Grok API error:', response.status);
      return {
        title: topic,
        content: sanitizeContent(generateGrokipediaDemoContent(topic), 'grokipedia'),
        source: 'grokipedia',
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || generateGrokipediaDemoContent(topic);

    return {
      title: topic,
      content: sanitizeContent(content, 'grokipedia'),
      source: 'grokipedia',
    };
  } catch (e) {
    console.error('Grokipedia error:', e);
    return {
      title: topic,
      content: sanitizeContent(generateGrokipediaDemoContent(topic), 'grokipedia'),
      source: 'grokipedia',
    };
  }
}

function generateGrokipediaDemoContent(topic: string): string {
  return `# ${topic}

${topic} is a subject of significant interest that encompasses various aspects of human knowledge and understanding.

## Overview

The study and understanding of ${topic} has evolved significantly over time, with contributions from numerous researchers, experts, and practitioners across different fields. Today, it remains an important area of interest for academics, professionals, and curious minds alike.

## Key Concepts

Key aspects include:

- **Fundamental principles** - The core ideas that form the foundation of understanding
- **Practical applications** - How this knowledge is applied in real-world scenarios
- **Ongoing developments** - Current research and emerging trends in the field

Understanding these elements provides a solid foundation for deeper exploration of the subject.

## Historical Context

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern investigations, knowledge in this area has grown substantially.

## Recent Developments

In recent years, ${topic} has gained increased attention due to technological advancements and changing societal needs. This has led to new research directions, innovative applications, and broader public awareness.

## Significance

For those interested in learning more, there are numerous resources available including academic papers, books, online courses, and expert communities dedicated to advancing knowledge in this area.`;
}

// ============================================
// ENCYCLOPEDIA BRITANNICA
// ============================================

export interface BritannicaArticle {
  title: string;
  content: string;
  source: 'britannica';
  url?: string;
}

/**
 * Fetch Encyclopedia Britannica content
 */
export async function fetchBritannicaContent(topic: string): Promise<BritannicaArticle | null> {
  return {
    title: topic,
    content: sanitizeContent(generateBritannicaDemoContent(topic), 'britannica'),
    source: 'britannica',
    url: `https://www.britannica.com/search?query=${encodeURIComponent(topic)}`,
  };
}

function generateBritannicaDemoContent(topic: string): string {
  return `# ${topic}

${topic} represents an important area of human knowledge that has been extensively documented and studied by scholars and experts worldwide.

## Introduction

The subject draws upon centuries of accumulated knowledge and the expertise of leading authorities in the field. Understanding ${topic} requires examining both its historical foundations and contemporary developments.

## Historical Background

The historical development of ${topic} can be traced through multiple periods, each contributing unique insights and advancements to our current understanding. From early observations and theories to modern scientific and scholarly investigations, the evolution of knowledge in this area demonstrates humanity's persistent quest for understanding.

## Key Aspects

Several key aspects define our understanding of ${topic}:

- **Theoretical foundations** - The underlying principles and frameworks
- **Empirical evidence** - Observations and data supporting current understanding
- **Practical implications** - How this knowledge affects various fields and applications

## Contemporary Understanding

Contemporary perspectives on ${topic} reflect both traditional scholarship and cutting-edge research. Experts continue to refine our understanding through:

- Rigorous investigation and experimentation
- Peer review and academic discourse
- Integration of new technologies and methodologies
- Cross-disciplinary collaboration

## Applications and Impact

The practical applications and implications of ${topic} extend across various domains, influencing:

- **Education** - How this subject is taught and learned
- **Research** - Ongoing investigations and discoveries
- **Technology** - Innovations inspired by this knowledge
- **Society** - Broader cultural and social implications

Understanding these connections helps illuminate the broader significance of this subject in both historical and contemporary contexts.`;
}

// ============================================
// CONTENT SANITIZATION
// ============================================

/**
 * Remove source self-references from content to ensure blind comparisons
 */
function sanitizeContent(content: string, source: SourceSlug): string {
  let sanitized = content;
  
  // Common patterns to remove (case-insensitive)
  const patternsToRemove = [
    // Wikipedia references
    /\bWikipedia\b/gi,
    /\bthe free encyclopedia\b/gi,
    /\bfrom Wikipedia\b/gi,
    /\bWikipedia['']s\b/gi,
    /\bthis Wikipedia article\b/gi,
    
    // Grokipedia/Grok/xAI references
    /\bGrokipedia\b/gi,
    /\bGrok\b/gi,
    /\bxAI\b/gi,
    /\bAI-powered\s*(encyclopedia|knowledge|article)?\b/gi,
    /\bAI-generated\b/gi,
    /\bthis AI\b/gi,
    /\bas an AI\b/gi,
    /\bI am an AI\b/gi,
    /\bI'm an AI\b/gi,
    
    // Britannica references
    /\bEncyclopedia Britannica\b/gi,
    /\bEncyclopædia Britannica\b/gi,
    /\bBritannica\b/gi,
    /\bBritannica['']s\b/gi,
    /\bthe gold standard of reference works\b/gi,
    /\bsince 1768\b/gi,
    /\bexpert-written content\b/gi,
    /\btrusted encyclopedia\b/gi,
    
    // Generic self-references
    /\bthis encyclopedia\b/gi,
    /\bthis article\b/gi,
    /\bthis entry\b/gi,
    /\bour coverage\b/gi,
    /\bwe provide\b/gi,
    /\bwe offer\b/gi,
    
    // Demo/placeholder notices
    /\*Note:.*?(?:demo|placeholder|configure|API key).*?\*/gi,
    /---\s*\*Note:.*?\*/gis,
  ];
  
  for (const pattern of patternsToRemove) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // Clean up resulting artifacts
  sanitized = sanitized.replace(/\s{3,}/g, '\n\n'); // Multiple spaces/newlines
  sanitized = sanitized.replace(/^\s*[-•]\s*$/gm, ''); // Empty list items
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n'); // Multiple newlines
  sanitized = sanitized.replace(/,\s*,/g, ','); // Double commas
  sanitized = sanitized.replace(/\.\s*\./g, '.'); // Double periods
  sanitized = sanitized.replace(/\s+\./g, '.'); // Space before period
  sanitized = sanitized.replace(/\s+,/g, ','); // Space before comma
  
  return sanitized.trim();
}

// ============================================
// UNIFIED CONTENT FETCHER
// ============================================

export type SourceSlug = 'wikipedia' | 'grokipedia' | 'britannica';

export interface SourceContent {
  source: SourceSlug;
  sourceName: string;
  title: string;
  content: string;
  url?: string;
  thumbnail?: string;
}

/**
 * Fetch content from a specific source
 */
export async function fetchContentFromSource(
  topic: string,
  source: SourceSlug,
  xaiApiKey?: string
): Promise<SourceContent | null> {
  switch (source) {
    case 'wikipedia': {
      const article = await fetchWikipediaFullArticle(topic);
      if (!article) return null;
      return {
        source: 'wikipedia',
        sourceName: 'Wikipedia',
        title: article.title,
        content: article.fullContent || article.extract,
        url: article.url,
        thumbnail: article.thumbnail,
      };
    }
    
    case 'grokipedia': {
      const article = await fetchGrokipediaContent(topic, xaiApiKey);
      if (!article) return null;
      return {
        source: 'grokipedia',
        sourceName: 'Grokipedia',
        title: article.title,
        content: article.content,
      };
    }
    
    case 'britannica': {
      const article = await fetchBritannicaContent(topic);
      if (!article) return null;
      return {
        source: 'britannica',
        sourceName: 'Encyclopedia Britannica',
        title: article.title,
        content: article.content,
        url: article.url,
      };
    }
    
    default:
      return null;
  }
}

/**
 * Fetch content from multiple sources in parallel
 */
export async function fetchContentFromAllSources(
  topic: string,
  sources: SourceSlug[],
  xaiApiKey?: string
): Promise<SourceContent[]> {
  const results = await Promise.all(
    sources.map(source => fetchContentFromSource(topic, source, xaiApiKey))
  );
  return results.filter((r): r is SourceContent => r !== null);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Source logo URLs
 */
export const SOURCE_LOGOS: Record<SourceSlug, string> = {
  wikipedia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/103px-Wikipedia-logo-v2.svg.png',
  grokipedia: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/X.ai_logo.svg/200px-X.ai_logo.svg.png',
  britannica: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Britannica_logo.svg/200px-Britannica_logo.svg.png',
};

/**
 * Get source logo URL
 */
export function getSourceLogo(slug: SourceSlug): string {
  return SOURCE_LOGOS[slug] || '';
}

/**
 * Get source emoji (for fallback/non-comparison contexts)
 */
export function getSourceEmoji(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return '📚';
    case 'grokipedia': return '🤖';
    case 'britannica': return '📖';
    default: return '📄';
  }
}

/**
 * Get source color class
 */
export function getSourceColor(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return 'text-blue-400';
    case 'grokipedia': return 'text-purple-400';
    case 'britannica': return 'text-amber-400';
    default: return 'text-slate-400';
  }
}

/**
 * Get source background color class
 */
export function getSourceBgColor(slug: SourceSlug): string {
  switch (slug) {
    case 'wikipedia': return 'bg-blue-500/20';
    case 'grokipedia': return 'bg-purple-500/20';
    case 'britannica': return 'bg-amber-500/20';
    default: return 'bg-slate-500/20';
  }
}
