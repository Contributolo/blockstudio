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

| Language | Locale |
| --- | --- |
| German | `de_DE` |
| German (formal) | `de_DE_formal` |

The translations cover the field controls in the block editor, the admin page, and the messages of the REST endpoints. Labels and help texts in your own `block.json` files belong to your theme or plugin and use its text domain.

## Override a translation

Translation files in `wp-content/languages/plugins` take precedence over the bundled ones, for the PHP strings (`blockstudio-de_DE.mo` or `blockstudio-de_DE.l10n.php`) as well as for the scripts (`blockstudio-de_DE-blockstudio-blocks.json` and `blockstudio-de_DE-blockstudio-admin-page.json`).

## Contribute a translation

Every language is a `.po` file that you can edit with any text editor or with a translation tool such as Poedit. Corrections and new languages are welcome as pull requests.

1. To add a language, copy `languages/blockstudio.pot` to `languages/blockstudio-<locale>.po`, for example `blockstudio-fr_FR.po`, and set the `Language` and `Plural-Forms` headers. To improve a language, edit its existing `.po` file.
2. Translate the strings. Keep placeholders such as `%1$s` in the translation.
3. Run `npm run i18n`. It writes the `.mo`, `.l10n.php`, and `.json` files that WordPress loads.
4. Commit the `.po` file together with the generated files and open a pull request.

If you cannot run `npm`, a pull request with the `.po` file alone is fine. The generated files can be added before the merge.

## Translatable strings in the code

- PHP: use the WordPress functions with the `blockstudio` text domain, for example `__( 'Invalid block.', 'blockstudio' )`.
- JavaScript: import `__` from `@/utils/__` and pass a literal string, for example `__( 'Add row' )`. A string that is assembled at runtime cannot be translated, so use one literal string per variant.
- A new script bundle with translatable strings needs an entry in `scripts/i18n.ts` and a call to `wp_set_script_translations()` with the same handle and `Translations::script_path()`.

After changing strings, run `npm run i18n`. It updates `languages/blockstudio.pot` and every `.po` file. New strings stay in English until a translator fills them in. `npm run check` runs `npm run i18n:check`, which fails when the translation files are out of date or a string cannot be extracted.
