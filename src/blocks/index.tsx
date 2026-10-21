import { InspectorControls, InnerBlocks } from '@wordpress/block-editor';
import { registerBlockType } from '@wordpress/blocks';
import { register } from '@wordpress/data';
import { useEffect, useState, createPortal } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';
import parse from 'html-react-parser';
import { initializeCanvasBodyClasses } from '@/blocks/canvas-body-classes';
import { Block } from '@/blocks/components/block';
import { renderCache } from '@/blocks/components/block/render-cache';
import { ExpandedEditor } from '@/blocks/components/expanded-editor';
import { Fields } from '@/blocks/components/fields';
import { initializeEditorReadinessGate } from '@/blocks/editor-readiness';
import '@/blocks/filters/custom-class';
import '@/blocks/filters/default';
import { getMatches } from '@/blocks/filters/extensions';
import { mediaModal } from '@/blocks/functions/media-modal';
import { useBlockAttributes } from '@/blocks/hooks/use-block-attributes';
import '@/blocks/integrations/seo';
import { store } from '@/blocks/store';
import { transforms } from '@/blocks/transforms';
import { isAllowedToRender } from '@/blocks/utils/is-allowed-to-render';
import { needsFieldInitialization } from '@/blocks/utils/needs-field-initialization';
import { sendEvents } from '@/blocks/utils/send-events';
import { store as tailwindStore } from '@/tailwind/store';
import { useTailwind } from '@/tailwind/use-tailwind';
import { BlockstudioAttribute } from '@/types/block';
import { BlockstudioBlock, BlockstudioBlockAttributes } from '@/types/types';
import { onSavePost } from '@/utils/on-save-post';
import type { PreloadEntry } from '../canvas/types';

(window as unknown as Record<string, boolean>)[
  '__@hello-pangea/dnd-disable-dev-warnings'
] = true;
register(store);
register(tailwindStore);
renderCache.initFromPreload();
mediaModal();
initializeEditorReadinessGate();
initializeCanvasBodyClasses();

const blocks = window.blockstudioAdmin.data.blocksNative;

const registerSingleBlock = (block: BlockstudioBlock) => {
  if (!isAllowedToRender(block.blockstudio as BlockstudioAttribute)) return;

  const blockstudioVariations = (
    block.blockstudio as BlockstudioBlock['blockstudio'] & {
      variations?: BlockstudioBlock['variations'];
    }
  ).variations;

  // @ts-ignore
  registerBlockType(block, {
    ...(block?.blockstudio?.icon
      ? {
          icon: {
            src: parse(block?.blockstudio?.icon),
          },
        }
      : {}),
    apiVersion: 3,
    variations: block.variations ?? blockstudioVariations ?? [],
    providesContext: { [block.name]: 'blockstudio' },
    transforms: transforms(
      block,
      blocks as unknown as Record<string, BlockstudioBlock>,
    ),
    usesContext: ['postId', 'postType', ...(block?.usesContext || [])],
    save: () => <InnerBlocks.Content />,
    edit: ({
      attributes,
      setAttributes: inheritedSetAttributes,
      context,
      clientId,
    }: {
      attributes: BlockstudioBlockAttributes;
      setAttributes: (attributes: BlockstudioBlockAttributes) => void;
      context: Record<string, unknown>;
      clientId: string;
    }) => {
      const setAttributes = useBlockAttributes(
        clientId,
        inheritedSetAttributes,
      );
      const [isLoaded, setIsLoaded] = useState(
        () =>
          !needsFieldInitialization(
            block.blockstudio?.attributes,
            attributes.blockstudio?.attributes,
          ),
      );
      const [isExpandedEditorOpen, setIsExpandedEditorOpen] = useState(false);

      useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
      }, []);

      const expandedEditorBlocks = [block, ...getMatches(block.name)];

      return (
        <>
          {!isLoaded &&
            createPortal(
              <div data-blockstudio-initialization style={{ display: 'none' }}>
                <Fields
                  {...{
                    attributes,
                    setAttributes,
                    block,
                    clientId,
                  }}
                  portal
                />
                <style>{`.blockstudio-fields .components-form-toggle__track, .blockstudio-fields .components-form-toggle__thumb { transition: none !important; }`}</style>
              </div>,
              document.body,
            )}
          <InspectorControls>
            <ExpandedEditor
              {...{
                attributes,
                block,
                blocks: expandedEditorBlocks,
                clientId,
                setAttributes,
              }}
              onOpenChange={setIsExpandedEditorOpen}
            />
            {!isExpandedEditorOpen && (
              <Fields
                {...{
                  attributes,
                  block,
                  clientId,
                  setAttributes,
                }}
              />
            )}
          </InspectorControls>
          {isLoaded && (
            <Block
              {...{
                attributes,
                block,
                clientId,
                context,
                setAttributes,
              }}
            />
          )}
        </>
      );
    },
  });
};

Object.values(blocks).forEach((block: BlockstudioBlock) => {
  registerSingleBlock(block);
});

window.blockstudio.registerBlock = (block: BlockstudioBlock) => {
  (blocks as any)[block.name] = block;
  registerSingleBlock(block);
};

window.blockstudio.addPreloads = (entries: PreloadEntry[]) => {
  renderCache.addPreloads(entries);
};

window.blockstudio.replacePreloads = (entries: PreloadEntry[]) => {
  renderCache.replacePreloads(entries);
};

registerPlugin('blockstudio-tailwind', {
  render: () => {
    if (window.blockstudioAdmin.isTailwindActive === 'false') return;

    useTailwind({
      enabled: true,
    });

    return <></>;
  },
});

onSavePost(sendEvents);
