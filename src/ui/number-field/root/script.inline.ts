import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  max: number | null;
  min: number | null;
  step: number;
  value: number | null;
}

function clamp(value: number, min: number | null, max: number | null) {
  if (min !== null && value < min) return min;
  if (max !== null && value > max) return max;
  return value;
}

function dispatchChange(value: number) {
  (getElement() as { ref: HTMLElement }).ref
    .closest<HTMLElement>('[role="group"]')!
    .dispatchEvent(
      new CustomEvent('change', { bubbles: true, detail: { value } }),
    );
}

store('bsui/number-field', {
  callbacks: {
    syncValue() {
      window.__bsui.syncValue('bsui/number-field', getContext, store);
    },
  },
  state: {
    get displayValue() {
      const { value } = getContext<Context>();
      return value !== null ? String(value) : '';
    },
  },
  actions: {
    increment() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      const current = ctx.value !== null ? ctx.value : 0;
      ctx.value = clamp(current + ctx.step, ctx.min, ctx.max);
      dispatchChange(ctx.value);
    },
    decrement() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      const current = ctx.value !== null ? ctx.value : 0;
      ctx.value = clamp(current - ctx.step, ctx.min, ctx.max);
      dispatchChange(ctx.value);
    },
    handleInput(event: Event) {
      const ctx = getContext<Context>();
      const parsed = parseFloat((event.target as HTMLInputElement).value);
      if (!isNaN(parsed)) {
        ctx.value = clamp(parsed, ctx.min, ctx.max);
        dispatchChange(ctx.value);
      }
    },
    handleKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;

      const multiplier = event.shiftKey ? 10 : 1;
      const delta = ctx.step * multiplier;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const current = ctx.value !== null ? ctx.value : 0;
        ctx.value = clamp(current + delta, ctx.min, ctx.max);
        dispatchChange(ctx.value);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const current = ctx.value !== null ? ctx.value : 0;
        ctx.value = clamp(current - delta, ctx.min, ctx.max);
        dispatchChange(ctx.value);
      }
    },
  },
});
