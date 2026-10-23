import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Effect } from 'effect';
import * as HttpClient from 'effect/http/HttpClient';
import type { Engine as PhpEngine } from 'php-parser';
import { writeAtomic } from './lib/files.ts';
import { attempt, main } from './lib/runtime.ts';

const require = createRequire(import.meta.url);
const Engine: new () => PhpEngine = require('php-parser');
const pluralForms: (
  expression: string,
) => (n: number) => number = require('@tannin/plural-forms');

export const localeSources = {
  registry:
    'https://raw.githubusercontent.com/GlotPress/GlotPress/develop/locales/locales.php',
  packages: 'https://api.wordpress.org/translations/core/1.0/',
};

export interface Locale {
  locale: string;
  englishName: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  nplurals: number;
  pluralExpression: string;
}

export const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function pluralExamples(locale: Locale): number[][] {
  const select = pluralForms(locale.pluralExpression);
  const examples: number[][] = Array.from(
    { length: locale.nplurals },
    () => [],
  );
  for (let n = 0; n <= 1000; n++) {
    const index = select(n);
    if (!Number.isInteger(index) || !examples[index])
      throw new Error(`Invalid plural rule: ${locale.locale}`);
    if (examples[index].length < 4) examples[index].push(n);
  }
  return examples;
}

export function validateLocale(value: unknown): Locale {
  const data = object(value);
  if (
    typeof data.locale !== 'string' ||
    !/^[a-z][a-z0-9]*(?:_[A-Za-z0-9]+)*$/.test(data.locale) ||
    typeof data.englishName !== 'string' ||
    !data.englishName ||
    typeof data.nativeName !== 'string' ||
    !data.nativeName ||
    !['ltr', 'rtl'].includes(String(data.direction)) ||
    !Number.isInteger(data.nplurals) ||
    Number(data.nplurals) < 1 ||
    Number(data.nplurals) > 6 ||
    typeof data.pluralExpression !== 'string' ||
    !data.pluralExpression ||
    /[^n\d\s()?:&|!=<>%+*/-]/.test(data.pluralExpression)
  ) {
    throw new Error(
      `Invalid WordPress locale metadata: ${JSON.stringify(value)}`,
    );
  }
  const locale = data as unknown as Locale;
  pluralExamples(locale);
  return locale;
}

export function parseLocaleSnapshot(text: string): Locale[] {
  const data = object(JSON.parse(text));
  if (
    data.version !== 1 ||
    !Array.isArray(data.locales) ||
    data.locales.length === 0
  )
    throw new Error('Invalid locale snapshot.');
  const locales = data.locales.map(validateLocale);
  if (new Set(locales.map(({ locale }) => locale)).size !== locales.length)
    throw new Error('Duplicate locale in snapshot.');
  return locales;
}

// Read literal metadata from the upstream AST; never execute downloaded PHP.
export function parseWordPressLocales(
  source: string,
  packages: unknown,
): Locale[] {
  const tree = new Engine().parseCode(source, 'locales.php');
  const defaults: Record<string, unknown> = {};
  const records = new Map<string, Record<string, unknown>>();
  const literal = (value: unknown) => {
    const node = object(value);
    if (node.kind === 'number') return Number(node.value);
    if (node.kind === 'string') return node.value;
    throw new Error('Expected literal locale metadata.');
  };
  const properties = new Set([
    'english_name',
    'native_name',
    'wp_locale',
    'text_direction',
    'nplurals',
    'plural_expression',
  ]);
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = object(value);
    if (
      node.kind === 'property' &&
      ['nplurals', 'plural_expression', 'text_direction'].includes(
        String(object(node.name).name),
      )
    ) {
      defaults[String(object(node.name).name)] = literal(node.value);
    }
    if (node.kind === 'assign') {
      const left = object(node.left),
        right = object(node.right);
      if (
        left.kind === 'variable' &&
        right.kind === 'new' &&
        object(right.what).name === 'GP_Locale'
      ) {
        records.set(String(left.name), { ...defaults });
      } else if (left.kind === 'propertylookup') {
        const record = records.get(String(object(left.what).name));
        const property = String(object(left.offset).name);
        if (record && properties.has(property))
          record[property] = literal(right);
      }
    }
    Object.values(node).forEach((child) => {
      if (typeof child === 'object' && child !== null) visit(child);
    });
  };
  visit(tree);
  const locales = new Map<string, Locale>();
  for (const record of records.values()) {
    if (!record.wp_locale) continue;
    const locale = validateLocale({
      locale: record.wp_locale,
      englishName: record.english_name,
      nativeName: record.native_name,
      direction: record.text_direction,
      nplurals: record.nplurals,
      pluralExpression: record.plural_expression,
    });
    if (locales.has(locale.locale))
      throw new Error(`Duplicate upstream locale: ${locale.locale}`);
    locales.set(locale.locale, locale);
  }
  const translations = object(packages).translations;
  if (!Array.isArray(translations))
    throw new Error('Invalid WordPress translation package list.');
  for (const entry of translations) {
    const data = object(entry);
    if (typeof data.language !== 'string')
      throw new Error('Missing WordPress language code.');
    if (locales.has(data.language)) continue;
    const base = locales.get(data.language.replace(/_(?:in)?formal$/, ''));
    if (!base)
      throw new Error(
        `WordPress package has no known plural rule: ${data.language}`,
      );
    const locale = validateLocale({
      ...base,
      locale: data.language,
      englishName: data.english_name,
      nativeName: data.native_name,
    });
    locales.set(locale.locale, locale);
  }
  return [...locales.values()].sort((a, b) =>
    a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0,
  );
}

export const refreshLocales = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  const registry = yield* (yield* client.get(localeSources.registry)).text;
  const packages = yield* (yield* client.get(localeSources.packages)).json;
  const locales = yield* attempt('WordPress locales', () =>
    parseWordPressLocales(registry, packages),
  );
  if (locales.length < 100)
    throw new Error(
      'Refusing an unexpectedly small WordPress locale snapshot.',
    );
  yield* writeAtomic(
    resolve(import.meta.dirname, '../languages/locales.json'),
    JSON.stringify(
      {
        version: 1,
        sources: localeSources,
        registrySha256: createHash('sha256').update(registry).digest('hex'),
        locales,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Recorded ${locales.length} WordPress locales (including source en_US).`,
  );
}).pipe(Effect.timeout('60 seconds'));

if (import.meta.main) main(refreshLocales);
