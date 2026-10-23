import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  open: boolean;
}

store('bsui/navigation-menu', {
  state: {
    get ariaExpanded() {
      return getContext<Context>().open ? 'true' : 'false';
    },
  },
  actions: {
    open() {
      getContext<Context>().open = true;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-nav-menu]');
      const content = root?.querySelector<HTMLElement>(
        '[data-bsui-nav-menu-content]',
      );
      if (content) content.removeAttribute('hidden');
    },
    close() {
      getContext<Context>().open = false;
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-nav-menu]');
      const content = root?.querySelector<HTMLElement>(
        '[data-bsui-nav-menu-content]',
      );
      if (content) content.setAttribute('hidden', '');
    },
    toggle() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = !ctx.open;
      const root = ref.closest<HTMLElement>('[data-bsui-nav-menu]');
      const content = root?.querySelector<HTMLElement>(
        '[data-bsui-nav-menu-content]',
      );
      if (ctx.open) {
        if (content) content.removeAttribute('hidden');
      } else {
        if (content) content.setAttribute('hidden', '');
      }
    },
    handleOutsideClick(event: Event) {
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      const { ref } = getElement() as { ref: HTMLElement };
      if (!ref.contains(event.target as HTMLInputElement)) {
        ctx.open = false;
        const content = ref.querySelector<HTMLElement>(
          '[data-bsui-nav-menu-content]',
        );
        if (content) content.setAttribute('hidden', '');
      }
    },
  },
});
