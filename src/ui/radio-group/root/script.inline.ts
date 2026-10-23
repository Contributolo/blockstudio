import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  loop: boolean;
  orientation: string;
  radioValue: string;
  value: string;
}

const RADIO_SELECTOR = '[role="radio"]:not([aria-disabled="true"])';

store('bsui/radio-group', {
  callbacks: {
    syncValue() {
      window.__bsui.syncValue('bsui/radio-group', getContext, store);
    },
  },
  state: {
    get selectedValue() {
      return getContext<Context>().value;
    },
    get isChecked() {
      const ctx = getContext<Context>();
      return String(ctx.radioValue) === String(ctx.value);
    },
    get ariaChecked() {
      const ctx = getContext<Context>();
      return String(ctx.radioValue) === String(ctx.value) ? 'true' : 'false';
    },
    get tabIndex() {
      const ctx = getContext<Context>();
      return String(ctx.radioValue) === String(ctx.value) ? 0 : -1;
    },
  },
  actions: {
    select() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      ctx.value = ctx.radioValue;
      const { ref } = getElement() as { ref: HTMLElement };
      ref.closest<HTMLElement>('[data-bsui-radio-group-root]')?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.value },
        }),
      );
    },
    handleKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;

      const { ref } = getElement() as { ref: HTMLElement };
      const radios = [...ref.querySelectorAll<HTMLElement>(RADIO_SELECTOR)];
      const current = radios.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;

      const vertical = ctx.orientation === 'vertical';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';

      const loop = ctx.loop !== false;
      let next = -1;
      switch (event.key) {
        case nextKey:
          event.preventDefault();
          next = current < radios.length - 1 ? current + 1 : loop ? 0 : -1;
          break;
        case prevKey:
          event.preventDefault();
          next = current > 0 ? current - 1 : loop ? radios.length - 1 : -1;
          break;
        case 'Home':
          event.preventDefault();
          next = 0;
          break;
        case 'End':
          event.preventDefault();
          next = radios.length - 1;
          break;
      }

      if (next >= 0) {
        radios[next].focus({ preventScroll: true });
        const nextValue = radios[next].getAttribute('data-value');
        if (nextValue !== null) {
          ctx.value = nextValue;
          ref.dispatchEvent(
            new CustomEvent('change', {
              bubbles: true,
              detail: { value: nextValue },
            }),
          );
        }
      }
    },
  },
});
