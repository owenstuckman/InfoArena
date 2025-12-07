# Contributing to Knowledge Arena

Thank you for your interest in contributing to Knowledge Arena! This guide will walk you through how to add new knowledge sources to the platform.

## Table of Contents

- [Overview](#overview)
- [Adding a New Source](#adding-a-new-source)
  - [Step 1: Database Setup](#step-1-database-setup)
  - [Step 2: Content Service](#step-2-content-service)
  - [Step 3: Logo and Branding](#step-3-logo-and-branding)
  - [Step 4: Testing](#step-4-testing)
- [Source Requirements](#source-requirements)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)

## Overview

Knowledge Arena compares content from different knowledge sources (encyclopedias, AI systems, etc.) in a blind A/B test format. Users vote on which source provides better information, and sources are ranked using a Glicko-2 rating system.

### Architecture

```
src/lib/services/content.ts    - Content fetching and sanitization
src/lib/services/topics.ts     - Random topic generation
src/routes/arena/+page.svelte  - Main comparison interface
supabase/migrations/           - Database schema
```

## Adding a New Source

### Step 1: Database Setup

Create a new SQL migration file in `supabase/migrations/`:

```sql
-- supabase/migrations/003_add_new_source.sql

-- Add the new source
INSERT INTO sources (
  id,
  name,
  slug,
  description,
  rating,
  rating_deviation,
  volatility,
  is_active
) VALUES (
  gen_random_uuid(),
  'Your Source Name',
  'your-source-slug',  -- lowercase, hyphenated
  'Brief description of the source',
  1500,    -- Starting Glicko-2 rating
  350,     -- Starting rating deviation (high = uncertain)
  0.06,    -- Starting volatility
  true     -- Set to true to enable
);
```

Run the migration:
```bash
npx supabase db push
```

### Step 2: Content Service

Edit `src/lib/services/content.ts` to add your source:

#### 2.1 Add the Source Slug

```typescript
// Add to the SourceSlug type
export type SourceSlug = 'wikipedia' | 'grokipedia' | 'britannica' | 'your-source';
```

#### 2.2 Create the Fetch Function

```typescript
// ============================================
// YOUR SOURCE NAME
// ============================================

export interface YourSourceArticle {
  title: string;
  content: string;
  source: 'your-source';
  url?: string;
}

/**
 * Fetch content from Your Source
 * 
 * @param topic - The topic to search for
 * @param apiKey - Optional API key if required
 * @returns Article content or null if not found
 */
export async function fetchYourSourceContent(
  topic: string,
  apiKey?: string
): Promise<YourSourceArticle | null> {
  // Option A: API-based source
  if (apiKey) {
    try {
      const response = await fetch('https://api.yoursource.com/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: topic }),
      });

      if (!response.ok) {
        console.error('Your Source API error:', response.status);
        return null;
      }

      const data = await response.json();
      const content = data.content || '';

      return {
        title: topic,
        content: sanitizeContent(formatContent(content), 'your-source'),
        source: 'your-source',
        url: data.url,
      };
    } catch (e) {
      console.error('Your Source error:', e);
      return null;
    }
  }

  // Option B: Demo/fallback content
  return {
    title: topic,
    content: sanitizeContent(generateYourSourceDemoContent(topic), 'your-source'),
    source: 'your-source',
  };
}

/**
 * Generate demo content for testing without API
 */
function generateYourSourceDemoContent(topic: string): string {
  return `# ${topic}

${topic} is a subject covered by Your Source with comprehensive information.

## Overview

This is demo content for Your Source. In production with proper API access, 
this would display actual content from the source.

## Key Information

- Fundamental concepts and principles
- Historical context and development
- Current applications and relevance

## Additional Details

Your Source provides expert-reviewed information on this topic, 
drawing from authoritative references and scholarly sources.`;
}
```

#### 2.3 Register in Content Fetcher

Update the `fetchContentFromSource` function:

```typescript
export async function fetchContentFromSource(
  topic: string,
  source: SourceSlug,
  xaiApiKey?: string,
  yourSourceApiKey?: string  // Add your API key param
): Promise<SourceContent | null> {
  switch (source) {
    // ... existing cases ...
    
    case 'your-source': {
      const article = await fetchYourSourceContent(topic, yourSourceApiKey);
      if (!article) return null;
      return {
        source: 'your-source',
        sourceName: 'Your Source Name',
        title: article.title,
        content: article.content,
        url: article.url,
      };
    }
    
    default:
      return null;
  }
}
```

#### 2.4 Add Sanitization Patterns

If your source has identifying text that should be removed for blind comparisons, add patterns to `sanitizeContent`:

```typescript
function sanitizeContent(content: string, source: SourceSlug): string {
  // ... existing code ...
  
  const patternsToRemove = [
    // ... existing patterns ...
    
    // Your Source references
    /\bYour Source Name\b/gi,
    /\bYourSource\b/gi,
    /\bpowered by Your Source\b/gi,
    // Add any identifying phrases your source includes
  ];
  
  // ... rest of function ...
}
```

### Step 3: Logo and Branding

#### 3.1 Add Logo URL

```typescript
export const SOURCE_LOGOS: Record<SourceSlug, string> = {
  // ... existing logos ...
  'your-source': 'https://example.com/your-source-logo.png',
};
```

**Logo Requirements:**
- PNG or SVG format
- Transparent background preferred
- At least 100x100 pixels
- Hosted on reliable CDN (Wikimedia Commons, official CDN, etc.)

#### 3.2 Add Color Theme

```typescript
export function getSourceColor(slug: SourceSlug): string {
  switch (slug) {
    // ... existing colors ...
    case 'your-source': return 'text-green-400'; // Choose a distinct color
    default: return 'text-slate-400';
  }
}

export function getSourceBgColor(slug: SourceSlug): string {
  switch (slug) {
    // ... existing colors ...
    case 'your-source': return 'bg-green-500/20';
    default: return 'bg-slate-500/20';
  }
}
```

### Step 4: Testing

#### 4.1 Local Testing

```bash
# Start development server
npm run dev

# Test the new source
# 1. Go to /arena
# 2. Search for various topics
# 3. Verify your source appears in comparisons
# 4. Check that content is properly sanitized (no source name visible)
```

#### 4.2 Verify Content Quality

Check that your source:
- [ ] Returns content for common topics
- [ ] Handles missing topics gracefully (returns null)
- [ ] Content is properly formatted as markdown
- [ ] Source-identifying text is removed
- [ ] Tables and lists render correctly
- [ ] Content length is reasonable (not too short or too long)

#### 4.3 Test in Blend Mode

```bash
# Go to /blend
# 1. Enable your new source
# 2. Adjust weights
# 3. Verify content is included in blended output
```

## Source Requirements

### Content Guidelines

1. **Objectivity**: Content should be factual and encyclopedic
2. **No Self-Reference**: Content must not mention the source name
3. **Markdown Format**: Output should be valid markdown
4. **Reasonable Length**: Aim for 500-5000 characters per article
5. **Table Support**: Preserve tabular data when present

### Technical Requirements

1. **Error Handling**: Gracefully handle API failures
2. **Rate Limiting**: Respect API rate limits
3. **Caching**: Consider caching responses for performance
4. **Timeouts**: Set reasonable timeouts (10-30 seconds)

### Legal Requirements

1. **API Terms**: Ensure compliance with source API terms of service
2. **Attribution**: Note if attribution is required
3. **Content Rights**: Verify content can be displayed in this context

## Code Style

- Use TypeScript with proper types
- Follow existing code patterns
- Add JSDoc comments for functions
- Use meaningful variable names
- Handle errors appropriately

```typescript
/**
 * Fetch content from Example Source
 * 
 * @param topic - The topic to search for
 * @returns Article content or null if not found
 * @throws Never - errors are caught and logged
 */
export async function fetchExampleContent(topic: string): Promise<ExampleArticle | null> {
  // Implementation
}
```

## Submitting a Pull Request

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b add-source-name
   ```

3. **Make your changes**
   - Add database migration
   - Implement content fetching
   - Add logo and colors
   - Test thoroughly

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add NewSource as knowledge source"
   ```

5. **Push and create PR**
   ```bash
   git push origin add-source-name
   ```

6. **PR Description Template**
   ```markdown
   ## New Source: [Source Name]
   
   ### Description
   Brief description of the source and why it's valuable.
   
   ### API Details
   - API endpoint: [URL]
   - Authentication: [Method]
   - Rate limits: [Limits]
   
   ### Checklist
   - [ ] Database migration added
   - [ ] Content fetching implemented
   - [ ] Sanitization patterns added
   - [ ] Logo and colors configured
   - [ ] Tested locally
   - [ ] Demo mode works without API key
   
   ### Screenshots
   [Include screenshots of the source in action]
   ```

## Environment Variables

If your source requires an API key, document it in `.env.example`:

```bash
# Your Source API Key (optional, enables live content)
YOUR_SOURCE_API_KEY=
```

And update the README with setup instructions.

## Questions?

- Open an issue for questions or suggestions
- Tag maintainers for review

Thank you for contributing to Knowledge Arena! 🎉
