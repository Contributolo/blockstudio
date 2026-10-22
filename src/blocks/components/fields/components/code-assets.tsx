import { useEffect, useRef, useState } from '@wordpress/element';
import { getEditorDocument } from '@/blocks/utils/get-editor-document';
import { BlockstudioAttribute } from '@/types/block';

type CleanupElement = HTMLElement & {
  __blockstudioCleanupUnsubscribe?: () => void;
};

export type CodeAssetProps = {
  clientId?: string;
  extensions?: boolean;
  inRepeater?: boolean;
  item: BlockstudioAttribute;
  repeaterId?: string;
  value: string;
};

// Asset initialization must not wait for CodeMirror's async chunk.
export const CodeAssets = ({
  clientId,
  extensions,
  inRepeater,
  item,
  repeaterId,
  ...rest
}: CodeAssetProps) => {
  const replacedVal = rest.value?.replaceAll(
    '%selector%',
    `.is-root-container [data-block="${clientId}"]`,
  );

  const scssEnabled = item.language === 'scss';
  const [compiledCss, setCompiledCss] = useState<string>(replacedVal);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const cleanupReadyRef = useRef(false);

  useEffect(() => {
    if (!scssEnabled) {
      setCompiledCss(replacedVal);
      return;
    }

    if (!replacedVal) {
      setCompiledCss('');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await window.fetch(
          `${window.blockstudioAdmin.rest}blockstudio/v1/scss/compile`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-WP-Nonce': window.blockstudioAdmin.nonceRest,
            },
            body: JSON.stringify({ scss: replacedVal }),
          },
        );
        const data = await res.json();
        if (data.css !== undefined) setCompiledCss(data.css);
      } catch {
        setCompiledCss(replacedVal);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [replacedVal, scssEnabled]);

  const isCssLike = item.language === 'css' || item.language === 'scss';

  useEffect(() => {
    if (!isCssLike && item.language !== 'javascript') return;
    if (!item.asset && !extensions) return;

    const id = `blockstudio-${clientId}-${inRepeater ? repeaterId : item.id}`;
    const doc = getEditorDocument();

    let element = doc.getElementById(id);
    if (!element) {
      element = doc.createElement(isCssLike ? 'style' : 'script');
      element.id = id;
      if (isCssLike) {
        doc.head.appendChild(element);
      } else {
        doc.body.appendChild(element);
      }
    }

    const injectedValue = scssEnabled ? compiledCss : replacedVal;
    element.innerHTML = injectedValue;
  }, [compiledCss, replacedVal, clientId]);

  useEffect(() => {
    if (!isCssLike && item.language !== 'javascript') return;
    if (!item.asset && !extensions) return;

    const id = `blockstudio-${clientId}-${inRepeater ? repeaterId : item.id}`;
    const doc = getEditorDocument();
    const win = doc.defaultView;
    const element = doc.getElementById(id) as CleanupElement | null;

    if (element?.__blockstudioCleanupUnsubscribe) {
      element.__blockstudioCleanupUnsubscribe();
      element.__blockstudioCleanupUnsubscribe = undefined;
    }

    cleanupReadyRef.current = false;
    const readyTimer = win?.setTimeout(() => {
      cleanupReadyRef.current = true;
    }, 0);

    return () => {
      if (readyTimer) {
        win?.clearTimeout(readyTimer);
      }

      if (!cleanupReadyRef.current) {
        return;
      }

      const removeIfBlockGone = () => {
        const blockEditor = (window as any).wp?.data?.select?.(
          'core/block-editor',
        );
        const blockExists =
          clientId && typeof blockEditor?.getBlock === 'function'
            ? !!blockEditor.getBlock(clientId)
            : !!doc.querySelector(`[data-block="${clientId}"]`);

        if (!blockExists) {
          const element = doc.getElementById(id) as CleanupElement | null;
          element?.__blockstudioCleanupUnsubscribe?.();
          element?.remove();
          return true;
        }

        return false;
      };

      if (!win) {
        removeIfBlockGone();
        return;
      }

      win.setTimeout(() => {
        if (removeIfBlockGone()) {
          return;
        }

        const subscribe = (window as any).wp?.data?.subscribe;
        if (typeof subscribe === 'function') {
          const unsubscribe = subscribe(() => {
            if (removeIfBlockGone()) {
              unsubscribe();
            }
          });
          const element = doc.getElementById(id) as CleanupElement | null;
          if (element) {
            element.__blockstudioCleanupUnsubscribe = unsubscribe;
          }
          return;
        }

        const observer = new win.MutationObserver(() => {
          if (removeIfBlockGone()) {
            observer.disconnect();
          }
        });
        observer.observe(doc.body, {
          childList: true,
          subtree: true,
        });
        const element = doc.getElementById(id) as CleanupElement | null;
        if (element) {
          element.__blockstudioCleanupUnsubscribe = () => observer.disconnect();
        }
      }, 0);
    };
  }, [
    clientId,
    extensions,
    inRepeater,
    isCssLike,
    item.asset,
    item.id,
    item.language,
    repeaterId,
  ]);

  return null;
};
