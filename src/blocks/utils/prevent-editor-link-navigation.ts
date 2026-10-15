import type { MouseEvent } from 'react';

export const preventEditorLinkNavigation = (
  event: Pick<
    MouseEvent<HTMLElement>,
    'target' | 'currentTarget' | 'preventDefault'
  >,
) => {
  const target = event.target as Node | null;
  const element =
    target?.nodeType === 1 ? (target as Element) : target?.parentElement;
  const link = element?.closest('a[href]');

  // Portals and nested blocks keep their own editing behavior.
  if (link?.closest('[data-block]') === event.currentTarget) {
    event.preventDefault();
  }
};
