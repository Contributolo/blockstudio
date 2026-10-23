interface Navigator {
  readonly connection?: {
    readonly saveData?: boolean;
    readonly effectiveType?: string;
  };
}

interface HTMLElement {
  __bsuiScrollTracked?: boolean;
  _onTransitionEnd?: (() => void) | null;
}

interface BsuiGlobals {
  resolveBinding: (
    expression: string | undefined,
    namespace: string,
    getContext: (namespace?: string) => object,
    getStore: typeof import('@wordpress/interactivity').store,
  ) => unknown;
  syncValue: (
    namespace: string,
    getContext: (namespace?: string) => object,
    getStore: typeof import('@wordpress/interactivity').store,
  ) => void;
  lockScroll: () => void;
  unlockScroll: () => void;
  getAnchor: (
    element: HTMLElement | null | undefined,
  ) => HTMLElement | null | undefined;
  forwardTriggerProps: (wrapper: Element) => void;
  FOCUSABLE: string;
  focusItem: (items: readonly HTMLElement[], index: number) => number;
  typeahead: () => {
    handle: (
      key: string,
      items: readonly HTMLElement[],
      getText?: (item: HTMLElement) => string,
    ) => number;
    reset: () => void;
  };
}

interface FormResponse {
  code?: string;
  message?: string;
  data?: { errors?: Record<string, string | string[]> };
}

interface Window {
  __bsui: BsuiGlobals;
  BlockstudioMedia?: { rootMargin?: string };
  bs?: {
    db: (block: string) => {
      create: (
        data: Record<string, FormDataEntryValue>,
      ) => Promise<FormResponse>;
      update: (
        id: FormDataEntryValue,
        data: Record<string, FormDataEntryValue>,
      ) => Promise<FormResponse>;
      delete: (id: FormDataEntryValue) => Promise<FormResponse>;
    };
  };
}

declare module 'https://esm.sh/@floating-ui/dom@1.7.4' {
  export { computePosition, flip, shift, offset, size } from '@floating-ui/dom';
}
