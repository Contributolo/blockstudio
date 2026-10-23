---
title: Translations
description: Use Blockstudio in your language and help translate it.
path: 'general/translations'
order: 3
section: "Start"
subsection: 'Setup'
meta_title: 'Translations'
meta_description: 'Use Blockstudio in your language and help translate it.'
---

# Translations

Blockstudio ships its translations in the `languages` folder. WordPress uses them whenever the site language, or the language in a user profile, matches one of them. This works the same way when Blockstudio runs as a plugin, a must-use plugin, or a Composer package.

## Available languages

Blockstudio includes translations for the WordPress locales recorded in its bundled `languages/locales.json`, including regional and formal/informal variants. English (`en_US`) is the source language and does not need a translation file. The list combines WordPress-supported locales from GlotPress with variants available from the WordPress core translation API.

The existing German (`de_DE`) and formal German (`de_DE_formal`) translations are preserved. The additional translations are AI-generated using GPT-6 Luna and marked as machine-generated in their `.po` headers. They pass automated completeness and format checks, but have not all been reviewed by native speakers. Corrections are welcome.

The translations cover the field controls in the block editor, the admin page, the canvas, the devtools overlay, and the messages of the REST endpoints. Labels and help texts in your own `block.json` files belong to your theme or plugin and use its text domain.

Select the language in **Settings > General > Site Language**, or choose a personal language in your WordPress profile. Blockstudio uses that locale automatically. It does not add languages to the WordPress language selector: a locale must also be available in your WordPress installation. There is no AI request, translation subscription, or extra runtime setting required on your site.

## Override a translation

Translation files in `wp-content/languages/plugins` take precedence over the bundled ones, for the PHP strings (`blockstudio-de_DE.mo` or `blockstudio-de_DE.l10n.php`) as well as for the scripts (one file per script handle, for example `blockstudio-de_DE-blockstudio-blocks.json`).

## Contribute a translation

Every language is a `.po` file that you can edit with any text editor or with a translation tool such as Poedit. Corrections and new languages are welcome as pull requests.

1. To add a language, copy `languages/blockstudio.pot` to `languages/blockstudio-<locale>.po`, for example `blockstudio-fr_FR.po`, and set the `Language` and `Plural-Forms` headers. To improve a language, edit its existing `.po` file.
2. Translate the strings. Keep placeholders such as `%1$s` in the translation.
3. Run `npm run i18n`. It writes the `.mo`, `.l10n.php`, and `.json` files that WordPress loads.
4. Commit the `.po` file together with the generated files and open a pull request.

If you cannot run `npm`, a pull request with the `.po` file alone is fine. The generated files can be added before the merge.

## Generate missing translations

Maintainers can generate missing entries with an authenticated Codex CLI. This is an optional development command, not something WordPress runs:

```bash
npm run i18n:translate -- --dry-run
npm run i18n:translate
```

The default model is `gpt-6-luna`. To work on one locale, use `npm run i18n:translate -- --locale fr_FR`. The command extracts the latest source strings, fills missing translations, then compiles `.mo`, `.l10n.php`, and per-script `.json` files. Only public interface strings, their context, and existing forms are sent to Codex, not site content or user data.

Existing nonempty translations are never replaced. Completed batches are saved, so rerunning after an interruption resumes the missing work. Placeholders such as `%1$s`, HTML markup, technical identifiers, and the required plural forms are validated before saving. Fuzzy entries and changed source plurals are left for a translator to review. No model fallback is used if the requested model is unavailable.

`npm run i18n:locales` explicitly refreshes the locale list and plural rules from WordPress/GlotPress. `npm run i18n:coverage` checks that every locale in the checked-in list is complete. Neither coverage checks nor normal CI call AI or fetch locale data. See the repository README for batching, concurrency, and recovery options.

## Translatable strings in the code

- PHP: use the WordPress functions with the `blockstudio` text domain, for example `__( 'Invalid block.', 'blockstudio' )`.
- JavaScript: import `__` from `@/utils/__` and pass a literal string, for example `__( 'Add row' )`. A string that is assembled at runtime cannot be translated, so use one literal string per variant.
- A new script bundle with translatable strings needs an entry in `scripts/i18n.ts` and a call to `wp_set_script_translations()` with the same handle and `Translations::script_path()`.

After changing strings, run `npm run i18n`. It updates `languages/blockstudio.pot` and every `.po` file. New strings stay in English until a translator or `npm run i18n:translate` fills them in. CI runs `npm run i18n:check` and `npm run i18n:coverage`, which reject stale compiled files, extraction problems, or incomplete locale coverage. Generation remains an explicit maintainer action.
