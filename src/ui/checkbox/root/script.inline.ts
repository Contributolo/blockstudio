import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  checked: boolean;
  checkedBinding: string;
  disabled: boolean;
  indeterminate: boolean;
  value: string;
}

store('bsui/checkbox', {
  state: {
    get ariaChecked() {
      const ctx = getContext<Context>();
      if (ctx.indeterminate) return 'mixed';
      return ctx.checked ? 'true' : 'false';
    },
    get formValue() {
      const ctx = getContext<Context>();
      const bound = window.__bsui.resolveBinding(
        ctx.checkedBinding,
        'bsui/checkbox',
        getContext,
        store,
      );
      if (ctx.indeterminate && bound === undefined) return '';
      return (bound === undefined ? ctx.checked : bound)
        ? ctx.value || 'on'
        : '';
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      if (ctx.indeterminate) {
        ctx.indeterminate = false;
        ctx.checked = true;
      } else {
        ctx.checked = !ctx.checked;
      }
      const { ref } = getElement() as { ref: HTMLElement };
      ref.closest<HTMLElement>('[data-bsui-checkbox]')?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.checked },
        }),
      );
    },
  },
});
