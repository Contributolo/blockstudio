import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  dismissable: boolean;
  open: boolean;
}

let openEntry: {
  popup: HTMLElement | null | undefined;
  backdrop: HTMLElement | null | undefined;
  popupPlaceholder: Comment | null;
  backdropPlaceholder: Comment | null;
} | null = null;

function portalToBody(el: HTMLElement | null | undefined) {
  if (!el || el.parentNode === document.body) return null;
  const placeholder = document.createComment('bs-ui-drawer');
  el.parentNode!.insertBefore(placeholder, el);
  document.body.appendChild(el);
  return placeholder;
}

function unportal(
  el: HTMLElement | null | undefined,
  placeholder: Comment | null,
) {
  if (!el || !placeholder?.parentNode) return;
  placeholder.parentNode.insertBefore(el, placeholder);
  placeholder.remove();
}

function closeDrawer(ctx: Context, ref: HTMLElement) {
  if (!ctx.open) return;
  const root = ref?.closest<HTMLElement>('[data-bsui-drawer-root]');
  const parts = openEntry;
  const popup =
    parts?.popup || root?.querySelector<HTMLElement>('[role="dialog"]');
  const backdrop =
    parts?.backdrop ||
    root?.querySelector<HTMLElement>('[data-bsui-drawer-backdrop]');

  if (popup) popup.classList.add('bs-ui-entering');
  if (backdrop) backdrop.classList.add('bs-ui-entering');

  setTimeout(() => {
    ctx.open = false;
    window.__bsui.unlockScroll();
    if (popup) popup.classList.remove('bs-ui-entering');
    if (backdrop) backdrop.classList.remove('bs-ui-entering');
    if (popup) popup.setAttribute('hidden', '');
    if (backdrop) backdrop.setAttribute('hidden', '');

    if (parts) {
      unportal(popup, parts.popupPlaceholder);
      unportal(backdrop, parts.backdropPlaceholder);
      openEntry = null;
    }

    const trigger = root?.querySelector<HTMLElement>(
      '[data-bsui-drawer-trigger]',
    );
    requestAnimationFrame(() =>
      window.__bsui.getAnchor(trigger)?.focus({ preventScroll: true }),
    );
  }, 450);
}

store('bsui/drawer', {
  state: {
    get ariaExpanded() {
      return getContext<Context>().open ? 'true' : 'false';
    },
  },
  actions: {
    open() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      const root = ref.closest<HTMLElement>('[data-bsui-drawer-root]');
      const popup = root?.querySelector<HTMLElement>('[role="dialog"]');
      const backdrop = root?.querySelector<HTMLElement>(
        '[data-bsui-drawer-backdrop]',
      );

      if (backdrop) backdrop.removeAttribute('hidden');
      if (popup) {
        popup.removeAttribute('hidden');
        popup.dataset.position = root?.dataset.position || 'left';
      }

      openEntry = {
        popup,
        backdrop,
        backdropPlaceholder: portalToBody(backdrop),
        popupPlaceholder: portalToBody(popup),
      };
      if (popup) popup.classList.add('bs-ui-entering');
      if (backdrop) backdrop.classList.add('bs-ui-entering');

      ctx.open = true;
      window.__bsui.lockScroll();

      requestAnimationFrame(() => {
        if (popup) {
          popup.classList.remove('bs-ui-entering');
          const focusable = popup.querySelector<HTMLElement>(
            window.__bsui.FOCUSABLE,
          );
          (focusable || popup).focus({ preventScroll: true });
        }
        if (backdrop) backdrop.classList.remove('bs-ui-entering');
      });
    },
    close() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      closeDrawer(ctx, ref);
    },
    handleBackdropClick() {
      const ctx = getContext<Context>();
      if (!ctx.dismissable) return;
      const { ref } = getElement() as { ref: HTMLElement };
      closeDrawer(ctx, ref);
    },
    handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const ctx = getContext<Context>();
      if (!ctx.open || !ctx.dismissable) return;
      if (
        document.querySelector<HTMLElement>(
          '[role="listbox"]:not([hidden]), [role="menu"]:not([hidden]), [data-bsui-popover-root] [role="dialog"]:not([hidden]), [data-bsui-date-input-popup]:not([hidden]), [data-bsui-phone-popup]:not([hidden])',
        )
      )
        return;

      event.preventDefault();
      const { ref } = getElement() as { ref: HTMLElement };
      closeDrawer(ctx, ref);
    },
    handleFocusTrap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const { ref } = getElement() as { ref: HTMLElement };
      const focusable = [
        ...ref.querySelectorAll<HTMLElement>(window.__bsui.FOCUSABLE),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    },
  },
});
