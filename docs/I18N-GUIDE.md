# Warehouse IT Bilingual i18n Guide

Warehouse IT Inventory supports English and Spanish through local static dictionaries.

## Supported Locales

- `en`
- `es`

The selected language is stored in the `warehouse_locale` cookie.

## Language API

`POST /api/language`

Payload:

```json
{ "locale": "es" }
```

Only `en` and `es` are accepted. Unsupported values return `422`.

## Shared Helpers

Core file:

- `lib/i18n.ts`

Server cookie helper:

- `lib/i18n-server.ts`

Use this pattern in server pages:

```ts
const locale = await getLocaleFromCookies();
const text = createTranslator(locale, "scan");
```

Then render:

```tsx
<PageHeader title={text("title")} description={text("description")} />
```

## Namespaces

Current namespaces include:

- `common`
- `nav`
- `scan`
- `intake`
- `inventory`
- `manual`
- `admin`

Add page namespaces gradually as pages are translated.

## Client Components

Prefer passing translated strings from the server page into client components.

Do not make every client component read cookies directly.

If a shared client component needs labels, pass:

- `locale`
- a small `text` object
- already translated labels

## What To Translate

Translate UI chrome:

- page titles
- descriptions
- buttons
- placeholders
- helper text
- empty states
- warnings
- table headers
- display labels

## What Not To Translate

Never translate:

- asset tags
- serial numbers
- SKU/barcodes
- IP or MAC addresses
- employee names
- emails
- notes
- imported workbook data
- activity/audit payloads
- environment variable names
- secrets
- BitLocker recovery keys

Database enum values should remain stable machine values. Translate only display labels.

## Fallback Behavior

English is always the fallback.

Missing Spanish keys fall back to English.

Unsupported locale inputs normalize to English in display helpers and are rejected by `/api/language`.

## Transitional Translation Boundary

`components/translation-boundary.tsx` is a temporary bridge. It translates exact common UI labels on pages that are not fully migrated yet.

For new work, use page-level dictionaries instead.

## Testing

When adding translations:

- add or update dictionary tests
- run `npm test`
- run `npm run lint`
- run `npm run build`
- smoke English and Spanish modes in the browser

Do not add remote translation APIs or runtime machine translation.
