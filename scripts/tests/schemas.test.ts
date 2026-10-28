import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { Ajv } from 'ajv';

const root = resolve(import.meta.dirname, '../..');

type SchemaNode = Record<string, unknown>;
type Field = Record<string, unknown>;

const fieldSchema = (
  name: 'block' | 'extend' = 'block',
): {
  common: Set<string>;
  byType: Map<string, Set<string>>;
} => {
  const schema = JSON.parse(
    readFileSync(join(root, `schemas/${name}.json`), 'utf8'),
  );
  const items = schema.properties.blockstudio.properties.attributes.items;
  const byType = new Map<string, Set<string>>();

  for (const branch of items.anyOf as SchemaNode[]) {
    const properties = branch.properties as Record<string, SchemaNode>;
    const type = properties.type?.const;
    if (typeof type === 'string') {
      byType.set(type, new Set(Object.keys(properties)));
    }
  }

  return { common: new Set(Object.keys(items.properties)), byType };
};

const definitionFiles = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((path) => /(^|\/)(block|field)\.json$/.test(path))
    .map((path) => join(directory, path));

const fieldsOf = (definition: unknown): unknown[] => {
  if (typeof definition !== 'object' || definition === null) return [];
  const { blockstudio, attributes } = definition as Record<string, unknown>;
  const fields =
    typeof blockstudio === 'object' && blockstudio !== null
      ? (blockstudio as Record<string, unknown>).attributes
      : attributes;

  return Array.isArray(fields) ? fields : [];
};

test('test theme fields only use properties their block or extension schema declares', () => {
  const unknown: string[] = [];
  const blockSchema = fieldSchema();
  const extensionSchema = fieldSchema('extend');

  const visit = (
    fields: unknown[],
    file: string,
    { common, byType }: ReturnType<typeof fieldSchema>,
  ) => {
    for (const field of fields) {
      if (typeof field !== 'object' || field === null) continue;
      const { type, attributes, tabs } = field as Field;
      const declared = typeof type === 'string' ? byType.get(type) : undefined;

      if (declared) {
        for (const key of Object.keys(field)) {
          if (!common.has(key) && !declared.has(key)) {
            unknown.push(
              `${relative(root, file)}: ${String(type)} field "${String((field as Field).id ?? '')}" uses "${key}"`,
            );
          }
        }
      }

      if (Array.isArray(attributes))
        visit(attributes, file, { common, byType });
      if (Array.isArray(tabs)) {
        for (const tab of tabs) {
          const tabFields = (tab as Field | null)?.attributes;
          if (Array.isArray(tabFields))
            visit(tabFields, file, { common, byType });
        }
      }
    }
  };

  const files = definitionFiles(join(root, 'tests/theme'));
  assert.ok(files.length > 100);

  for (const file of files) {
    visit(fieldsOf(JSON.parse(readFileSync(file, 'utf8'))), file, blockSchema);
  }

  const extensions = join(root, 'tests/theme/blockstudio/extensions');
  for (const entry of readdirSync(extensions).filter((file) =>
    file.endsWith('.json'),
  )) {
    const file = join(extensions, entry);
    visit(
      fieldsOf(JSON.parse(readFileSync(file, 'utf8'))),
      file,
      extensionSchema,
    );
  }

  assert.deepEqual(unknown, []);
});

const branchType = (branch: SchemaNode) =>
  (branch.properties as Record<string, SchemaNode> | undefined)?.type?.const;

const fieldContexts = (node: unknown): SchemaNode[] => {
  if (!node || typeof node !== 'object') return [];
  const object = node as SchemaNode;
  const contexts =
    Array.isArray(object.anyOf) &&
    object.anyOf.some((branch) => branchType(branch) === 'text')
      ? [object]
      : [];
  for (const child of Object.values(object))
    contexts.push(...fieldContexts(child));
  return contexts;
};

const choices = [{ value: 'a', label: 'A' }];
const cases: [Field, string, unknown][] = [
  [
    {
      type: 'radio',
      options: choices,
      display: 'buttonGroup',
      allowNull: true,
    },
    'display',
    true,
  ],
  [{ type: 'radio', options: choices, allowNull: false }, 'allowNull', 'yes'],
  [{ type: 'checkbox', options: choices, toggle: true }, 'toggle', 1],
  [{ type: 'checkbox', options: choices, toggle: 'Select all' }, 'toggle', {}],
  [{ type: 'code', language: 'css', asset: true }, 'asset', 'yes'],
  [{ type: 'wysiwyg', mode: 'both' }, 'mode', 'unsupported'],
  [{ type: 'wysiwyg', mode: 'code' }, 'mode', true],
  [
    {
      type: 'repeater',
      default: [{ label: 'First' }],
      attributes: [{ id: 'label', type: 'text' }],
    },
    'default',
    'First',
  ],
  [
    {
      type: 'color',
      default: '#f00',
      fallback: '#f00',
      options: [{ name: 'Red', value: '#f00' }],
    },
    'default',
    false,
  ],
  [{ type: 'color', fallback: '#f00' }, 'fallback', []],
  [{ type: 'gradient', default: 'linear-gradient(red, blue)' }, 'default', {}],
  [{ type: 'gradient', fallback: 'linear-gradient(red, blue)' }, 'fallback', 1],
];

for (const name of ['block', 'extend'] as const) {
  test(`${name} schema validates supported field options in every applicable context`, () => {
    const schema = JSON.parse(
      readFileSync(join(root, `schemas/${name}.json`), 'utf8'),
    );
    const contexts = fieldContexts(schema);
    assert.equal(contexts.length, 3);
    const ajv = new Ajv({ strict: false, allErrors: true });
    for (const context of contexts) {
      const validate = ajv.compile({
        ...context,
        definitions: schema.definitions,
      });
      const branches = context.anyOf as SchemaNode[];
      for (const [properties, key, invalid] of cases) {
        if (!branches.some((branch) => branchType(branch) === properties.type))
          continue;
        const field = { id: 'schemaFixture', ...properties };
        assert.equal(
          validate(field),
          true,
          JSON.stringify({ field, errors: validate.errors }),
        );
        assert.equal(
          validate({ ...field, [key]: invalid }),
          false,
          `${name}: invalid ${String(properties.type)}.${key}`,
        );
      }
      if ((context.properties as SchemaNode).set) {
        assert.equal(
          validate({
            id: 'label',
            type: 'text',
            set: [{ attribute: 'class', value: '{attributes.label}' }],
          }),
          true,
        );
      }
    }
  });
}
