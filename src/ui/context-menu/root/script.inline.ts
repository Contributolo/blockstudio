import {
  computePosition,
  flip,
  shift,
} from 'https://esm.sh/@floating-ui/dom@1.7.4';
import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  activeIndex: number;
  open: boolean;
  x: number;
  y: number;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

store('bsui/context-menu', {
  state: {
    get popupStyle() {
      const { x, y } = getContext<Context>();
      return `position:fixed;left:${x}px;top:${y}px`;
    },
  },
  actions: {
    handleContextMenu(event: MouseEvent) {
      event.preventDefault();
      const ctx = getContext<Context>();
      ctx.open = true;
      ctx.activeIndex = -1;

      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-context-menu-root]');
      const menuPopup = root?.querySelector<HTMLElement>('[role="menu"]');
      if (menuPopup) menuPopup.removeAttribute('hidden');
      const virtualEl = {
        getBoundingClientRect: () => ({
          x: event.clientX,
          y: event.clientY,
          width: 0,
          height: 0,
          top: event.clientY,
          left: event.clientX,
          right: event.clientX,
          bottom: event.clientY,
        }),
      };
      requestAnimationFrame(() => {
        const popup = root?.querySelector<HTMLElement>('[role="menu"]');
        if (popup) {
          computePosition(virtualEl, popup, {
            placement: 'bottom-start',
            strategy: 'fixed',
            middleware: [flip(), shift({ padding: 8 })],
          }).then(({ x, y }) => {
            Object.assign(popup.style, { left: x + 'px', top: y + 'px' });
          });
        }
        const items = root
          ? [...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)]
          : [];
        if (items.length > 0) {
          items[0].focus({ preventScroll: true });
          ctx.activeIndex = 0;
        } else if (popup) {
          popup.focus({ preventScroll: true });
        }
      });
    },
    activateItem() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = false;
      ctx.activeIndex = -1;
      const root = ref.closest<HTMLElement>('[data-bsui-context-menu-root]');
      const popup = root?.querySelector<HTMLElement>('[role="menu"]');
      if (popup) popup.setAttribute('hidden', '');
    },
    handlePopupKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-context-menu-root]');
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
      if (!items.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          ctx.activeIndex = (ctx.activeIndex + 1) % items.length;
          items[ctx.activeIndex].focus({ preventScroll: true });
          break;
        case 'ArrowUp':
          event.preventDefault();
          ctx.activeIndex = (ctx.activeIndex - 1 + items.length) % items.length;
          items[ctx.activeIndex].focus({ preventScroll: true });
          break;
        case 'Home':
          event.preventDefault();
          ctx.activeIndex = 0;
          items[0].focus({ preventScroll: true });
          break;
        case 'End':
          event.preventDefault();
          ctx.activeIndex = items.length - 1;
          items[ctx.activeIndex].focus({ preventScroll: true });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (ctx.activeIndex >= 0) items[ctx.activeIndex].click();
          break;
        case 'Escape':
        case 'Tab':
          event.preventDefault();
          ctx.open = false;
          ctx.activeIndex = -1;
          {
            const menuPopup = root?.querySelector<HTMLElement>('[role="menu"]');
            if (menuPopup) menuPopup.setAttribute('hidden', '');
          }
          event.stopPropagation();
          break;
      }
    },
    handleOutsideClick(event: Event) {
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      const { ref } = getElement() as { ref: HTMLElement };
      if (!ref.contains(event.target as HTMLInputElement)) {
        ctx.open = false;
        ctx.activeIndex = -1;
        const popup = ref.querySelector<HTMLElement>('[role="menu"]');
        if (popup) popup.setAttribute('hidden', '');
      }
    },
    handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      ctx.open = false;
      ctx.activeIndex = -1;
      const { ref } = getElement() as { ref: HTMLElement };
      const popup = ref.querySelector<HTMLElement>('[role="menu"]');
      if (popup) popup.setAttribute('hidden', '');
    },
  },
});
