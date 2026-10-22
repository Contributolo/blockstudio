import { getRegex } from '@/blocks/components/block/utils/get-regex';

const jsonAttributes = [
  'template',
  'allowedBlocks',
  'allowedFormats',
  'autocompleters',
  'allowedTypes',
  'labels',
];

const booleanAttributes = [
  'useBlockProps',
  'directInsert',
  'templateInsertUpdatesSelection',
  'multiline',
  'withoutInteractiveFormatting',
  'preserveWhiteSpace',
  'addToGallery',
  'autoOpenMediaUpload',
  'disableDropZone',
  'dropZoneUIOnly',
  'isAppender',
  'disableMediaButtons',
];

const knownCamelCaseAttributes = [
  ...jsonAttributes,
  ...booleanAttributes,
  'defaultBlock',
  'prioritizedInserterBlocks',
  'renderAppender',
  'templateLock',
];

const normalizeAttributeNames = (attributes: Record<string, unknown>) => {
  const normalized = { ...attributes };

  knownCamelCaseAttributes.forEach((attributeName) => {
    const lowerAttributeName = attributeName.toLowerCase();
    const matchingAttributeName = Object.keys(normalized).find(
      (key) => key.toLowerCase() === lowerAttributeName,
    );

    if (!matchingAttributeName || matchingAttributeName === attributeName) {
      return;
    }

    if (!(attributeName in normalized)) {
      normalized[attributeName] = normalized[matchingAttributeName];
    }

    delete normalized[matchingAttributeName];
  });

  return normalized;
};

// The HTML parser lowercases attribute names, but they reach React props such
// as allowedFormats and have to keep the case they were written with. Names are
// read with the tokenizer's own rules (name, optional "=", quoted or unquoted
// value) so text inside a value is never taken for a name. When a name repeats,
// the parser keeps the first one, so the first spelling wins here too.
const attributeToken =
  /[\s/]*([^\s/>][^\s/>=]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/g;

const getWrittenNames = (attributesString: string) => {
  const names = new Map<string, string>();

  for (const [, name] of attributesString.matchAll(attributeToken)) {
    const lowercased = name.replace(/[A-Z]+/g, (letters) =>
      letters.toLowerCase(),
    );

    if (!names.has(lowercased)) {
      names.set(lowercased, name);
    }
  }

  return names;
};

export const getAttributes = (value: string, elementName: string) => {
  const regex = getRegex(elementName);
  const match = value.match(regex);
  const attributesString = match?.[1] || '';
  const element = `<div ${attributesString}></div>`;

  const template = document.createElement('template');
  template.innerHTML = element;

  const writtenNames = getWrittenNames(attributesString);
  const parsed: Record<string, unknown> = {};
  Array.from(template.content.firstElementChild?.attributes ?? []).forEach(
    (attribute) => {
      if (/["'<>/=\s]/.test(attribute.name)) return;
      parsed[writtenNames.get(attribute.name) ?? attribute.name] =
        attribute.value;
    },
  );
  const attributes = normalizeAttributeNames(parsed);

  jsonAttributes.forEach((key) => {
    if (!attributes[key]) {
      return;
    }

    try {
      attributes[key] = JSON.parse(attributes[key] as string);
    } catch {
      attributes[key] = [];
    }
  });

  booleanAttributes.forEach((key) => {
    if (!attributes[key]) {
      return;
    }

    if (attributes[key] === 'false') {
      attributes[key] = false;
    } else if (attributes[key]) {
      attributes[key] = true;
    }
  });

  if (attributes.templateLock === 'false') {
    attributes.templateLock = false;
  }

  return attributes;
};
