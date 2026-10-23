import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  visible: boolean;
}

store('bsui/password-input', {
  state: {
    get inputType() {
      return getContext<Context>().visible ? 'text' : 'password';
    },
    get ariaPressed() {
      return getContext<Context>().visible ? 'true' : 'false';
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      ctx.visible = !ctx.visible;
    },
    handleInput(event: Event) {
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-password-input]');
      if (root) {
        root.dispatchEvent(
          new CustomEvent('change', {
            bubbles: true,
            detail: { value: (event.target as HTMLInputElement).value },
          }),
        );
      }
    },
  },
});
