import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getAttributes } from '../../src/blocks/components/block/utils/get-attributes';
import { getInnerHTML } from '../../src/blocks/components/block/utils/get-first-element-content';

const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);

before(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: new JSDOM('').window.document,
  });
});

after(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
  }
});

test('attributes are decoded and typed like the previous parser did', () => {
  assert.deepEqual(
    getAttributes(
      `<RichText attribute="titel" tag="h2" placeholder="Titel &amp; mehr" allowedFormats='["core/bold"]' multiline />`,
      'RichText',
    ),
    {
      attribute: 'titel',
      tag: 'h2',
      placeholder: 'Titel & mehr',
      allowedFormats: ['core/bold'],
      multiline: '',
    },
  );
  assert.deepEqual(
    getAttributes(
      `<InnerBlocks template='[["core/paragraph",{"content":"a &amp; b"}]]' templateLock="false" allowedBlocks='nope' useBlockProps="false" />`,
      'InnerBlocks',
    ),
    {
      template: [['core/paragraph', { content: 'a & b' }]],
      templateLock: false,
      allowedBlocks: [],
      useBlockProps: false,
    },
  );
  assert.deepEqual(getAttributes('<InnerBlocks />', 'InnerBlocks'), {});
  assert.deepEqual(getAttributes('<div />', 'InnerBlocks'), {});
});

test('attribute names keep the case they were written with', () => {
  assert.deepEqual(
    getAttributes(
      `<RichText ATTRIBUTE="x" keepPlaceholderOnFocus="1" data-Foo=bar allowedformats='["a"]' />`,
      'RichText',
    ),
    {
      ATTRIBUTE: 'x',
      keepPlaceholderOnFocus: '1',
      'data-Foo': 'bar',
      allowedFormats: ['a'],
    },
  );
});

test('text inside an attribute value is never read as an attribute name', () => {
  assert.deepEqual(
    getAttributes(
      `<RichText placeholder="Foo=bar Baz keepPlaceholderOnFocus=1" foo="x" baz="y" />`,
      'RichText',
    ),
    {
      placeholder: 'Foo=bar Baz keepPlaceholderOnFocus=1',
      foo: 'x',
      baz: 'y',
    },
  );
  assert.deepEqual(
    getAttributes(
      `<RichText placeholder='say "Hi" Foo=1' foo=2 />`,
      'RichText',
    ),
    { placeholder: 'say "Hi" Foo=1', foo: '2' },
  );
});

test('the first spelling of a repeated attribute wins, as in the browser', () => {
  assert.deepEqual(
    getAttributes(`<RichText fooBar=1 foobar=2 FOOBAR=3 />`, 'RichText'),
    { fooBar: '1' },
  );
});

test('attributes spread over several lines and unquoted values are read', () => {
  assert.deepEqual(
    getAttributes(
      `<RichText\n  attribute = "a"\n  tagName=p\n  isAppender\n/>`,
      'RichText',
    ),
    { attribute: 'a', tagName: 'p', isAppender: '' },
  );
});

test('inner HTML is the content of the first element', () => {
  assert.equal(
    getInnerHTML(
      `<!-- c -->\n text <section useblockprops="true"><p>x &amp; &lt;y&gt; &copy; &nbsp;</p><img src="a.png"/></section><p>second</p>`,
    ),
    '<p>x &amp; &lt;y&gt; \u00a9 &nbsp;</p><img src="a.png">',
  );
});

test('inner HTML turns empty editor components back into self-closing tags', () => {
  assert.equal(
    getInnerHTML(
      `<div useblockprops="true"><InnerBlocks template='[["a"]]'></InnerBlocks><RichText attribute="x"></RichText><MediaPlaceholder attribute="y" /></div>`,
    ),
    `<InnerBlocks template="[[&quot;a&quot;]]" /><RichText attribute="x" /><MediaPlaceholder attribute="y" />`,
  );
});

test('inner HTML parses table markup and unclosed tags like a fragment', () => {
  assert.equal(
    getInnerHTML(`<table><tr><td>x</td></tr></table>`),
    '<tbody><tr><td>x</td></tr></tbody>',
  );
  assert.equal(
    getInnerHTML(`<div useblockprops="true"><ul><li>a<li>b</ul><p>c</div>`),
    '<ul><li>a</li><li>b</li></ul><p>c</p>',
  );
  assert.equal(getInnerHTML(`just text`), '');
});
