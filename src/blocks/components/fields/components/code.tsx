import { useContext } from 'react';
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';
import { css as cssLang, cssCompletionSource } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { CodeAssets } from '@/blocks/components/fields/components/code-assets';
import { CodePopoutContext } from '@/blocks/components/fields/components/code-popout';
import { useGetCssVariables } from '@/blocks/hooks/use-get-css-variables';
import { style } from '@/const/index';
import { BlockstudioAttribute } from '@/types/block';
import { __ } from '@/utils/__';
import { css } from '@/utils/css';

const cssVariablesCompletion = (
  cssVariables: string[],
): ((context: CompletionContext) => CompletionResult | null) => {
  const variables = cssVariables.map((v) => `--${v}`); // Format variables

  return (context: CompletionContext) => {
    const word = context.matchBefore(/--[\w-]*$/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    return {
      from: word.from,
      to: word.to,
      options: variables.map((variable) => ({
        label: variable,
        type: 'variable',
        apply: variable,
      })),
      validFor: /^[\w-]*$/,
    };
  };
};

export const Code = ({
  clientId,
  extensions,
  inRepeater,
  item,
  repeaterId,
  ...rest
}: {
  clientId?: string;
  extensions?: boolean;
  inRepeater?: boolean;
  item: BlockstudioAttribute;
  onChange: (value: string) => void;
  repeaterId?: string;
  value: string;
}) => {
  const popoutState = useContext(CodePopoutContext);
  const settingsCssVariables = useGetCssVariables(
    window.blockstudioAdmin?.styles,
    window.blockstudioAdmin?.cssVariables ?? [],
  );

  const getExtensions = () => {
    switch (item.language) {
      case 'css':
      case 'scss':
        return [
          cssLang(),
          autocompletion({
            override: [
              (context: CompletionContext) => {
                const cssVarResult =
                  cssVariablesCompletion(settingsCssVariables)(context);
                if (cssVarResult) return cssVarResult;

                return cssCompletionSource(context);
              },
            ],
          }),
        ];
      case 'javascript':
        return [javascript()];
      case 'json':
        return [json()];
      case 'html':
      default:
        return [html(), javascript(), json(), php()];
    }
  };

  const editorProps = {
    ...rest,
    basicSetup: {
      autocompletion:
        item.autoCompletion !== undefined ? item.autoCompletion : true,
      lineNumbers: item.lineNumbers || false,
      foldGutter: item.lineNumbers || false,
    },
    theme: item.theme === 'dark' ? githubDark : githubLight,
    extensions: getExtensions(),
  };

  // Stop undo/redo from bubbling to Gutenberg so CodeMirror handles its own history
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isUndo =
      (isMac ? e.metaKey : e.ctrlKey) && e.key === 'z' && !e.shiftKey;
    const isRedo =
      (isMac ? e.metaKey : e.ctrlKey) &&
      (e.key === 'y' || (e.key === 'z' && e.shiftKey));

    if (isUndo || isRedo) {
      e.stopPropagation();
    }
  };

  return (
    <>
      <CodeAssets
        {...{ clientId, extensions, inRepeater, item, repeaterId }}
        value={rest.value}
      />
      <div
        onKeyDown={handleKeyDown}
        css={css({
          border: style.border,
          borderRadius: style.borderRadius,
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        <CodeMirror
          {...editorProps}
          height={item.height || '200px'}
          maxHeight={item.maxHeight}
          minHeight={item.minHeight}
        />
      </div>
      {popoutState && (
        <popoutState.Popout>
          <CodeMirror {...editorProps} height="100%" />
        </popoutState.Popout>
      )}
    </>
  );
};
