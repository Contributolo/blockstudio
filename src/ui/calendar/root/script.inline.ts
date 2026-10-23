import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  selected: string;
}

store('bsui/calendar', {
  state: {
    get selectedValue() {
      return getContext<Context>().selected;
    },
  },
  actions: {
    selectDay(event: Event) {
      const btn = (event.target as HTMLInputElement).closest<HTMLElement>(
        '[data-date]',
      );
      if (!btn) return;
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };

      ref.querySelectorAll<HTMLElement>('[data-selected]').forEach((el) => {
        el.removeAttribute('data-selected');
      });

      btn.setAttribute('data-selected', '');
      ctx.selected = btn.getAttribute('data-date')!;
    },
  },
});
