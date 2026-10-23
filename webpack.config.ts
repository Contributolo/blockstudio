import { createRequire } from 'node:module';
import path from 'node:path';
import type { Configuration, WebpackPluginInstance } from 'webpack';

const require = createRequire(import.meta.url);
const defaultConfig: Configuration = require('@wordpress/scripts/config/webpack.config');
const DependencyExtractionWebpackPlugin: new (options: {
  injectPolyfill: boolean;
}) => WebpackPluginInstance = require('@wordpress/dependency-extraction-webpack-plugin');
const __dirname = import.meta.dirname;
const splitChunks = defaultConfig.optimization?.splitChunks || {};

// Libraries of the lazily loaded field editors get stable, readable chunk names
// instead of numeric ids. Only async chunks are touched, entries stay as they are.
const vendorChunk = (name: string, packages: string[], priority = 20) => ({
  test: new RegExp(`[\\\\/]node_modules[\\\\/](${packages.join('|')})[\\\\/]`),
  name: `blocks/${name}`,
  chunks: 'async' as const,
  enforce: true,
  priority,
});

export default {
  ...defaultConfig,
  entry: {
    'blocks/index.tsx': path.resolve(__dirname, 'src/blocks/index.tsx'),
    'pages/index': path.resolve(__dirname, 'src/pages/index.ts'),
    'admin/index': path.resolve(__dirname, 'src/admin/index.tsx'),
    'devtools/index': path.resolve(__dirname, 'src/devtools/index.ts'),
    'canvas/index': path.resolve(__dirname, 'src/canvas/index.tsx'),
  },
  output: {
    ...defaultConfig.output,
    path: path.resolve(__dirname, 'includes/admin/assets'),
    clean: false,
  },
  resolve: {
    ...defaultConfig.resolve,
    alias: {
      ...defaultConfig.resolve?.alias,
      '@/blocks': path.resolve(__dirname, 'src/blocks'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/const': path.resolve(__dirname, 'src/const'),
      '@/pages': path.resolve(__dirname, 'src/pages'),
      '@/tailwind': path.resolve(__dirname, 'src/tailwind'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/devtools': path.resolve(__dirname, 'src/devtools'),
      '@/canvas': path.resolve(__dirname, 'src/canvas'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  optimization: {
    ...defaultConfig.optimization,
    splitChunks: {
      ...splitChunks,
      cacheGroups: {
        ...splitChunks.cacheGroups,
        codemirrorJavascript: vendorChunk(
          'codemirror-javascript',
          ['@codemirror/lang-javascript', '@lezer/javascript'],
          30,
        ),
        codemirrorCss: vendorChunk(
          'codemirror-css',
          ['@codemirror/lang-css', '@lezer/css'],
          30,
        ),
        codemirrorMarkup: vendorChunk(
          'codemirror-markup',
          [
            '@codemirror/lang-(?:html|json|php)',
            '@lezer/(?:html|json|php)',
            '@uiw/codemirror-theme(?:s|-github)',
          ],
          30,
        ),
        codemirror: vendorChunk('codemirror', [
          '@babel/runtime',
          '@codemirror',
          '@lezer',
          '@marijn',
          '@uiw',
          'crelt',
          'style-mod',
        ]),
        tiptap: vendorChunk('tiptap', [
          '@floating-ui',
          '@tiptap',
          'fast-equals',
          'linkifyjs',
          'orderedmap',
          'prosemirror-[^\\\\/]+',
          'rope-sequence',
        ]),
      },
    },
  },
  plugins: [
    ...(defaultConfig.plugins ?? []).filter(
      (plugin) =>
        plugin &&
        plugin.constructor.name !== 'DependencyExtractionWebpackPlugin',
    ),
    new DependencyExtractionWebpackPlugin({
      injectPolyfill: true,
    }),
  ],
} satisfies Configuration;
