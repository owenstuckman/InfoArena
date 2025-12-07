<script lang="ts">
  export let variant: 'default' | 'selected' | 'glow' = 'default';
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let clickable = false;
  
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  };
  
  const variantClasses = {
    default: 'border-slate-700/50 hover:border-slate-600/50',
    selected: 'ring-2 ring-amber-500/50 border-amber-500/50',
    glow: 'border-slate-700/50 shadow-lg shadow-amber-500/10',
  };
  
  $: classes = `
    relative rounded-2xl border bg-gradient-to-b from-slate-900 to-slate-900/50 backdrop-blur-sm
    transition-all duration-300
    ${paddingClasses[padding]}
    ${variantClasses[variant]}
    ${clickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}
  `;
</script>

<div class={classes} on:click on:keydown role={clickable ? 'button' : undefined} tabindex={clickable ? 0 : undefined}>
  <slot />
</div>
