import type { BlockstudioAttribute } from '@/types/block';

type WysiwygLink = {
  url: string;
  target?: string;
  rel?: string;
};

// Tiptap's Link renders target="_blank" and rel="noopener noreferrer nofollow"
// on every link unless HTMLAttributes resets them, and also falls back to
// these values for stored links without the attributes. Links should only
// carry what the field configures or the link modal sets.
export const getWysiwygLinkHTMLAttributes = (
  item: BlockstudioAttribute,
): Record<string, any> => ({
  target: null,
  rel: null,
  ...item?.toolbar?.formats?.link?.attributes,
});

// Explicit target and rel replace the configured ones on the rendered link,
// so the configured rel is kept and the new tab tokens from the link modal
// are added to it.
export const getWysiwygLinkAttributes = (
  item: BlockstudioAttribute,
  link: WysiwygLink,
) => {
  const configured = getWysiwygLinkHTMLAttributes(item);
  const rel = new Set(
    `${configured.rel ?? ''} ${link.rel ?? ''}`.split(/\s+/).filter(Boolean),
  );

  return {
    href: link.url,
    target: link.target ?? configured.target ?? null,
    rel: Array.from(rel).join(' ') || null,
  };
};
