import type { MouseEvent } from 'react';
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { preventEditorLinkNavigation } from '@/blocks/utils/prevent-editor-link-navigation';
import { BlockstudioBlock } from '@/types/types';

const blocks = window.blockstudioAdmin.data.blocksNative;

const customProps = createHigherOrderComponent((BlockListBlock) => {
  return (props) => {
    const { name } = props;

    if (
      !Object.values(blocks)
        .map((e) => (e as BlockstudioBlock).name)
        .includes(name)
    ) {
      return <BlockListBlock {...props} />;
    }

    return (
      <BlockListBlock
        {...props}
        className={[props.className, 'blockstudio-block']
          .filter(Boolean)
          .join(' ')}
        wrapperProps={{
          ...props.wrapperProps,
          onClickCapture: (event: MouseEvent<HTMLElement>) => {
            preventEditorLinkNavigation(event);
            props.wrapperProps?.onClickCapture?.(event);
          },
          onAuxClickCapture: (event: MouseEvent<HTMLElement>) => {
            preventEditorLinkNavigation(event);
            props.wrapperProps?.onAuxClickCapture?.(event);
          },
        }}
      />
    );
  };
}, 'addCustomClassNameToEditorBlock');

addFilter('editor.BlockListBlock', 'blockstudio/props', customProps);
