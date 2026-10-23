import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  open: boolean;
  subOpen: boolean;
}

store('bsui/menubar', {
  actions: {
    toggle() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = !ctx.open;
      const root = ref.closest<HTMLElement>('[data-bsui-menubar-menu]');
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-menubar-popup]',
      );
      if (ctx.open) {
        if (popup) popup.removeAttribute('hidden');
      } else {
        if (popup) popup.setAttribute('hidden', '');
      }
    },
    close() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.open = false;
      const root = ref.closest<HTMLElement>('[data-bsui-menubar-menu]');
      const popup = root?.querySelector<HTMLElement>(
        '[data-bsui-menubar-popup]',
      );
      if (popup) popup.setAttribute('hidden', '');
    },
    openSub() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.subOpen = true;
      const submenu = ref.closest<HTMLElement>('[data-bsui-menubar-submenu]');
      const subPopup = submenu?.querySelector<HTMLElement>(
        '[data-bsui-menubar-submenu-popup]',
      );
      if (subPopup) subPopup.removeAttribute('hidden');
    },
    closeSub() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      ctx.subOpen = false;
      const submenu = ref.closest<HTMLElement>('[data-bsui-menubar-submenu]');
      const subPopup = submenu?.querySelector<HTMLElement>(
        '[data-bsui-menubar-submenu-popup]',
      );
      if (subPopup) subPopup.setAttribute('hidden', '');
    },
    handleOutsideClick(event: Event) {
      const ctx = getContext<Context>();
      if (!ctx.open) return;
      const { ref } = getElement() as { ref: HTMLElement };
      if (!ref.contains(event.target as HTMLInputElement)) {
        ctx.open = false;
        const popup = ref.querySelector<HTMLElement>(
          '[data-bsui-menubar-popup]',
        );
        if (popup) popup.setAttribute('hidden', '');
      }
    },
  },
});
