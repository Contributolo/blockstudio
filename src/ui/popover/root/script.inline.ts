import {
  computePosition,
  flip,
  shift,
  offset,
} from 'https://esm.sh/@floating-ui/dom@1.7.4';
import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  open: boolean;
}

store('bsui/popover', {
  state: {
    get ariaExpanded() {
      return getContext<Context>().open ? 'true' : 'false';
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = !ctx.open;

      const root = ref.closest<HTMLElement>('[data-bsui-popover-root]');
      const popup = root?.querySelector<HTMLElement>('[role="dialog"]');

      if (ctx.open) {
        if (popup) popup.removeAttribute('hidden');
        const trigger = root?.querySelector<HTMLElement>(
          '[aria-haspopup="dialog"]',
        );
        requestAnimationFrame(() => {
          if (popup && trigger) {
            computePosition(window.__bsui.getAnchor(trigger)!, popup, {
              placement: 'bottom-start',
              middleware: [offset(4), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              Object.assign(popup.style, { left: x + 'px', top: y + 'px' });
            });
            const focusable = popup.querySelector<HTMLElement>(
              window.__bsui.FOCUSABLE,
            );
            (focusable || popup).focus({ preventScroll: true });
          }
        });
      } else {
        if (popup) popup.setAttribute('hidden', '');
      }
    },
    close() {
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      ctx.open = false;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-popover-root]');
      const popup = root?.querySelector<HTMLElement>('[role="dialog"]');
      if (popup) popup.setAttribute('hidden', '');
      const trigger = root?.querySelector<HTMLElement>(
        '[aria-haspopup="dialog"]',
      );
      window.__bsui.getAnchor(trigger)?.focus({ preventScroll: true });
    },
    handleOutsideClick(event: Event) {
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      const { ref } = getElement() as { ref: HTMLElement };
      if (!ref.contains(event.target as HTMLInputElement)) {
        ctx.open = false;
        const popup = ref.querySelector<HTMLElement>('[role="dialog"]');
        if (popup) popup.setAttribute('hidden', '');
      }
    },
    handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      ctx.open = false;
      const { ref } = getElement() as { ref: HTMLElement };
      const popup = ref.querySelector<HTMLElement>('[role="dialog"]');
      if (popup) popup.setAttribute('hidden', '');
      const trigger = ref.querySelector<HTMLElement>(
        '[aria-haspopup="dialog"]',
      );
      window.__bsui.getAnchor(trigger)?.focus({ preventScroll: true });
    },
    handleFocusTrap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const { ref } = getElement() as { ref: HTMLElement };
      const focusable = [
        ...ref.querySelectorAll<HTMLElement>(window.__bsui.FOCUSABLE),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    },
  },
});
