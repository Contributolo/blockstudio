import { useDispatch } from '@wordpress/data';
import { useCallback } from '@wordpress/element';
import { BlockstudioBlockAttributes } from '@/types/types';

export const useBlockAttributes = (
  clientId: string,
  fallback: (attributes: BlockstudioBlockAttributes) => void,
) => {
  const { updateBlockAttributes } = useDispatch('core/block-editor');

  return useCallback(
    (attributes: BlockstudioBlockAttributes) => {
      // Core's edit prop broadcasts writes to the entire multi-selection.
      if (clientId) {
        updateBlockAttributes(clientId, attributes);
      } else {
        fallback(attributes);
      }
    },
    [clientId, fallback, updateBlockAttributes],
  );
};
