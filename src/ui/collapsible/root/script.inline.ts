import { store, getContext } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  open: boolean;
}

store('bsui/collapsible', {
  state: {
    get ariaExpanded() {
      const { open } = getContext<Context>();
      return open ? 'true' : 'false';
    },
    get panelHidden() {
      const { open } = getContext<Context>();
      return !open;
    },
  },
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      ctx.open = !ctx.open;
    },
  },
});
