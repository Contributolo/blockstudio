let lockCount = 0;

window.__bsui = window.__bsui || {};

window.__bsui.resolveBinding = function (
  expression,
  namespace,
  getContext,
  getStore,
) {
  if (!expression) return undefined;
  let path = expression.trim();
  let negate = false;
  if (path.startsWith('!')) {
    negate = true;
    path = path.slice(1);
  }
  const qualified = path.split('::');
  if (qualified.length > 2) return undefined;
  if (qualified.length === 2) {
    namespace = qualified[0];
    path = qualified[1];
  }
  if (path.startsWith('!')) {
    negate = !negate;
    path = path.slice(1);
  }
  const parts = path.split('.');
  const source = parts.shift()!;
  if (!['context', 'state'].includes(source) || !parts.length) return undefined;
  if (
    parts.some(
      (key) =>
        !/^[\w$-]+$/.test(key) ||
        ['__proto__', 'prototype', 'constructor'].includes(key),
    )
  )
    return undefined;
  let value: unknown =
    source === 'context'
      ? getContext(namespace)
      : getStore<{ state: object }>(namespace).state;
  for (const key of parts)
    value = (value as Record<string, unknown> | undefined)?.[key];
  return negate ? !value : value;
};

window.__bsui.syncValue = function (namespace, getContext, getStore) {
  const context = getContext() as { valueBinding?: string; value: unknown };
  const value = window.__bsui.resolveBinding(
    context.valueBinding,
    namespace,
    getContext,
    getStore,
  );
  if (value !== undefined && !Object.is(context.value, value))
    context.value = value;
};

window.__bsui.lockScroll = function () {
  lockCount++;
  if (lockCount === 1) {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.setAttribute('data-bs-ui-scroll-locked', '');
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
  }
};

window.__bsui.unlockScroll = function () {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.removeAttribute('data-bs-ui-scroll-locked');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
};

window.__bsui.getAnchor = function (el) {
  if (!el) return el;
  const btn = el.querySelector<HTMLElement>('[data-bsui-button]');
  return btn || el;
};

const FORWARD_ATTRS = [
  'aria-haspopup',
  'aria-expanded',
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
  'id',
];

window.__bsui.forwardTriggerProps = function (wrapper) {
  const child = wrapper.querySelector('[data-bsui-button], button, a');
  if (!child || child === wrapper) return;

  FORWARD_ATTRS.forEach(function (attr) {
    const val = wrapper.getAttribute(attr);
    if (val !== null && !child!.hasAttribute(attr)) {
      child!.setAttribute(attr, val);
    }
  });

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (
        m.type === 'attributes' &&
        FORWARD_ATTRS.indexOf(m.attributeName!) !== -1
      ) {
        const v = wrapper.getAttribute(m.attributeName!);
        if (v !== null) {
          child!.setAttribute(m.attributeName!, v);
        } else {
          child!.removeAttribute(m.attributeName!);
        }
      }
    });
  });

  observer.observe(wrapper, {
    attributes: true,
    attributeFilter: FORWARD_ATTRS,
  });
};

window.__bsui.FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

window.__bsui.focusItem = function (items, index) {
  if (index >= 0 && index < items.length) {
    items[index].focus();
    return index;
  }
  return -1;
};

window.__bsui.typeahead = function () {
  let buffer = '';
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return {
    handle: function (key, items, getText) {
      if (key.length !== 1) return -1;
      clearTimeout(timeout!);
      buffer += key.toLowerCase();
      let match = -1;
      for (let i = 0; i < items.length; i++) {
        const text = getText ? getText(items[i]) : items[i].textContent || '';
        if (text.trim().toLowerCase().indexOf(buffer) === 0) {
          match = i;
          break;
        }
      }
      timeout = setTimeout(function () {
        buffer = '';
      }, 500);
      return match;
    },
    reset: function () {
      buffer = '';
      clearTimeout(timeout!);
    },
  };
};

document
  .querySelectorAll(
    '[data-bsui-dialog-trigger], [data-bsui-alert-dialog-trigger], [data-bsui-drawer-trigger], ' +
      '[data-bsui-menu-trigger], [data-bsui-popover-trigger], [data-bsui-collapsible-trigger], ' +
      '[data-bsui-tooltip-trigger]',
  )
  .forEach(window.__bsui.forwardTriggerProps);
