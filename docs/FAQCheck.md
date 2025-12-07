# FAQ Verification Checklist

This document verifies that every claim made in the FAQ is accurate and shows where in the codebase it's implemented.

---

## Rating System Section

### 1. "Glicko-2 is a rating system created by Professor Mark Glickman"
**Status:** ✅ TRUE  
**Source:** External fact - Mark Glickman's paper at http://www.glicko.net/glicko/glicko2.pdf  
**Code Reference:** `src/lib/services/glicko2.ts` line 2-3 comments reference the paper

### 2. "We track three values: Rating, Rating Deviation, Volatility"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 27-31
```typescript
export interface Rating {
  mu: number;      // Rating (Glicko scale: ~1500)
  phi: number;     // Rating deviation (uncertainty)
  sigma: number;   // Volatility
}
```

### 3. "Every source starts at 1500"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 21-25
```typescript
export const DEFAULTS = {
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.06,
} as const;
```

### 4. "Rating Deviation starts at 350"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `DEFAULTS.ratingDeviation: 350`

### 5. "More votes = more confidence (lower RD)"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 200-206  
The `updateRating` function reduces phi (RD) after each match via:
```typescript
const phiPrime = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
```

### 6. "Winning against a top-rated source is worth more"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 73-75  
The `expectedScore` function calculates expected outcome based on rating difference:
```typescript
function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}
```
Upsets (beating higher-rated opponent) result in larger rating changes.

### 7. "Ties cause smaller changes than wins/losses"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/glicko2.ts` lines 276-289
```typescript
case 'tie':
  scoreA = 0.5;
  scoreB = 0.5;
  break;
```
The 0.5 score results in smaller delta than 1.0 (win) or 0.0 (loss).

### 8. "200-point gap = ~75% win probability"
**Status:** ✅ TRUE (approximately)  
**Code Reference:** `src/lib/services/glicko2.ts` `predictOutcome` function (lines 225-230)  
With mu1=1600, mu2=1400, the math works out to approximately 0.75-0.76 probability.

---

## Fairness Section

### 9. "Sources are hidden until after you vote"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte` lines 529-565
- During comparison phase, sources shown as "Source A" and "Source B"
- Line 536: `<span class="text-lg font-semibold text-blue-400">Source A</span>`
- Line 524: `<p class="text-xs text-slate-500 mt-2">Sources are hidden until you vote</p>`

### 10. "Topics are randomized"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/topics.ts`
- `getRandomTopic()` function selects random topics from Wikipedia
- `getRandomCuratedTopic()` selects from curated list randomly

### 11. "Links are disabled during comparison, enabled after"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte`
- Lines 540-545: `disableLinks={true}` during comparison
- After voting (reveal phase), `disableLinks={false}` in expandable section

### 12. "Links show toast message when clicked during comparison"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte` lines 797-815
```svelte
{#if showLinkToast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
    ...
    <div class="text-sm font-medium text-white">Links disabled during comparison</div>
    <div class="text-xs text-slate-400">Vote first to reveal sources and enable links</div>
```

### 13. "You can search for specific topics"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/arena/+page.svelte` lines 97-123  
`handleSearch()` function calls Wikipedia API to search topics

### 14. "We track category ratings (Accuracy, Readability, Depth, Objectivity)"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/types/database.ts` lines 3-6
```typescript
export type RatingCategory = 'overall' | 'accuracy' | 'readability' | 'comprehensiveness' | 'objectivity';
```
Also in `src/routes/leaderboard/+page.svelte` with category tabs.

---

## Quality Metrics Section

### 15. "Accuracy weight is 30%"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 35-41
```typescript
const METRIC_WEIGHTS = {
  accuracy: 0.30,
  readability: 0.20,
  depth: 0.25,
  objectivity: 0.15,
  citations: 0.10,
};
```

### 16. "Depth weight is 25%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `depth: 0.25`

### 17. "Readability weight is 20%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `readability: 0.20`

### 18. "Objectivity weight is 15%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `objectivity: 0.15`

### 19. "Citations weight is 10%"
**Status:** ✅ TRUE  
**Code Reference:** Same as above, `citations: 0.10`

### 20. "Britannica gets higher base accuracy than AI content"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 84-91
```typescript
let baseAccuracy = 0.7;
if (sourceName.toLowerCase().includes('britannica')) {
  baseAccuracy = 0.85;
} else if (sourceName.toLowerCase().includes('wikipedia')) {
  baseAccuracy = 0.80;
} else if (sourceName.toLowerCase().includes('grok')) {
  baseAccuracy = 0.75;
}
```

### 21. "Readability penalizes long sentences"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 68-72
```typescript
const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 20;
const readability = Math.max(0, Math.min(1, 1 - (avgWordsPerSentence - 15) / 30));
```

### 22. "Objectivity detects opinion words like 'best', 'terrible', 'obviously'"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 94-96
```typescript
const opinionWords = (content.match(/\b(best|worst|amazing|terrible|obviously|clearly|everyone knows)\b/gi) || []).length;
```

### 23. "Shapley values measure each source's marginal contribution"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 163-210  
`calculateShapleyValues()` function implements the Shapley formula with coalitions.

### 24. "Expected Value = 40% quality + 35% rating + 25% win rate"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/shapley.ts` lines 219-232
```typescript
const expectedValue = (
  q.overallScore * 0.4 +      // Local quality assessment
  clampedRating * 0.35 +       // Global Glicko rating
  normalizedWinRate * 0.25     // Historical win rate
);
```

---

## General Section

### 25. "Wikipedia: Community-edited encyclopedia"
**Status:** ✅ TRUE  
**External Fact:** Wikipedia is a community-edited encyclopedia.

### 26. "Encyclopedia Britannica: Expert-written, professionally edited"
**Status:** ✅ TRUE  
**External Fact:** Britannica uses expert authors and editorial review.

### 27. "Grokipedia: AI-generated content from xAI"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/services/content.ts` references xAI/Grok for content generation.

### 28. "Votes are anonymous - we never show who voted for what"
**Status:** ✅ TRUE  
**Code Reference:** `src/routes/history/+page.svelte` only shows the current user's own votes.  
Leaderboard shows aggregate data, never individual votes.

### 29. "Anonymous session ID for non-signed-up users"
**Status:** ✅ TRUE  
**Code Reference:** `src/lib/supabaseClient.ts` lines 28-44
```typescript
export function getSessionId(): string {
  if (!browser) return 'server';
  let sessionId = localStorage.getItem('wikiarena_session_id');
  if (!sessionId) {
    sessionId = 'session_' + crypto.randomUUID();
    localStorage.setItem('wikiarena_session_id', sessionId);
  }
  return sessionId;
}
```

---

## Summary

| Section | Claims | Verified | Status |
|---------|--------|----------|--------|
| Rating System | 8 | 8 | ✅ All verified |
| Fairness | 6 | 6 | ✅ All verified |
| Quality Metrics | 10 | 10 | ✅ All verified |
| General | 5 | 5 | ✅ All verified |
| **Total** | **29** | **29** | ✅ **100% verified** |

All FAQ claims are accurate and implemented in the codebase.
