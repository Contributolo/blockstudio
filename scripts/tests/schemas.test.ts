import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');

type SchemaNode = Record<string, unknown>;
type Field = Record<string, unknown>;

const fieldSchema = (): {
  common: Set<string>;
  byType: Map<string, Set<string>>;
} => {
  const schema = JSON.parse(
    readFileSync(join(root, 'schemas/block.json'), 'utf8'),
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

test('test theme fields only use properties the block schema declares for their type', () => {
  const { common, byType } = fieldSchema();
  const unknown: string[] = [];

  const visit = (fields: unknown[], file: string) => {
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

      if (Array.isArray(attributes)) visit(attributes, file);
      if (Array.isArray(tabs)) {
        for (const tab of tabs) {
          const tabFields = (tab as Field | null)?.attributes;
          if (Array.isArray(tabFields)) visit(tabFields, file);
        }
      }
    }
  };

  const files = definitionFiles(join(root, 'tests/theme'));
  assert.ok(files.length > 100);

  for (const file of files) {
    visit(fieldsOf(JSON.parse(readFileSync(file, 'utf8'))), file);
  }

  assert.deepEqual(unknown, []);
});
