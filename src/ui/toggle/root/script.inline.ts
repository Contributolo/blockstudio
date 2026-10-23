import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  pressed: boolean;
}

store('bsui/toggle', {
  state: {
    get ariaPressed() {
      const { pressed } = getContext<Context>();
      return pressed ? 'true' : 'false';
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      ctx.pressed = !ctx.pressed;
      const { ref } = getElement() as { ref: HTMLElement };
      ref.closest<HTMLElement>('[data-bsui-toggle]')?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.pressed },
        }),
      );
    },
  },
});
