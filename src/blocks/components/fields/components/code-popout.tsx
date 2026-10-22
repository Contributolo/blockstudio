import { ReactNode, createContext } from 'react';
import { external } from '@wordpress/icons';
import { LabelAction } from '@/blocks/components/label';
import { usePopout } from '@/blocks/hooks/use-popout';
import { BlockstudioAttribute } from '@/types/block';
import { __ } from '@/utils/__';

export const CodePopoutContext = createContext<{
  isOpen: boolean;
  Popout: ({ children }: { children: ReactNode }) => ReactNode;
} | null>(null);

export const CodeActions = ({
  item,
  children,
}: {
  item: BlockstudioAttribute;
  children: (props: { actions: LabelAction[] }) => ReactNode;
}) => {
  const { isOpen, open, close, Popout } = usePopout({
    title: item.label || 'Code Editor',
  });
  const showPopout = item.popout === true;

  const actions: LabelAction[] = showPopout
    ? [
        {
          icon: external,
          onClick: isOpen ? close : open,
          label: __('Open in popup'),
        },
      ]
    : [];

  return (
    <CodePopoutContext.Provider value={showPopout ? { isOpen, Popout } : null}>
      {children({ actions })}
    </CodePopoutContext.Provider>
  );
};
