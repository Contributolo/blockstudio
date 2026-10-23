import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  checked: boolean;
  checkedBinding: string;
  checkedValue: string;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  uncheckedValue: string;
}

store('bsui/switch', {
  state: {
    get ariaChecked() {
      return getContext<Context>().checked ? 'true' : 'false';
    },
    get ariaReadOnly() {
      return getContext<Context>().readOnly ? 'true' : undefined;
    },
    get ariaRequired() {
      return getContext<Context>().required ? 'true' : undefined;
    },
    get formValue() {
      const ctx = getContext<Context>();
      const { checkedValue, uncheckedValue } = ctx;
      const bound = window.__bsui.resolveBinding(
        ctx.checkedBinding,
        'bsui/switch',
        getContext,
        store,
      );
      return (bound === undefined ? ctx.checked : bound)
        ? checkedValue || 'on'
        : uncheckedValue || '';
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      if (ctx.disabled || ctx.readOnly) return;
      ctx.checked = !ctx.checked;
      const { ref } = getElement() as { ref: HTMLElement };
      ref.closest<HTMLElement>('[data-bsui-switch]')?.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.checked },
        }),
      );
    },
  },
});
