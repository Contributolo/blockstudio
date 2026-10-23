import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  value: string;
}

store('bsui/color-picker', {
  callbacks: {
    syncValue() {
      window.__bsui.syncValue('bsui/color-picker', getContext, store);
    },
  },
  actions: {
    handleColorInput(event: Event) {
      const ctx = getContext<Context>();
      ctx.value = (event.target as HTMLInputElement).value;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-color-picker]');
      const swatch = root?.querySelector<HTMLElement>(
        '[data-bsui-color-swatch]',
      );
      if (swatch) swatch.style.backgroundColor = ctx.value;
      const text = root?.querySelector<HTMLInputElement>('input[type="text"]');
      if (text) text.value = ctx.value;
      root?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.value },
        }),
      );
    },
    handleTextInput(event: Event) {
      const ctx = getContext<Context>();
      const val = (event.target as HTMLInputElement).value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        ctx.value = val;
        const { ref } = getElement() as { ref: HTMLElement };
        const root = ref.closest<HTMLElement>('[data-bsui-color-picker]');
        const swatch = root?.querySelector<HTMLElement>(
          '[data-bsui-color-swatch]',
        );
        if (swatch) swatch.style.backgroundColor = val;
        const color = root?.querySelector<HTMLInputElement>(
          'input[type="color"]',
        );
        if (color) color.value = val;
        root?.dispatchEvent(
          new CustomEvent('change', { bubbles: true, detail: { value: val } }),
        );
      }
    },
  },
});
