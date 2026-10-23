export type Message = {
  context: string;
  id: string;
  plural: string;
  comments: string[];
  references: string[];
  phpFormat: boolean;
};

export type PoEntry = {
  context: string;
  id: string;
  plural: string;
  strings: string[];
  flags: string[];
  notes: string[];
  comments: string[];
  references: string[];
};

export type Po = {
  headers: [string, string][];
  entries: PoEntry[];
};

export const keyOf = (context: string, id: string): string =>
  context ? `${context}\u0004${id}` : id;

export const quote = (value: string): string => {
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

export const unquote = (value: string): string =>
  value
    .slice(1, -1)
    .replace(
      /\\(.)/g,
      (_, char: string) =>
        ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' })[char] ?? char,
    );

export const parsePo = (
  text: string,
  file: string,
  problems: string[] = [],
): Po => {
  const entries: PoEntry[] = [];
  const fresh = (): PoEntry & { started: boolean } => ({
    context: '',
    id: '',
    plural: '',
    strings: [],
    flags: [],
    notes: [],
    comments: [],
    references: [],
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
      } else if (line.startsWith('#.')) {
        current.comments.push(line.slice(2).trim());
      } else if (line.startsWith('#:')) {
        current.references.push(line.slice(2).trim());
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
      /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+(".*")$/.exec(line);
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

export const headerValue = (
  headers: [string, string][],
  name: string,
): string =>
  headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? '';

export const pluralCount = (headers: [string, string][]): number =>
  Number(
    /nplurals\s*=\s*(\d+)/.exec(headerValue(headers, 'Plural-Forms'))?.[1] ?? 2,
  );

export const writeEntry = (
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

export const writePo = (
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

export const translated = (
  entry: PoEntry,
  message: Message,
  plurals: number,
): boolean =>
  !entry.flags.includes('fuzzy') &&
  entry.plural === message.plural &&
  (message.plural
    ? entry.strings.length === plurals &&
      Array.from(entry.strings).every(
        (value) => typeof value === 'string' && value !== '',
      )
    : (entry.strings[0] ?? '') !== '');
