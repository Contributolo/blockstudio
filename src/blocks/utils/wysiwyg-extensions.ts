import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { getWysiwygLinkHTMLAttributes } from '@/blocks/utils/wysiwyg-link';
import type { BlockstudioAttribute } from '@/types/block';

export const getWysiwygExtensions = (item: BlockstudioAttribute) => [
  StarterKit.configure({
    heading: {
      levels: item?.toolbar?.tags?.headings?.length
        ? item?.toolbar?.tags?.headings
        : [],
    },
    // StarterKit bundles Link and Underline since Tiptap 3. Disable them so
    // only the configured instances below are registered.
    link: false,
    underline: false,
  }),
  Link.configure({
    autolink: false,
    openOnClick: false,
    HTMLAttributes: getWysiwygLinkHTMLAttributes(item),
  }),
  Underline,
  TextAlign.configure({
    types: item?.toolbar?.formats?.textAlign?.types || [
      'heading',
      'paragraph',
      'list',
    ],
    alignments: item?.toolbar?.formats?.textAlign?.alignments || [],
  }),
];
