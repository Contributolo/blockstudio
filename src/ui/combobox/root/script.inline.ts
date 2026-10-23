import {
  computePosition,
  flip,
  shift,
  offset,
} from 'https://esm.sh/@floating-ui/dom@1.7.4';
import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  activeIndex: number;
  label: string;
  open: boolean;
  optionLabel: string;
  optionValue: string;
  query: string;
  value: string;
}

const OPTION_SELECTOR = '[role="option"]:not([aria-disabled="true"])';

function getVisibleOptions(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(OPTION_SELECTOR)].filter(
    (el) => !el.hidden,
  );
}

function positionPopup(input: HTMLInputElement, popup: HTMLElement) {
  popup.style.position = 'fixed';
  computePosition(input, popup, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(popup.style, { left: x + 'px', top: y + 'px' });
  });
  if (!popup.__bsuiScrollTracked) {
    popup.__bsuiScrollTracked = true;
    let frame = 0;
    const track = () => {
      if (popup.hasAttribute('hidden')) {
        popup.__bsuiScrollTracked = false;
        window.removeEventListener('scroll', onScroll, true);
        return;
      }
      positionPopup(input, popup);
    };
    const onScroll = (event: Event) => {
      if (popup.contains(event.target as HTMLInputElement)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(track);
    };
    window.addEventListener('scroll', onScroll, true);
  }
}

store('bsui/combobox', {
  state: {
    get selectedValue() {
      return getContext<Context>().value;
    },
  },
  actions: {
    handleInput(event: Event) {
      const ctx = getContext<Context>();
      const query = (event.target as HTMLInputElement).value.toLowerCase();
      ctx.query = query;
      ctx.open = true;
      ctx.activeIndex = -1;

      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-combobox-root]');
      const options = root?.querySelectorAll<HTMLElement>(OPTION_SELECTOR);
      if (options) {
        options.forEach((opt) => {
          const text = opt.textContent?.trim().toLowerCase() || '';
          opt.hidden = query !== '' && !text.includes(query);
        });
      }

      const input = root?.querySelector<HTMLInputElement>(
        '[data-bsui-combobox-input]',
      );
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-combobox-popup]',
      );
      if (popup) popup.removeAttribute('hidden');
      if (input && popup) {
        requestAnimationFrame(() => positionPopup(input, popup));
      }
    },
    handleClick() {
      const ctx = getContext<Context>();
      ctx.open = true;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-combobox-root]');
      const input = root?.querySelector<HTMLInputElement>(
        '[data-bsui-combobox-input]',
      );
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-combobox-popup]',
      );
      if (popup) popup.removeAttribute('hidden');
      if (input && popup) {
        requestAnimationFrame(() => positionPopup(input, popup));
      }
    },
    selectOption() {
      const ctx = getContext<Context>();
      ctx.value = ctx.optionValue;
      ctx.label = ctx.optionLabel;
      ctx.open = false;
      ctx.query = '';

      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-combobox-root]');
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-combobox-popup]',
      );
      if (popup) popup.setAttribute('hidden', '');
      const input = root?.querySelector<HTMLInputElement>(
        '[data-bsui-combobox-input]',
      );
      if (input) {
        input.value = ctx.optionLabel;
      }
      const options = root?.querySelectorAll<HTMLElement>(OPTION_SELECTOR);
      if (options) {
        options.forEach((opt) => {
          opt.hidden = false;
        });
      }
    },
    handleKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-combobox-root]');
      if (!root) return;

      const options = getVisibleOptions(root);
      if (!options.length && event.key !== 'Escape') return;

      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-combobox-popup]',
      );
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          ctx.open = true;
          if (popup && popup.hasAttribute('hidden')) {
            popup.removeAttribute('hidden');
            const input = root.querySelector<HTMLInputElement>(
              '[data-bsui-combobox-input]',
            );
            if (input) {
              requestAnimationFrame(() => positionPopup(input, popup));
            }
          }
          ctx.activeIndex =
            ctx.activeIndex < options.length - 1 ? ctx.activeIndex + 1 : 0;
          options[ctx.activeIndex]?.focus({ preventScroll: true });
          break;
        case 'ArrowUp':
          event.preventDefault();
          ctx.activeIndex =
            ctx.activeIndex > 0 ? ctx.activeIndex - 1 : options.length - 1;
          options[ctx.activeIndex]?.focus({ preventScroll: true });
          break;
        case 'Enter':
          event.preventDefault();
          if (ctx.activeIndex >= 0 && ctx.activeIndex < options.length) {
            options[ctx.activeIndex].click();
          }
          break;
        case 'Escape':
          event.preventDefault();
          ctx.open = false;
          ctx.activeIndex = -1;
          if (popup) popup.setAttribute('hidden', '');
          root
            .querySelector<HTMLInputElement>('[data-bsui-combobox-input]')
            ?.focus({ preventScroll: true });
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
        const popup = ref.querySelector<HTMLElement>(
          '[data-bsui-combobox-popup]',
        );
        if (popup) popup.setAttribute('hidden', '');
      }
    },
  },
});
