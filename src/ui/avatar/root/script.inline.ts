import { store, getContext } from '@wordpress/interactivity';

interface Context {
  error: boolean;
  loaded: boolean;
}

store('bsui/avatar', {
  state: {
    get imageHidden() {
      const { error } = getContext<Context>();
      return error;
    },
    get fallbackHidden() {
      const { loaded, error } = getContext<Context>();
      return loaded && !error;
    },
  },
  actions: {
    handleLoad() {
      const ctx = getContext<Context>();
      ctx.loaded = true;
      ctx.error = false;
    },
    handleError() {
      const ctx = getContext<Context>();
      ctx.error = true;
    },
  },
});
