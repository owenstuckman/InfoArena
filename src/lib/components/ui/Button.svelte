<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let href: string | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 focus:ring-amber-500',
    secondary: 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-100 focus:ring-slate-500',
    ghost: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 focus:ring-slate-500',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-5 py-2.5 text-base gap-2',
    lg: 'px-8 py-4 text-lg gap-2.5',
  };
  
  $: classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`;
  
  function handleClick(e: MouseEvent) {
    if (!disabled && !loading) {
      dispatch('click', e);
    }
  }
</script>

{#if href && !disabled}
  <a {href} class={classes} class:opacity-50={loading}>
    {#if loading}
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </a>
{:else}
  <button
    {type}
    {disabled}
    class={classes}
    class:opacity-50={loading}
    on:click={handleClick}
  >
    {#if loading}
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </button>
{/if}
