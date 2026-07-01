# Bilingual App Workflow

Warehouse IT Inventory now has a safe bilingual foundation for English and Spanish.

## Current Foundation

- Locale values: `en` and `es`.
- Locale cookie: `warehouse_locale`.
- Language API: `POST /api/language`.
- Shared navigation text: `lib/i18n.ts`.
- Language switcher: app sidebar and mobile drawer.
- Transitional app-wide exact-label translation boundary: `components/translation-boundary.tsx`.
- Shared exact-label dictionary: `lib/ui-translations.ts`.
- User manual:
  - English: `/manual/user`
  - Spanish: `/manual/user?lang=es`
- Handoff docs:
  - `docs/USER-MANUAL.md`
  - `docs/MANUAL-DE-USUARIO.md`

## Recommended Workflow

Translate the app in layers. The exact-label translation boundary covers common UI text across the app, but high-risk operational pages should still get proper page dictionaries over time.

1. Shared shell
   - Navigation
   - Mobile drawer
   - Common action labels
   - Common empty states

2. Documentation and resources
   - User manual
   - SOPs
   - Workspace resources
   - Beta handoff notes

3. High-frequency operational pages
   - Dashboard
   - Quick Scan
   - Inventory
   - Assignments
   - Stock
   - Asset Loans
   - RMA

4. Admin and sensitive pages
   - Settings
   - Jobs
   - Backups
   - Email settings
   - BitLocker vault

5. API and validation messages
   - Keep server-side errors structured.
   - Translate user-facing messages at the UI boundary when possible.
   - Do not translate internal enum values or audit metadata.

## Rules

- Do not store language text directly in random components when a shared helper is practical.
- Keep English as fallback.
- Use exact-label translations for common UI chrome only. Do not use fuzzy translation for asset names, notes, serials, or imported data.
- Do not translate database enum values, identifiers, asset tags, serial numbers, role names, audit metadata, or activity payloads.
- Do not translate secrets, recovery keys, SMTP values, or config values.
- Keep Spanish plain and operational. Prefer short labels that fit phone screens.
- Test mobile widths after translating labels because Spanish strings are often longer.

## Safe Next Steps

- Use `createTranslator(locale, namespace)` from `lib/i18n.ts` for page dictionaries.
- Move repeated button labels into shared dictionaries.
- Translate pages one workflow at a time and run `npm test`, `npm run lint`, and `npm run build` after each pass.
- See `docs/I18N-GUIDE.md` for implementation details.
