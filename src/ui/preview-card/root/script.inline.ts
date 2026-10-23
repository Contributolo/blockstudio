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
  if (!timers.has(ref)) timers.set(ref, { open: null, close: null });
  return timers.get(ref)!;
}

function positionCard(root: HTMLElement) {
  const trigger = root.querySelector<HTMLElement>(
    'a, [data-wp-on--mouseenter]',
  );
  const popup = root.querySelector<HTMLElement>(
    '[data-bsui-preview-card-popup]',
  );
  if (!trigger || !popup) return;
  computePosition(window.__bsui.getAnchor(trigger)!, popup, {
    placement: 'bottom-start',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(popup.style, { left: x + 'px', top: y + 'px' });
  });
}

function openCard(ctx: Context, root: HTMLElement | null | undefined) {
  ctx.open = true;
  const popup = root?.querySelector<HTMLElement>(
    '[data-bsui-preview-card-popup]',
  );
  if (popup) popup.removeAttribute('hidden');
  requestAnimationFrame(() => positionCard(root!));
}

store('bsui/preview-card', {
  actions: {
    handleMouseEnter() {
      const ctx = getContext<Context>();
      const t = getTimers(ctx);
      clearTimeout(t.close!);
      const roots = document.querySelectorAll<HTMLElement>(
        '[data-bsui-preview-card-root]',
      );
      const root = [...roots].find(
        (r) => r.contains(document.activeElement) || r.matches(':hover'),
      );
      if (ctx.openDelay > 0) {
        t.open = setTimeout(() => openCard(ctx, root), ctx.openDelay);
      } else {
        openCard(ctx, root);
      }
    },
    handleMouseLeave() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-preview-card-root]');
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-preview-card-popup]',
      );
      const t = getTimers(ctx);
      clearTimeout(t.open!);
      if (ctx.closeDelay > 0) {
        t.close = setTimeout(() => {
          ctx.open = false;
          if (popup) popup.setAttribute('hidden', '');
        }, ctx.closeDelay);
      } else {
        ctx.open = false;
        if (popup) popup.setAttribute('hidden', '');
      }
    },
  },
});
