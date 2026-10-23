import {
  computePosition,
  flip,
  shift,
  offset,
} from 'https://esm.sh/@floating-ui/dom@1.7.4';
import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  closeDelay: number;
  open: boolean;
  openDelay: number;
}

const timers = new WeakMap<
  Context,
  {
    open: ReturnType<typeof setTimeout> | null;
    close: ReturnType<typeof setTimeout> | null;
  }
>();

function getTimers(ref: Context) {
  if (!timers.has(ref)) {
    timers.set(ref, { open: null, close: null });
  }
  return timers.get(ref)!;
}

function positionTooltip(root: HTMLElement) {
  const trigger = root.querySelector<HTMLElement>(
    'button, [data-wp-on--mouseenter]',
  );
  const popup = root.querySelector<HTMLElement>('[role="tooltip"]');
  if (!trigger || !popup) return;

  computePosition(window.__bsui.getAnchor(trigger)!, popup, {
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(popup.style, { left: x + 'px', top: y + 'px' });
  });
}

function openTooltip(ctx: Context, root: HTMLElement | null | undefined) {
  ctx.open = true;
  const popup = root?.querySelector<HTMLElement>('[role="tooltip"]');
  if (popup) popup.removeAttribute('hidden');
  requestAnimationFrame(() => {
    if (root) positionTooltip(root);
  });
}

function closeTooltip(ctx: Context, root: HTMLElement | null | undefined) {
  ctx.open = false;
  const popup = root?.querySelector<HTMLElement>('[role="tooltip"]');
  if (popup) popup.setAttribute('hidden', '');
}

store('bsui/tooltip', {
  actions: {
    handleMouseEnter() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-tooltip-root]');
      const t = getTimers(ctx);
      clearTimeout(t.close!);

      if (ctx.openDelay > 0) {
        t.open = setTimeout(() => openTooltip(ctx, root), ctx.openDelay);
      } else {
        openTooltip(ctx, root);
      }
    },
    handleMouseLeave() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-tooltip-root]');
      const t = getTimers(ctx);
      clearTimeout(t.open!);

      if (ctx.closeDelay > 0) {
        t.close = setTimeout(() => closeTooltip(ctx, root), ctx.closeDelay);
      } else {
        closeTooltip(ctx, root);
      }
    },
    handleFocusIn() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-tooltip-root]');
      const t = getTimers(ctx);
      clearTimeout(t.close!);
      openTooltip(ctx, root);
    },
    handleFocusOut() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-tooltip-root]');
      const t = getTimers(ctx);
      clearTimeout(t.open!);
      closeTooltip(ctx, root);
    },
    handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        const ctx = getContext<Context>();
        const { ref } = getElement() as { ref: HTMLElement };
        const root = ref.closest<HTMLElement>('[data-bsui-tooltip-root]');
        closeTooltip(ctx, root);
      }
    },
  },
});
