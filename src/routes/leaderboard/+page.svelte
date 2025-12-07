<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { leaderboardStore, isLeaderboardLoading } from '$lib/stores/leaderboard';
  import { getRatingInterval } from '$lib/services/glicko2';
  import { getSourceLogo, getSourceColor, type SourceSlug } from '$lib/services/content';

  onMount(async () => {
    await leaderboardStore.load();
    leaderboardStore.subscribeRealtime();
  });

  onDestroy(() => {
    leaderboardStore.unsubscribeRealtime();
  });

  function getRankDisplay(rank: number): string {
    return `#${rank}`;
  }

  function getConfidenceInterval(rating: number, rd: number): string {
    const interval = getRatingInterval({ mu: rating, phi: rd, sigma: 0.06 });
    return `${interval.low} - ${interval.high}`;
  }

  // Helper to avoid TypeScript 'as' in template
  function getLogo(slug: string): string {
    return getSourceLogo(slug as SourceSlug);
  }
  
  function getColor(slug: string): string {
    return getSourceColor(slug as SourceSlug);
  }
</script>

<svelte:head>
  <title>Leaderboard - WikiArena</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Leaderboard</h1>
    <p class="text-slate-400 text-sm">Global rankings based on community votes</p>
    {#if $leaderboardStore.lastUpdated}
      <p class="text-xs text-slate-500 mt-2">
        Last updated: {$leaderboardStore.lastUpdated.toLocaleTimeString()}
        <span class="inline-flex items-center ml-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="ml-1">Live</span>
        </span>
      </p>
    {/if}
  </div>

  <!-- Loading State -->
  {#if $isLeaderboardLoading}
    <div class="space-y-4">
      {#each [1, 2, 3] as _}
        <div class="leaderboard-row">
          <div class="skeleton h-10 w-10 rounded-full"></div>
          <div class="flex-1">
            <div class="skeleton h-5 w-32 mb-2"></div>
            <div class="skeleton h-4 w-24"></div>
          </div>
          <div class="skeleton h-8 w-20"></div>
        </div>
      {/each}
    </div>

  <!-- Error State -->
  {:else if $leaderboardStore.error}
    <div class="arena-card text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h2 class="text-lg font-semibold mb-2">Failed to load leaderboard</h2>
      <p class="text-slate-400 text-sm mb-6">{$leaderboardStore.error}</p>
      <button 
        class="vote-btn vote-btn-primary"
        on:click={() => leaderboardStore.load()}
      >
        Try Again
      </button>
    </div>

  <!-- Leaderboard -->
  {:else}
    <div class="space-y-3">
      {#each $leaderboardStore.entries as entry, index (entry.id)}
        {@const rank = index + 1}
        <div 
          class="leaderboard-row {rank === 1 ? 'leaderboard-row-top' : ''}"
          style="animation-delay: {index * 50}ms"
        >
          <!-- Rank -->
          <div class="flex-shrink-0 w-12 text-center">
            <span class="text-lg font-bold {rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'}">#{rank}</span>
          </div>

          <!-- Source Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-white/10 p-1.5 flex items-center justify-center flex-shrink-0">
                <img 
                  src={getLogo(entry.slug)} 
                  alt={entry.name}
                  class="max-w-full max-h-full object-contain"
                />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold truncate {getColor(entry.slug)}">{entry.name}</h3>
                <p class="text-sm text-slate-500 truncate">
                  {entry.total_matches} matches · {entry.win_rate}% win rate
                </p>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="hidden sm:flex items-center gap-6 text-sm">
            <div class="text-center">
              <div class="text-emerald-400 font-semibold">{entry.total_wins}</div>
              <div class="text-slate-500 text-xs">Wins</div>
            </div>
            <div class="text-center">
              <div class="text-red-400 font-semibold">{entry.total_losses}</div>
              <div class="text-slate-500 text-xs">Losses</div>
            </div>
            <div class="text-center">
              <div class="text-slate-400 font-semibold">{entry.total_ties}</div>
              <div class="text-slate-500 text-xs">Ties</div>
            </div>
          </div>

          <!-- Rating -->
          <div class="text-right">
            <div class="text-xl font-bold text-gradient">
              {Math.round(entry.rating)}
            </div>
            <div class="text-xs text-slate-500">
              ±{Math.round(entry.rating_deviation)}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Empty State -->
    {#if $leaderboardStore.entries.length === 0}
      <div class="arena-card text-center py-12">
        <div class="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold mb-2">No rankings yet</h2>
        <p class="text-slate-400 text-sm mb-6">Be the first to vote and establish the rankings!</p>
        <a href="/arena" class="vote-btn vote-btn-primary">
          Enter the Arena
        </a>
      </div>
    {/if}

    <!-- Legend -->
    {#if $leaderboardStore.entries.length > 0}
      <div class="mt-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
        <h3 class="font-semibold mb-3 text-sm text-slate-400">Understanding Ratings</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-amber-400 font-semibold">Rating</span>
            <span class="text-slate-400"> — Skill estimate using Glicko-2 system. Higher is better.</span>
          </div>
          <div>
            <span class="text-amber-400 font-semibold">±RD</span>
            <span class="text-slate-400"> — Rating Deviation. Lower means more confidence in the rating.</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .leaderboard-row {
    animation: fadeInUp 0.5s ease-out forwards;
    opacity: 0;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
