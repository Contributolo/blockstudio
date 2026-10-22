import type { ComponentProps, ComponentType } from 'react';
import { Suspense, lazy } from '@wordpress/element';

// Code editors and the rich text editor weigh several hundred KB. They load on
// first use instead of with the editor script.
const defer = <T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) => {
  const Component = lazy(load);

  return (props: ComponentProps<T>) => (
    <Suspense fallback={null}>
      <Component {...props} />
    </Suspense>
  );
};

export const Attributes = defer(() =>
  import(
    /* webpackChunkName: "blocks/field-attributes" */ '@/blocks/components/fields/components/attributes'
  ).then((m) => ({ default: m.Attributes })),
);

export const Classes = defer(() =>
  import(
    /* webpackChunkName: "blocks/field-classes" */ '@/blocks/components/fields/components/classes'
  ).then((m) => ({ default: m.Classes })),
);

export const Code = defer(() =>
  import(
    /* webpackChunkName: "blocks/field-code" */ '@/blocks/components/fields/components/code'
  ).then((m) => ({ default: m.Code })),
);

export const WYSIWYG = defer(() =>
  import(
    /* webpackChunkName: "blocks/field-wysiwyg" */ '@/blocks/components/fields/components/wysiwyg'
  ).then((m) => ({ default: m.WYSIWYG })),
);
