import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { attempt, main as runMain } from './lib/runtime.ts';

export const i18n = attempt('i18n', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const languages = resolve(root, 'languages');
  const domain = 'blockstudio';
  const potFile = resolve(languages, `${domain}.pot`);
  const wrapper = resolve(root, 'src/utils/__.ts');
  const phpSources = ['blockstudio.php', 'bootstrap.php', 'includes'];

  // A script that calls __() needs wp_set_script_translations() with the same
  // handle in PHP and an entry here, so it gets its own JSON file.
  const scripts = [
    { handle: 'blockstudio-blocks', entry: 'src/blocks/index.tsx' },
    { handle: 'blockstudio-admin-page', entry: 'src/admin/index.tsx' },
    { handle: 'blockstudio-canvas', entry: 'src/canvas/index.tsx' },
    { handle: 'blockstudio-devtools', entry: 'src/devtools/index.ts' },
  ];

  const potHeaders: [string, string][] = [
    ['Project-Id-Version', 'Blockstudio'],
    ['Report-Msgid-Bugs-To', 'https://github.com/inline0/blockstudio/issues'],
    ['MIME-Version', '1.0'],
    ['Content-Type', 'text/plain; charset=UTF-8'],
    ['Content-Transfer-Encoding', '8bit'],
    ['X-Domain', domain],
  ];

  type Message = {
    context: string;
    id: string;
    plural: string;
    comments: string[];
    references: string[];
    phpFormat: boolean;
  };

  type PoEntry = {
    context: string;
    id: string;
    plural: string;
    strings: string[];
    flags: string[];
    notes: string[];
  };

  type Po = {
    headers: [string, string][];
    entries: PoEntry[];
  };

  const problems: string[] = [];
  const check = process.argv.includes('--check');

  const keyOf = (context: string, id: string): string =>
    context ? `${context}\u0004${id}` : id;

  const filesUnder = (path: string, pattern: RegExp): string[] => {
    if (statSync(path).isFile()) {
      return pattern.test(path) ? [path] : [];
    }
    return readdirSync(path)
      .sort()
      .flatMap((name) =>
        name === 'vendor' || name === 'node_modules'
          ? []
          : filesUnder(resolve(path, name), pattern),
      );
  };

  const messages = new Map<string, Message>();

  const addMessage = (
    context: string,
    id: string,
    plural: string,
    reference: string,
    comments: string[],
    phpFormat = false,
  ): void => {
    const key = keyOf(context, id);
    const existing = messages.get(key);
    if (!existing) {
      messages.set(key, {
        context,
        id,
        plural,
        comments: [...comments],
        references: [reference],
        phpFormat,
      });
      return;
    }
    if (existing.plural !== plural) {
      problems.push(
        `${reference}: "${id}" is used with two different plural forms.`,
      );
    }
    for (const comment of comments) {
      if (!existing.comments.includes(comment)) existing.comments.push(comment);
    }
    if (!existing.references.includes(reference)) {
      existing.references.push(reference);
    }
    existing.phpFormat ||= phpFormat;
  };

  const cleanComment = (comment: string): string =>
    comment
      .replace(/^\/\*+|\*+\/$|^\/\/|^#/g, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
      .join(' ')
      .trim();

  const isPrintf = (value: string): boolean =>
    /%(\d+\$)?[-+ 0#]*\d*(\.\d+)?[bcdeEfFgGosuxX]/.test(value);

  type PhpToken = {
    type: 'string' | 'name' | 'punct' | 'comment' | 'variable';
    value: string;
    line: number;
    endLine: number;
    literal: boolean;
  };

  const phpEscapes: Record<string, string> = {
    n: '\n',
    t: '\t',
    r: '\r',
    v: '\v',
    e: '\x1b',
    f: '\f',
    '\\': '\\',
    $: '$',
    '"': '"',
  };

  const tokenizePhp = (text: string): PhpToken[] => {
    const tokens: PhpToken[] = [];
    let i = 0;
    let line = 1;
    let inPhp = false;

    const advance = (to: number): void => {
      for (let j = i; j < to; j++) {
        if (text[j] === '\n') line++;
      }
      i = to;
    };

    const push = (
      type: PhpToken['type'],
      value: string,
      to: number,
      literal = true,
    ): void => {
      const start = line;
      advance(to);
      tokens.push({ type, value, line: start, endLine: line, literal });
    };

    while (i < text.length) {
      if (!inPhp) {
        const open = text.indexOf('<?', i);
        if (open === -1) break;
        let length = 2;
        if (text.startsWith('<?php', open)) length = 5;
        else if (text.startsWith('<?=', open)) length = 3;
        advance(open + length);
        inPhp = true;
        continue;
      }

      const char = text[i];

      if (text.startsWith('?>', i)) {
        advance(i + 2);
        inPhp = false;
        continue;
      }

      if (/\s/.test(char)) {
        advance(i + 1);
        continue;
      }

      if (text.startsWith('//', i) || (char === '#' && text[i + 1] !== '[')) {
        let end = i;
        while (
          end < text.length &&
          text[end] !== '\n' &&
          !text.startsWith('?>', end)
        ) {
          end++;
        }
        push('comment', text.slice(i, end), end);
        continue;
      }

      if (text.startsWith('/*', i)) {
        const close = text.indexOf('*/', i + 2);
        const end = close === -1 ? text.length : close + 2;
        push('comment', text.slice(i, end), end);
        continue;
      }

      if (char === "'") {
        let j = i + 1;
        let value = '';
        while (j < text.length && text[j] !== "'") {
          if (
            text[j] === '\\' &&
            (text[j + 1] === "'" || text[j + 1] === '\\')
          ) {
            value += text[j + 1];
            j += 2;
          } else {
            value += text[j];
            j++;
          }
        }
        push('string', value, j + 1);
        continue;
      }

      if (char === '"') {
        let j = i + 1;
        let value = '';
        let literal = true;
        while (j < text.length && text[j] !== '"') {
          const current = text[j];
          const next = text[j + 1] ?? '';
          if (current === '\\') {
            if (next in phpEscapes) {
              value += phpEscapes[next];
            } else {
              if (/[0-7xu]/.test(next)) literal = false;
              value += current + next;
            }
            j += 2;
            continue;
          }
          if (
            (current === '$' && /[A-Za-z_{]/.test(next)) ||
            (current === '{' && next === '$')
          ) {
            literal = false;
          }
          value += current;
          j++;
        }
        push('string', value, j + 1, literal);
        continue;
      }

      if (text.startsWith('<<<', i)) {
        const opening = /^<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/.exec(
          text.slice(i),
        );
        if (opening) {
          const closing = new RegExp(
            `\\n[ \\t]*${opening[2]}(?![A-Za-z0-9_])`,
            'g',
          );
          closing.lastIndex = i + opening[0].length - 1;
          const match = closing.exec(text);
          const end = match ? match.index + match[0].length : text.length;
          push('string', text.slice(i, end), end, false);
          continue;
        }
      }

      if (char === '$') {
        const match = /^\$[A-Za-z_\x80-\uffff][A-Za-z0-9_\x80-\uffff]*/.exec(
          text.slice(i),
        );
        const end = i + (match ? match[0].length : 1);
        push('variable', text.slice(i, end), end);
        continue;
      }

      if (/[A-Za-z_\\\x80-\uffff]/.test(char)) {
        const match = /^[A-Za-z0-9_\\\x80-\uffff]+/.exec(text.slice(i));
        const end = i + (match ? match[0].length : 1);
        push('name', text.slice(i, end), end);
        continue;
      }

      const operator = ['?->', '->', '::'].find((op) => text.startsWith(op, i));
      push('punct', operator ?? char, i + (operator ?? char).length);
    }

    return tokens;
  };

  // Argument positions follow the WordPress function signatures.
  const phpFunctions: Record<
    string,
    { id: number; context?: number; plural?: number; domain: number }
  > = {
    __: { id: 0, domain: 1 },
    _e: { id: 0, domain: 1 },
    esc_html__: { id: 0, domain: 1 },
    esc_html_e: { id: 0, domain: 1 },
    esc_attr__: { id: 0, domain: 1 },
    esc_attr_e: { id: 0, domain: 1 },
    _x: { id: 0, context: 1, domain: 2 },
    _ex: { id: 0, context: 1, domain: 2 },
    esc_html_x: { id: 0, context: 1, domain: 2 },
    esc_attr_x: { id: 0, context: 1, domain: 2 },
    _n: { id: 0, plural: 1, domain: 3 },
    _nx: { id: 0, plural: 1, context: 3, domain: 4 },
    _n_noop: { id: 0, plural: 1, domain: 2 },
    _nx_noop: { id: 0, plural: 1, context: 2, domain: 3 },
  };

  const phpArguments = (
    tokens: PhpToken[],
    open: number,
  ): (string | null)[] | null => {
    const args: PhpToken[][] = [[]];
    let depth = 0;
    for (let i = open + 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'comment') continue;
      if (token.type === 'punct') {
        if ('([{'.includes(token.value)) depth++;
        if (')]}'.includes(token.value)) {
          if (depth === 0) {
            return args.map((arg) => {
              const parts = arg.filter((_, index) => index % 2 === 0);
              const joins = arg.filter((_, index) => index % 2 === 1);
              const literal =
                parts.length > 0 &&
                parts.every((part) => part.type === 'string' && part.literal) &&
                joins.every((join) => join.value === '.');
              return literal ? parts.map((part) => part.value).join('') : null;
            });
          }
          depth--;
        }
        if (token.value === ',' && depth === 0) {
          args.push([]);
          continue;
        }
      }
      args[args.length - 1].push(token);
    }
    return null;
  };

  const extractPhp = (file: string): void => {
    const reference = relative(root, file);
    const tokens = tokenizePhp(readFileSync(file, 'utf8'));
    let note: PhpToken | null = null;

    tokens.forEach((token, index) => {
      if (token.type === 'comment') {
        if (cleanComment(token.value).startsWith('translators:')) note = token;
        return;
      }

      const name = token.value.replace(/^\\/, '');
      const signature = phpFunctions[name];
      if (token.type !== 'name' || !signature) return;

      const previous = tokens
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.type !== 'comment');
      const next = tokens
        .slice(index + 1)
        .find((candidate) => candidate.type !== 'comment');
      if (
        next?.value !== '(' ||
        ['->', '?->', '::'].includes(previous?.value ?? '') ||
        ['function', 'new', 'const'].includes(previous?.value ?? '')
      ) {
        return;
      }

      const args = phpArguments(tokens, tokens.indexOf(next));
      if (!args || args[signature.domain] !== domain) return;

      const id = args[signature.id];
      const context =
        signature.context === undefined ? '' : args[signature.context];
      const plural =
        signature.plural === undefined ? '' : args[signature.plural];
      if (id === null || context === null || plural === null) {
        problems.push(
          `${reference}:${token.line} passes a value built at runtime to ${name}(). Use a literal string.`,
        );
        return;
      }

      const comments: string[] = [];
      const comment = note as PhpToken | null;
      if (comment && token.line - comment.endLine <= 2) {
        comments.push(cleanComment(comment.value));
      }
      note = null;

      addMessage(
        context ?? '',
        id ?? '',
        plural ?? '',
        reference,
        comments,
        isPrintf(id ?? '') || isPrintf(plural ?? ''),
      );
    });
  };

  const resolveImport = (from: string, specifier: string): string | null => {
    let base: string;
    if (specifier.startsWith('@/')) {
      base = resolve(root, 'src', specifier.slice(2));
    } else if (specifier.startsWith('.')) {
      base = resolve(dirname(from), specifier);
    } else {
      return null;
    }
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      resolve(base, 'index.ts'),
      resolve(base, 'index.tsx'),
    ]) {
      if (
        /\.tsx?$/.test(candidate) &&
        existsSync(candidate) &&
        statSync(candidate).isFile()
      ) {
        return candidate;
      }
    }
    return null;
  };

  const reachableFrom = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [resolve(root, entry)];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const { importedFiles } = ts.preProcessFile(
        readFileSync(file, 'utf8'),
        true,
        true,
      );
      for (const { fileName } of importedFiles) {
        const target = resolveImport(file, fileName);
        if (target) queue.push(target);
      }
    }
    return seen;
  };

  const i18nFunctions: Record<
    string,
    { id: number; context?: number; plural?: number; domain: number }
  > = {
    __: { id: 0, domain: 1 },
    _x: { id: 0, context: 1, domain: 2 },
    _n: { id: 0, plural: 1, domain: 3 },
    _nx: { id: 0, plural: 1, context: 3, domain: 4 },
  };

  const usesGettext = (text: string): boolean =>
    text.includes('@wordpress/i18n') || /utils\/__['"]/.test(text);

  const extractScript = (file: string): void => {
    const reference = relative(root, file);
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const wrapperNames = new Set<string>();
    const i18nNames = new Map<string, string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const specifier = statement.moduleSpecifier.text;
      const fromWrapper = resolveImport(file, specifier) === wrapper;
      for (const element of bindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        if (fromWrapper && imported === '__') {
          wrapperNames.add(element.name.text);
        }
        if (specifier === '@wordpress/i18n' && imported in i18nFunctions) {
          i18nNames.set(element.name.text, imported);
        }
      }
    }

    const literal = (node?: ts.Expression): string | null =>
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        ? node.text
        : null;

    const translatorComments = (node: ts.Node): string[] => {
      for (
        let current: ts.Node | undefined = node;
        current && !ts.isSourceFile(current);
        current = current.parent
      ) {
        const found = (
          ts.getLeadingCommentRanges(text, current.getFullStart()) ?? []
        )
          .map((range) => cleanComment(text.slice(range.pos, range.end)))
          .filter((comment) => comment.startsWith('translators:'));
        if (found.length > 0) return found;
        if (ts.isStatement(current)) break;
      }
      return [];
    };

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const args = node.arguments;
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const where = `${reference}:${line}`;

        // With true as the second argument, the wrapper translates in the
        // default text domain, so the string is not ours to extract.
        if (
          wrapperNames.has(name) &&
          args[1]?.kind !== ts.SyntaxKind.TrueKeyword
        ) {
          const first = args[0];
          if (
            first &&
            (ts.isTemplateExpression(first) || ts.isBinaryExpression(first))
          ) {
            problems.push(
              `${where} builds the string passed to ${name}() at runtime, so it cannot be translated. Use one literal string per variant.`,
            );
          } else {
            const id = literal(first);
            if (id !== null) {
              addMessage('', id, '', reference, translatorComments(node));
            }
          }
        }

        const imported = i18nNames.get(name);
        if (imported) {
          const signature = i18nFunctions[imported];
          if (literal(args[signature.domain]) === domain) {
            const id = literal(args[signature.id]);
            const context =
              signature.context === undefined
                ? ''
                : literal(args[signature.context]);
            const plural =
              signature.plural === undefined
                ? ''
                : literal(args[signature.plural]);
            if (id === null || context === null || plural === null) {
              problems.push(
                `${where} passes a value built at runtime to ${name}(). Use a literal string.`,
              );
            } else {
              addMessage(
                context,
                id,
                plural,
                reference,
                translatorComments(node),
              );
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(source);
  };

  const quote = (value: string): string => {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
    if (!escaped.slice(0, -1).includes('\n')) {
      return `"${escaped.replace(/\n/g, '\\n')}"`;
    }
    const lines = escaped.split('\n');
    const parts = lines
      .map((part, index) => (index < lines.length - 1 ? `${part}\\n` : part))
      .filter((part) => part !== '');
    return ['""', ...parts.map((part) => `"${part}"`)].join('\n');
  };

  const unquote = (value: string): string =>
    value
      .slice(1, -1)
      .replace(
        /\\(.)/g,
        (_, char: string) =>
          ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' })[char] ?? char,
      );

  const parsePo = (text: string, file: string): Po => {
    const entries: PoEntry[] = [];
    const fresh = (): PoEntry & { started: boolean } => ({
      context: '',
      id: '',
      plural: '',
      strings: [],
      flags: [],
      notes: [],
      started: false,
    });
    let current = fresh();
    let field: { name: string; index: number } | null = null;

    const flush = (): void => {
      if (current.started) {
        const { started: _started, ...entry } = current;
        entries.push(entry);
      }
      current = fresh();
      field = null;
    };

    const assign = (name: string, index: number, value: string): void => {
      if (name === 'msgctxt') current.context = value;
      if (name === 'msgid') current.id = value;
      if (name === 'msgid_plural') current.plural = value;
      if (name === 'msgstr') current.strings[index] = value;
    };

    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#~')) {
        if (line === '') flush();
        return;
      }
      if (line.startsWith('#')) {
        if (current.started && current.strings.length > 0) flush();
        if (line.startsWith('#,')) {
          current.flags.push(
            ...line
              .slice(2)
              .split(',')
              .map((flag) => flag.trim())
              .filter(Boolean),
          );
        } else if (!/^#[.:|]/.test(line)) {
          current.notes.push(raw);
        }
        return;
      }
      if (line.startsWith('"')) {
        if (!field) {
          problems.push(`${file}:${index + 1} has text outside of a field.`);
          return;
        }
        const { name, index: slot } = field;
        const previous =
          name === 'msgctxt'
            ? current.context
            : name === 'msgid'
              ? current.id
              : name === 'msgid_plural'
                ? current.plural
                : (current.strings[slot] ?? '');
        assign(name, slot, previous + unquote(line));
        return;
      }
      const match =
        /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+(".*")$/.exec(
          line,
        );
      if (!match) {
        problems.push(`${file}:${index + 1} cannot be read: ${line}`);
        return;
      }
      const [, name, slot, value] = match;
      if (
        (name === 'msgctxt' || name === 'msgid') &&
        current.strings.length > 0
      ) {
        flush();
      }
      if (name === 'msgctxt' && current.id !== '') flush();
      current.started = true;
      field = { name, index: Number(slot ?? 0) };
      assign(name, field.index, unquote(value));
    });
    flush();

    const header = entries.find((entry) => entry.id === '' && !entry.context);
    const headers: [string, string][] = (header?.strings[0] ?? '')
      .split('\n')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      });

    return {
      headers,
      entries: entries.filter((entry) => entry !== header),
    };
  };

  const headerValue = (headers: [string, string][], name: string): string =>
    headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ??
    '';

  const pluralCount = (headers: [string, string][]): number =>
    Number(
      /nplurals\s*=\s*(\d+)/.exec(headerValue(headers, 'Plural-Forms'))?.[1] ??
        2,
    );

  const writeEntry = (
    message: Message,
    translation: PoEntry | null,
    plurals: number,
  ): string => {
    if (translation && translation.plural !== message.plural) {
      translation = {
        ...translation,
        flags: [...new Set([...translation.flags, 'fuzzy'])],
      };
    }
    const lines: string[] = [];
    if (translation) lines.push(...translation.notes);
    for (const comment of message.comments) lines.push(`#. ${comment}`);
    for (const reference of [...message.references].sort()) {
      lines.push(`#: ${reference}`);
    }
    const flags = [
      ...(translation?.flags.filter((flag) => flag !== 'php-format') ?? []),
      ...(message.phpFormat ? ['php-format'] : []),
    ];
    if (flags.length > 0) lines.push(`#, ${flags.join(', ')}`);
    if (message.context) lines.push(`msgctxt ${quote(message.context)}`);
    lines.push(`msgid ${quote(message.id)}`);
    if (message.plural) {
      lines.push(`msgid_plural ${quote(message.plural)}`);
      for (let i = 0; i < plurals; i++) {
        lines.push(`msgstr[${i}] ${quote(translation?.strings[i] ?? '')}`);
      }
    } else {
      lines.push(`msgstr ${quote(translation?.strings[0] ?? '')}`);
    }
    return lines.join('\n');
  };

  const writePo = (
    headers: [string, string][],
    ordered: Message[],
    translations: Map<string, PoEntry> | null,
    notes: string[] = [],
  ): string => {
    const header = [
      ...notes,
      'msgid ""',
      'msgstr ""',
      ...headers.map(([key, value]) => quote(`${key}: ${value}\n`)),
    ].join('\n');
    const entries = ordered.map((message) =>
      writeEntry(
        message,
        translations?.get(keyOf(message.context, message.id)) ?? null,
        pluralCount(headers),
      ),
    );
    return `${[header, ...entries].join('\n\n')}\n`;
  };

  const translated = (
    entry: PoEntry,
    message: Message,
    plurals: number,
  ): boolean =>
    !entry.flags.includes('fuzzy') &&
    entry.plural === message.plural &&
    (message.plural
      ? entry.strings.length === plurals &&
        entry.strings.every((value) => value !== '')
      : (entry.strings[0] ?? '') !== '');

  const writeMo = (pairs: [string, string][]): Buffer => {
    const sorted = pairs
      .map(([key, value]) => [Buffer.from(key), Buffer.from(value)])
      .sort((a, b) => Buffer.compare(a[0], b[0]));
    const count = sorted.length;
    const tables = 28 + count * 16;
    const size = sorted.reduce(
      (total, [key, value]) => total + key.length + value.length + 2,
      tables,
    );
    const buffer = Buffer.alloc(size);
    buffer.writeUInt32LE(0x950412de, 0);
    buffer.writeUInt32LE(0, 4);
    buffer.writeUInt32LE(count, 8);
    buffer.writeUInt32LE(28, 12);
    buffer.writeUInt32LE(28 + count * 8, 16);
    buffer.writeUInt32LE(0, 20);
    buffer.writeUInt32LE(tables, 24);
    let offset = tables;
    sorted.forEach(([key], index) => {
      buffer.writeUInt32LE(key.length, 28 + index * 8);
      buffer.writeUInt32LE(offset, 32 + index * 8);
      key.copy(buffer, offset);
      offset += key.length + 1;
    });
    sorted.forEach(([, value], index) => {
      buffer.writeUInt32LE(value.length, 28 + count * 8 + index * 8);
      buffer.writeUInt32LE(offset, 32 + count * 8 + index * 8);
      value.copy(buffer, offset);
      offset += value.length + 1;
    });
    return buffer;
  };

  // Same output as var_export(), which is what WordPress writes for .l10n.php files.
  const phpString = (value: string): string =>
    value
      .split('\0')
      .map((part) => `'${part.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
      .join(' . "\\0" . ');

  const writePhp = (
    headers: [string, string][],
    pairs: [string, string][],
  ): string => {
    const meta: [string, string][] = [
      ['domain', domain],
      ['plural-forms', headerValue(headers, 'Plural-Forms')],
      ['language', headerValue(headers, 'Language')],
      ['project-id-version', headerValue(headers, 'Project-Id-Version')],
      ['po-revision-date', headerValue(headers, 'PO-Revision-Date')],
    ];
    const entries = [
      ...meta.map(([key, value]) => `${phpString(key)}=>${phpString(value)}`),
      `'messages'=>[${pairs
        .map(([key, value]) => `${phpString(key)}=>${phpString(value)}`)
        .join(',')}]`,
    ];
    return `<?php\nreturn [${entries.join(',')}];\n`;
  };

  const writeJson = (
    headers: [string, string][],
    pairs: [string, string[]][],
  ): string =>
    `${JSON.stringify({
      'translation-revision-date': headerValue(headers, 'PO-Revision-Date'),
      generator: 'Blockstudio i18n',
      domain: 'messages',
      locale_data: {
        messages: {
          '': {
            domain: 'messages',
            lang: headerValue(headers, 'Language'),
            'plural-forms': headerValue(headers, 'Plural-Forms'),
          },
          ...Object.fromEntries(pairs),
        },
      },
    })}\n`;

  for (const source of phpSources) {
    for (const file of filesUnder(resolve(root, source), /\.php$/)) {
      extractPhp(file);
    }
  }

  const reachable = new Map(
    scripts.map(({ handle, entry }) => [handle, reachableFrom(entry)]),
  );
  const scriptFiles = [
    ...new Set([...reachable.values()].flatMap((files) => [...files])),
  ].sort();

  for (const file of scriptFiles) {
    if (file !== wrapper) extractScript(file);
  }

  for (const file of filesUnder(resolve(root, 'src'), /\.tsx?$/)) {
    if (
      file !== wrapper &&
      !scriptFiles.includes(file) &&
      usesGettext(readFileSync(file, 'utf8'))
    ) {
      problems.push(
        `${relative(root, file)} translates strings but is not part of a script listed in scripts/i18n.ts.`,
      );
    }
  }

  const ordered = [...messages.values()];
  const outputs = new Map<string, string | Buffer>();
  const potKeys = ordered
    .map(
      (message) => `${keyOf(message.context, message.id)}\0${message.plural}`,
    )
    .sort()
    .join('\n');
  const poOutdated = new Set<string>();
  outputs.set(potFile, writePo(potHeaders, ordered, null));

  const poFiles = existsSync(languages)
    ? readdirSync(languages)
        .filter((name) => new RegExp(`^${domain}-.+\\.po$`).test(name))
        .sort()
    : [];

  for (const name of poFiles) {
    const file = resolve(languages, name);
    const locale = name.slice(domain.length + 1, -3);
    const po = parsePo(readFileSync(file, 'utf8'), relative(root, file));
    const byKey = new Map(
      po.entries.map((entry) => [keyOf(entry.context, entry.id), entry]),
    );

    if (headerValue(po.headers, 'Language') !== locale) {
      problems.push(
        `${relative(root, file)}: the Language header must be "${locale}".`,
      );
    }
    if (
      ordered.some((message) => message.plural) &&
      !headerValue(po.headers, 'Plural-Forms')
    ) {
      problems.push(
        `${relative(root, file)}: the Plural-Forms header is missing.`,
      );
    }

    const poKeys = po.entries
      .map((entry) => `${keyOf(entry.context, entry.id)}\0${entry.plural}`)
      .sort()
      .join('\n');
    if (poKeys !== potKeys) poOutdated.add(file);

    const headerNotes = readFileSync(file, 'utf8')
      .split(/\r?\n\r?\n/)[0]
      .split(/\r?\n/)
      .filter((line) => line.startsWith('# '));
    outputs.set(file, writePo(po.headers, ordered, byKey, headerNotes));

    const pairs: [Message, PoEntry][] = [];
    for (const message of ordered) {
      const entry = byKey.get(keyOf(message.context, message.id));
      if (!entry || !translated(entry, message, pluralCount(po.headers))) {
        continue;
      }
      if (isPrintf(message.id) || isPrintf(message.plural)) {
        const placeholders = (value: string): string =>
          (value.match(/%(\d+\$)?[-+ 0#]*\d*(\.\d+)?[bcdeEfFgGosuxX]/g) ?? [])
            .sort()
            .join(' ');
        for (const [index, value] of entry.strings.entries()) {
          const source =
            index === 0 || !message.plural ? message.id : message.plural;
          if (placeholders(value) !== placeholders(source)) {
            problems.push(
              `${relative(root, file)}: the translation of "${source}" must keep its placeholders (form ${index}).`,
            );
          }
        }
      }
      pairs.push([message, entry]);
    }

    const headerText = po.headers
      .map(([key, value]) => `${key}: ${value}\n`)
      .join('');
    const flat: [string, string][] = pairs.map(([message, entry]) => [
      keyOf(
        message.context,
        message.plural ? `${message.id}\0${message.plural}` : message.id,
      ),
      entry.strings.join('\0'),
    ]);
    const base = resolve(languages, `${domain}-${locale}`);
    outputs.set(`${base}.mo`, writeMo([['', headerText], ...flat]));
    outputs.set(
      `${base}.l10n.php`,
      writePhp(
        po.headers,
        pairs.map(([message, entry]) => [
          keyOf(message.context, message.id),
          entry.strings.join('\0'),
        ]),
      ),
    );

    for (const { handle } of scripts) {
      const files = reachable.get(handle) as Set<string>;
      const used = pairs.filter(([message]) =>
        message.references.some((reference) =>
          files.has(resolve(root, reference)),
        ),
      );
      if (used.length === 0) continue;
      outputs.set(
        `${base}-${handle}.json`,
        writeJson(
          po.headers,
          used.map(([message, entry]) => [
            keyOf(message.context, message.id),
            entry.strings,
          ]),
        ),
      );
    }
  }

  const generated = new RegExp(`^${domain}-.+\\.(mo|l10n\\.php|json)$`);
  const stale = existsSync(languages)
    ? readdirSync(languages)
        .filter((name) => generated.test(name))
        .map((name) => resolve(languages, name))
        .filter((file) => !outputs.has(file))
    : [];

  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    throw new Error('Validation failed.');
  }

  const outdated = [...outputs].filter(([file, content]) => {
    if (!existsSync(file)) return true;
    const current = readFileSync(file);
    return !current.equals(
      Buffer.isBuffer(content) ? content : Buffer.from(content),
    );
  });

  if (check) {
    // A PO file saved by an editor may be formatted differently. It only has
    // to contain the same strings as the template.
    const failing = [
      ...outdated
        .map(([file]) => file)
        .filter((file) => !file.endsWith('.po') || poOutdated.has(file)),
      ...stale,
    ];
    if (failing.length > 0) {
      console.error(
        `Translations are out of date. Run npm run i18n and commit:\n${failing
          .map((file) => `- ${relative(root, file)}`)
          .join('\n')}`,
      );
      throw new Error('Validation failed.');
    }
    console.log(
      `Translations are up to date: ${ordered.length} strings, ${poFiles.length} languages.`,
    );
  } else {
    for (const [file, content] of outdated) writeFileSync(file, content);
    for (const file of stale) rmSync(file);
    console.log(
      `${ordered.length} strings, ${poFiles.length} languages, ${outdated.length + stale.length} files updated.`,
    );
  }
});

if (import.meta.main) runMain(i18n);
