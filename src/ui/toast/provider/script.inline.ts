import { store, getContext } from '@wordpress/interactivity';

interface Context {
  toastId: string;
  toasts: { id: string }[];
}

store('bsui/toast', {
  state: {
    get hasToasts() {
      return getContext<Context>().toasts.length > 0;
    },
  },
  actions: {
    dismiss() {
      const ctx = getContext<Context>();
      ctx.toasts = ctx.toasts.filter((t) => t.id !== ctx.toastId);
    },
  },
});
