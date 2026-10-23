import {
  computePosition,
  flip,
  shift,
  offset,
} from 'https://esm.sh/@floating-ui/dom@1.7.4';
import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  activeDescendant: string;
  activeIndex: number;
  label: string;
  labels: string[];
  loop: boolean;
  multiple: boolean;
  open: boolean;
  optionLabel: string;
  optionValue: string;
  placeholder: string;
  value: string | string[];
}

const OPTION_SELECTOR = '[role="option"]:not([aria-disabled="true"])';
const typeahead = window.__bsui.typeahead();

function getOptions(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(OPTION_SELECTOR)];
}

function focusOption(options: HTMLElement[], index: number, ctx: Context) {
  const result = window.__bsui.focusItem(options, index);
  if (ctx) {
    ctx.activeDescendant = result >= 0 ? options[result].id || '' : '';
  }
  return result;
}

function positionPopup(
  trigger: HTMLElement,
  popup: HTMLElement,
  isMulti: boolean,
) {
  const selectedOption = isMulti
    ? null
    : popup.querySelector<HTMLElement>('[aria-selected="true"]');

  if (selectedOption) {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const styles = getComputedStyle(document.documentElement);
    const popupPadding =
      parseFloat(styles.getPropertyValue('--bs-ui-popup-padding')) * rem;
    const popupBorder = 1;
    const checkmarkSpace = 1.25 * rem;

    const triggerRect = trigger.getBoundingClientRect();
    popup.style.animation = 'none';
    popup.style.minWidth =
      'min(' +
      (triggerRect.width +
        popupPadding * 2 +
        popupBorder * 2 +
        checkmarkSpace) +
      'px, calc(100vw - 1rem))';
    const sizedRect = popup.getBoundingClientRect();
    const optionRect = selectedOption.getBoundingClientRect();

    const triggerStyles = getComputedStyle(trigger);
    const optionStyles = getComputedStyle(selectedOption);
    const triggerInset =
      parseFloat(triggerStyles.borderLeftWidth) +
      parseFloat(triggerStyles.paddingLeft);
    const optionInset =
      optionRect.left -
      sizedRect.left +
      parseFloat(optionStyles.borderLeftWidth) +
      parseFloat(optionStyles.paddingLeft);
    let x = triggerRect.left + triggerInset - optionInset;
    const optionOffsetY = optionRect.top - sizedRect.top;
    let y = triggerRect.top - optionOffsetY;

    const maxX = window.innerWidth - sizedRect.width - 8;
    x = Math.max(8, Math.min(x, maxX));
    const maxY = window.innerHeight - sizedRect.height - 8;
    y = Math.max(8, Math.min(y, maxY));

    Object.assign(popup.style, {
      left: x + 'px',
      top: y + 'px',
      position: 'fixed',
    });
  } else {
    const triggerRect = trigger.getBoundingClientRect();
    Object.assign(popup.style, {
      position: 'fixed',
      left: triggerRect.left + 'px',
      top: triggerRect.bottom + 4 + 'px',
    });
    computePosition(window.__bsui.getAnchor(trigger)!, popup, {
      placement: 'bottom-start',
      strategy: 'fixed',
      middleware: [offset(4), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      Object.assign(popup.style, {
        left: x + 'px',
        top: y + 'px',
        position: 'fixed',
      });
    });
  }
  if (!popup.__bsuiScrollTracked) {
    popup.__bsuiScrollTracked = true;
    let frame = 0;
    const track = () => {
      if (popup.hasAttribute('hidden')) {
        popup.__bsuiScrollTracked = false;
        window.removeEventListener('scroll', onScroll, true);
        return;
      }
      positionPopup(trigger, popup, isMulti);
    };
    const onScroll = (event: Event) => {
      if (popup.contains(event.target as HTMLInputElement)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(track);
    };
    window.addEventListener('scroll', onScroll, true);
  }
}

function isSelected(ctx: Context, optionValue: string) {
  if (ctx.multiple) {
    return Array.isArray(ctx.value) && ctx.value.includes(optionValue);
  }
  return String(ctx.value) === String(optionValue);
}

store('bsui/select', {
  state: {
    get ariaExpanded() {
      return getContext<Context>().open ? 'true' : 'false';
    },
    get displayValue() {
      const ctx = getContext<Context>();
      if (ctx.multiple && Array.isArray(ctx.value)) {
        if (ctx.value.length === 0) return ctx.placeholder;
        if (ctx.labels && ctx.labels.length > 0) {
          return ctx.labels.join(', ');
        }
        return ctx.value.length + ' selected';
      }
      return ctx.label || ctx.placeholder;
    },
    get selectedValue() {
      return getContext<Context>().value;
    },
    get ariaSelected() {
      const ctx = getContext<Context>();
      return isSelected(ctx, ctx.optionValue) ? 'true' : 'false';
    },
    get ariaMultiSelectable() {
      return getContext<Context>().multiple ? 'true' : undefined;
    },
    get activeDescendant() {
      return getContext<Context>().activeDescendant || undefined;
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = !ctx.open;

      const root = ref.closest<HTMLElement>('[data-bsui-select-root]');
      const listbox = root?.querySelector<HTMLElement>('[role="listbox"]');

      if (ctx.open) {
        ctx.activeIndex = -1;
        if (listbox) listbox.removeAttribute('hidden');
        const trigger = root?.querySelector<HTMLElement>(
          '[data-bsui-select-trigger]',
        );
        requestAnimationFrame(() => {
          if (!listbox) return;

          if (trigger) positionPopup(trigger, listbox, ctx.multiple);
          listbox.focus({ preventScroll: true });
          const options = getOptions(root!);
          const currentValue = ctx.multiple ? ctx.value[0] || '' : ctx.value;
          const selectedIdx = options.findIndex(
            (opt) => opt.getAttribute('data-value') === String(currentValue),
          );
          ctx.activeIndex = focusOption(
            options,
            selectedIdx >= 0 ? selectedIdx : 0,
            ctx,
          );
        });
      } else {
        ctx.activeDescendant = '';
        if (listbox) listbox.setAttribute('hidden', '');
      }
    },
    selectOption() {
      const ctx = getContext<Context>();
      const { optionValue, optionLabel } = ctx;

      if (ctx.multiple) {
        const values = Array.isArray(ctx.value) ? [...ctx.value] : [];
        const labels = Array.isArray(ctx.labels) ? [...ctx.labels] : [];
        const idx = values.indexOf(optionValue);

        if (idx >= 0) {
          values.splice(idx, 1);
          labels.splice(idx, 1);
        } else {
          values.push(optionValue);
          labels.push(optionLabel);
        }

        ctx.value = values;
        ctx.labels = labels;

        const { ref } = getElement() as { ref: HTMLElement };
        const root = ref.closest<HTMLElement>('[data-bsui-select-root]');
        root?.dispatchEvent(
          new CustomEvent('change', {
            bubbles: true,
            detail: { value: ctx.value },
          }),
        );
        // Keep open in multiple mode
        return;
      }

      ctx.value = optionValue;
      ctx.label = optionLabel;
      ctx.open = false;
      ctx.activeIndex = -1;
      ctx.activeDescendant = '';

      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-select-root]');
      const listbox = root?.querySelector<HTMLElement>('[role="listbox"]');
      if (listbox) listbox.setAttribute('hidden', '');
      const trigger = root?.querySelector<HTMLElement>(
        '[data-bsui-select-trigger]',
      );
      requestAnimationFrame(() =>
        window.__bsui.getAnchor(trigger)?.focus({ preventScroll: true }),
      );
      root?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.value },
        }),
      );
    },
    handleListboxKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-select-root]');
      if (!root) return;

      const options = getOptions(root);
      if (options.length === 0) return;

      const loop = ctx.loop !== false;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          ctx.activeIndex = focusOption(
            options,
            ctx.activeIndex < options.length - 1
              ? ctx.activeIndex + 1
              : loop
                ? 0
                : -1,
            ctx,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          ctx.activeIndex = focusOption(
            options,
            ctx.activeIndex > 0
              ? ctx.activeIndex - 1
              : loop
                ? options.length - 1
                : -1,
            ctx,
          );
          break;
        case 'Home':
          event.preventDefault();
          ctx.activeIndex = focusOption(options, 0, ctx);
          break;
        case 'End':
          event.preventDefault();
          ctx.activeIndex = focusOption(options, options.length - 1, ctx);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (ctx.activeIndex >= 0 && ctx.activeIndex < options.length) {
            options[ctx.activeIndex].click();
          }
          break;
        case 'Escape':
          event.preventDefault();
          ctx.open = false;
          ctx.activeIndex = -1;
          ctx.activeDescendant = '';
          {
            const listbox = root.querySelector<HTMLElement>('[role="listbox"]');
            if (listbox) listbox.setAttribute('hidden', '');
            const trigger = root.querySelector<HTMLElement>(
              '[data-bsui-select-trigger]',
            );
            requestAnimationFrame(() =>
              window.__bsui.getAnchor(trigger)?.focus({ preventScroll: true }),
            );
          }
          event.stopPropagation();
          break;
        case 'Tab':
          ctx.open = false;
          ctx.activeIndex = -1;
          ctx.activeDescendant = '';
          {
            const listbox = root.querySelector<HTMLElement>('[role="listbox"]');
            if (listbox) listbox.setAttribute('hidden', '');
          }
          break;
        default:
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            const match = typeahead.handle(event.key, options);
            if (match >= 0) {
              ctx.activeIndex = focusOption(options, match, ctx);
            }
          }
          break;
      }
    },
    handleTriggerKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        if (!ctx.open) {
          store<{ state: object; actions: { toggle: () => void } }>(
            'bsui/select',
          ).actions.toggle();
        }
      }
    },
    handleOutsideClick(event: Event) {
      const ctx = getContext<Context>();
      if (!ctx.open) return;

      const { ref } = getElement() as { ref: HTMLElement };
      if (!ref.contains(event.target as HTMLInputElement)) {
        ctx.open = false;
        ctx.activeIndex = -1;
        ctx.activeDescendant = '';
        const listbox = ref.querySelector<HTMLElement>('[role="listbox"]');
        if (listbox) listbox.setAttribute('hidden', '');
      }
    },
  },
});
