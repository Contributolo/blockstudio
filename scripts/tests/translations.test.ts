import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { runtime } from '../lib/runtime.ts';
import { parsePo, translated, type Message } from '../lib/gettext.ts';
import {
  parseWordPressLocales,
  parseLocaleSnapshot,
  pluralExamples,
  validateLocale,
  type Locale,
} from '../i18n-locales.ts';
import {
  codexArguments,
  messagesFromTemplate,
  options,
  planTranslations,
  readCatalog,
  responseSchema,
  translateLocale,
  translationModel,
  translationFailure,
  translationPrompt,
  validateResponse,
  validateTranslation,
} from '../translate.ts';

const french: Locale = {
  locale: 'fr_FR',
  englishName: 'French (France)',
  nativeName: 'French',
  direction: 'ltr',
  nplurals: 2,
  pluralExpression: 'n > 1',
};
const message = (id: string, plural = '', context = ''): Message => ({
  id,
  plural,
  context,
  comments: [],
  references: [],
  phpFormat: false,
});
const header =
  'msgid ""\nmsgstr ""\n"Language: fr_FR\\n"\n"Plural-Forms: nplurals=2; plural=n > 1;\\n"\n\n';
const run = <A>(
  effect: Effect.Effect<A, unknown, import('../lib/runtime.ts').Services>,
) => Effect.runPromise(effect.pipe(Effect.provide(runtime)));

test('WordPress locale discovery reads defaults and variants without executing upstream PHP', () => {
  const locales = parseWordPressLocales(
    `<?php
class GP_Locale { public $nplurals=2; public $plural_expression='n != 1'; public $text_direction='ltr'; }
$de = new GP_Locale(); $de->english_name='German'; $de->native_name='Deutsch'; $de->wp_locale='de_DE';
$ja = new GP_Locale(); $ja->english_name='Japanese'; $ja->native_name='Japanese'; $ja->wp_locale='ja'; $ja->nplurals=1; $ja->plural_expression='0';
$unused = new GP_Locale(); $unused->english_name='No WordPress locale';
throw new Exception('Downloaded code must never execute');`,
    {
      translations: [
        {
          language: 'de_DE_formal',
          english_name: 'German (Formal)',
          native_name: 'Deutsch (Sie)',
        },
        { language: 'ja' },
      ],
    },
  );
  assert.deepEqual(
    locales.map((item) => item.locale),
    ['de_DE', 'de_DE_formal', 'ja'],
  );
  assert.equal(locales[1].nplurals, 2);
  assert.equal(locales[2].pluralExpression, '0');
  assert.throws(
    () =>
      parseWordPressLocales('<?php', {
        translations: [{ language: 'unknown' }],
      }),
    /no known plural rule/,
  );
});

test('locale metadata rejects unsafe filenames and validates one, three and six plural forms', () => {
  for (const locale of ['../../bad', 'fr/FR', 'fr-FR', ''])
    assert.throws(() => validateLocale({ ...french, locale }), /Invalid/);
  assert.throws(
    () => validateLocale({ ...french, pluralExpression: 'process.exit()' }),
    /Invalid/,
  );
  assert.throws(
    () => validateLocale({ ...french, pluralExpression: '7' }),
    /Invalid plural rule/,
  );
  assert.throws(
    () =>
      parseLocaleSnapshot(
        JSON.stringify({ version: 1, locales: [french, french] }),
      ),
    /Duplicate/,
  );
  assert.equal(
    pluralExamples({ ...french, nplurals: 1, pluralExpression: '0' }).length,
    1,
  );
  const russian = {
    ...french,
    nplurals: 3,
    pluralExpression:
      'n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2',
  };
  assert.deepEqual(
    pluralExamples(russian).map((values) => values[0]),
    [1, 2, 0],
  );
  const arabic = {
    ...french,
    nplurals: 6,
    pluralExpression:
      'n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5',
  };
  assert.deepEqual(
    pluralExamples(arabic).map((values) => values[0]),
    [0, 1, 2, 3, 11, 100],
  );
});

test('PO parsing retains context and translator guidance and rejects duplicate keys', () => {
  const text =
    '#. translators: a toolbar action\n#: src/example.ts\nmsgctxt "verb"\nmsgid "Post"\nmsgstr ""\n';
  assert.deepEqual(messagesFromTemplate(text)[0], {
    ...message('Post', '', 'verb'),
    comments: ['translators: a toolbar action'],
    references: ['src/example.ts'],
  });
  assert.throws(
    () => readCatalog(text + '\n' + text, 'fixture.po'),
    /duplicate/,
  );
  assert.throws(() => messagesFromTemplate('not a catalog'), /cannot be read/);
});

test('translation plans preserve filled forms and block fuzzy or changed source plurals', () => {
  const po = readCatalog(
    header +
      'msgid "One %s"\nmsgid_plural "Many %s"\nmsgstr[0] "Un %s"\nmsgstr[1] ""\n\n#, fuzzy\nmsgid "Review"\nmsgstr "Revoir"\n\nmsgid "Changed"\nmsgid_plural "Old plural"\nmsgstr[0] "Avant"\nmsgstr[1] "Avant"\n',
    'fixture.po',
  );
  const plan = planTranslations(
    [
      message('One %s', 'Many %s'),
      message('Review'),
      message('Changed', 'New plural'),
    ],
    french,
    po,
  );
  assert.equal(plan.pending.length, 1);
  assert.deepEqual(plan.pending[0].existing, ['Un %s', '']);
  assert.deepEqual(plan.blocked, ['Review', 'Changed']);
  assert.throws(
    () => planTranslations([], { ...french, locale: 'ja' }, po),
    /Language header/,
  );
  const sparse = parsePo(
    'msgid "One"\nmsgid_plural "Many"\nmsgstr[1] "Plusieurs"',
    'fixture.po',
  ).entries[0];
  assert.equal(translated(sparse, message('One', 'Many'), 2), false);
});

test('structured output requires exact keys, counts, locale, context and existing forms', () => {
  const items = planTranslations(
    [
      message('One %s', 'Many %s'),
      message('Post', '', 'verb'),
      message('Post', '', 'noun'),
    ],
    french,
    null,
  ).pending;
  items[0].existing[0] = 'Un %s';
  const good = {
    locale: 'fr_FR',
    translations: [
      { key: '0', forms: ['Un %s', 'Plusieurs %s'] },
      { key: '1', forms: ['Publier'] },
      { key: '2', forms: ['Article'] },
    ],
  };
  assert.equal(validateResponse(good, french, items).size, 3);
  for (const response of [
    { ...good, locale: 'de_DE' },
    { ...good, translations: good.translations.slice(0, 2) },
    { ...good, translations: [...good.translations, good.translations[0]] },
    { ...good, translations: [{ key: 'unknown', forms: ['Un %s'] }] },
    {
      ...good,
      translations: [
        { key: '0', forms: ['Une %s', 'Plusieurs %s'] },
        ...good.translations.slice(1),
      ],
    },
    {
      ...good,
      translations: [
        { key: '0', forms: ['Un %s'] },
        ...good.translations.slice(1),
      ],
    },
  ])
    assert.throws(() => validateResponse(response, french, items));
  assert.equal(
    responseSchema(french, items).properties.translations.minItems,
    3,
  );
  assert.match(translationPrompt(french, items), /"context":"verb"/);
});

test('translation validation protects placeholders, markup, identifiers and literal labels', () => {
  validateTranslation('%1$s: %2$d', '%2$d : %1$s');
  validateTranslation('Zoom to 100%', 'Handitu %100era');
  for (const [source, target] of [
    ['Value %s', 'Valeur'],
    ['Value %s', 'Valeur %d'],
    ['%s: %d', '%d : %s'],
    ['Value', '<script>alert(1)</script>'],
    ['<a href="/">Link</a>', '<a href="bad">Lien</a>'],
    ['Value', '\u0000'],
    ['Value', ''],
    ['h1', 'heading'],
    ['Use blockstudio.attributes', 'Use attributes'],
    ['Blockstudio', 'Block Studio'],
  ])
    assert.throws(() => validateTranslation(source, target));
});

test('single-form and six-form locales enforce the exact plural count and placeholders in every form', () => {
  for (const count of [1, 6]) {
    const locale = { ...french, nplurals: count };
    const items = planTranslations(
      [message('%d block', '%d blocks')],
      locale,
      null,
    ).pending;
    const forms = Array.from({ length: count }, () => '%d translated');
    const response = {
      locale: locale.locale,
      translations: [{ key: '0', forms }],
    };
    assert.equal(
      validateResponse(response, locale, items).get('0')?.length,
      count,
    );
    assert.throws(() =>
      validateResponse(
        {
          ...response,
          translations: [{ key: '0', forms: [...forms, '%d extra'] }],
        },
        locale,
        items,
      ),
    );
    forms[count - 1] = 'Missing placeholder';
    assert.throws(
      () => validateResponse(response, locale, items),
      /placeholders/,
    );
  }
});

test('a complete catalog is byte-identical and never calls Codex on rerun', async (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'bs-translation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = resolve(directory, 'blockstudio-fr_FR.po');
  const source =
    header +
    '# Human translation, keep exactly.\nmsgid "Done"\nmsgstr "Termine"\n';
  writeFileSync(file, source);
  const mtime = statSync(file).mtimeMs;
  const result = await run(
    translateLocale(directory, french, [message('Done')], () =>
      Effect.die('Must not call the model'),
    ),
  );
  assert.equal(result.translated, 0);
  assert.equal(readFileSync(file, 'utf8'), source);
  assert.equal(statSync(file).mtimeMs, mtime);
});

test('failed batches checkpoint approved work, resume missing entries and preserve manual translations', async (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'bs-translation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = resolve(directory, 'blockstudio-fr_FR.po');
  writeFileSync(file, header + 'msgid "Manual"\nmsgstr "Human approved"\n');
  const messages = [message('Manual'), message('First'), message('Second')];
  let calls = 0;
  await assert.rejects(
    run(
      translateLocale(
        directory,
        french,
        messages,
        (_locale, items) => {
          calls++;
          return calls === 1
            ? Effect.succeed(new Map([[items[0].key, ['Premier']]]))
            : Effect.fail(new Error('Model failed'));
        },
        translationModel,
        1,
      ),
    ),
    /Model failed/,
  );
  assert.match(readFileSync(file, 'utf8'), /msgstr "Premier"/);
  calls = 0;
  await run(
    translateLocale(directory, french, messages, (_locale, items) => {
      calls++;
      assert.equal(items.length, 1);
      assert.equal(items[0].message.id, 'Second');
      return Effect.succeed(new Map([[items[0].key, ['Deuxieme']]]));
    }),
  );
  const po = readCatalog(readFileSync(file, 'utf8'), file);
  assert.equal(calls, 1);
  assert.deepEqual(
    po.entries.map((entry) => entry.strings[0]),
    ['Human approved', 'Premier', 'Deuxieme'],
  );
});

test('failure leaves no catalog and concurrent human edits are never overwritten', async (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'bs-translation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = resolve(directory, 'blockstudio-fr_FR.po');
  await assert.rejects(
    run(
      translateLocale(directory, french, [message('Done')], () =>
        Effect.fail(new Error('Invalid output')),
      ),
    ),
    /Invalid output/,
  );
  assert.equal(existsSync(file), false);
  await assert.rejects(
    run(
      translateLocale(directory, french, [message('Done')], (_locale, items) =>
        Effect.sync(() => {
          writeFileSync(file, 'Edited while translating');
          return new Map([[items[0].key, ['Termine']]]);
        }),
      ),
    ),
    /changed during translation/,
  );
  assert.equal(readFileSync(file, 'utf8'), 'Edited while translating');
});

test('Codex invocation uses the requested model and an isolated read-only structured-output session', () => {
  const args = codexArguments('/tmp/translation', translationModel, 'prompt');
  for (const flag of [
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--output-schema',
    '--output-last-message',
    'read-only',
    'project_doc_max_bytes=0',
    'web_search="disabled"',
    'shell_tool',
  ])
    assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.equal(args[args.indexOf('--cd') + 1], '/tmp/translation');
  assert.equal(options([]).concurrency, 4);
  assert.equal(options(['--dry-run']).model, 'gpt-6-luna');
  assert.throws(() => options(['--concurrency', '0']), /Concurrency/);
  assert.throws(() => options(['--batch-size', '999']), /Batch size/);
});

test('retry diagnostics do not echo complete prompts and incompatible plural headers are rejected', () => {
  const error = {
    _tag: 'CommandFailed',
    exitCode: 1,
    message: 'Full prompt must not be repeated',
    stderr: 'Model unavailable',
    stdout: '',
  };
  assert.equal(translationFailure(error), 'Codex exited 1: Model unavailable');
  const po = readCatalog(header, 'fixture.po');
  assert.throws(
    () => planTranslations([], { ...french, nplurals: 6 }, po),
    /Plural-Forms/,
  );
});
