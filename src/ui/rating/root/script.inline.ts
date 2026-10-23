import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  hover: number;
  value: number;
}

function updateStars(root: HTMLElement, filled: number) {
  root.querySelectorAll<HTMLElement>('[data-star]').forEach((btn) => {
    const star = parseInt(btn.dataset.star!, 10);
    if (star <= filled) {
      btn.setAttribute('data-filled', '');
    } else {
      btn.removeAttribute('data-filled');
    }
    btn.setAttribute('aria-checked', star <= filled ? 'true' : 'false');
  });
}

store('bsui/rating', {
  callbacks: {
    syncValue() {
      window.__bsui.syncValue('bsui/rating', getContext, store);
      const ctx = getContext<Context>();
      updateStars(
        (getElement() as { ref: HTMLElement }).ref,
        ctx.hover || ctx.value,
      );
    },
  },
  state: {
    get formValue() {
      return String(getContext<Context>().value);
    },
  },
  actions: {
    select() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const star = parseInt(ref.dataset.star!, 10);
      ctx.value = ctx.value === star ? 0 : star;
      const root = ref.closest<HTMLElement>('[data-bsui-rating]')!;
      updateStars(root, ctx.value);
      root.dispatchEvent(
        new CustomEvent('change', {
          bubbles: true,
          detail: { value: ctx.value },
        }),
      );
    },
    hoverIn() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const star = parseInt(ref.dataset.star!, 10);
      ctx.hover = star;
      const root = ref.closest<HTMLElement>('[data-bsui-rating]')!;
      updateStars(root, star);
    },
    hoverOut() {
      const ctx = getContext<Context>();
      ctx.hover = 0;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-rating]')!;
      updateStars(root, ctx.value);
    },
  },
});
