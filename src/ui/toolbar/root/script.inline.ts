import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  orientation: string;
}

store('bsui/toolbar', {
  actions: {
    handleKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const items = [
        ...ref.querySelectorAll<HTMLElement>(window.__bsui.FOCUSABLE),
      ];
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;

      const vertical = ctx.orientation === 'vertical';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';

      let next = -1;
      switch (event.key) {
        case nextKey:
          event.preventDefault();
          next = current < items.length - 1 ? current + 1 : 0;
          break;
        case prevKey:
          event.preventDefault();
          next = current > 0 ? current - 1 : items.length - 1;
          break;
        case 'Home':
          event.preventDefault();
          next = 0;
          break;
        case 'End':
          event.preventDefault();
          next = items.length - 1;
          break;
      }
      if (next >= 0) items[next].focus({ preventScroll: true });
    },
  },
});
