# Catalog recovery release — 2026-10-18

## Approved artifact

- Project: `piel-canela-web` / `prj_8pLruNzIDBCJNDaKjBVAAvfXqRmC`.
- Verified deployment: `dpl_3cfMA5Lr2ooEn6a5tZpdaPpE4n57`.
- Artifact URL: https://piel-canela-h2zsa9vfg-kai-dev1.vercel.app
- Release strategy: promote this existing verified deployment, without rebuilding it or executing database migrations.
- Previous production deployment, available for application rollback: `dpl_EEzzNGbvRiaoRXoz8WGr8DRgGGhb`.
- Public domains: https://piel-canela-catalogo.vercel.app and https://piel-canela-web-mauve.vercel.app.

## Changes

- Protected, transactional independent removal of specials and treatment removal with explicit delete, reassign or archive choices.
- Concurrent-edit checks and actionable errors; historical bookings require preservation.
- Successful treatment deletion redirects to the catalog instead of rendering the removed editor as a 404.
- Direct entry to existing depilation zones, combos and extras, with clear pricing and publication explanations.
- Public catalog excludes active simple treatments without a valid price; configurable treatment prices are resolved from valid published combos.

## Verification

- 63 test files / 196 tests passed.
- TypeScript, changed-file lint, remote Next.js build and whitespace checks passed.
- Browser smoke: agency login, image-optional draft creation, price edit, independent special removal, special reassignment, archive, combined removal, depilation visibility and combo transfer to the calendar.
- Next-available-date query succeeded without creating a reservation.
- The post-removal redirect fix is covered by five server-action regression tests and a read-only destination-page check; no further destructive E2E run was claimed.
- Temporary QA treatments and specials were removed after explicit confirmation. Their audit events remain.
- Full-row fingerprints of the six checked business tables matched before and after QA cleanup: treatments 19, monthly specials 1, professionals 6, zones 11, combos 4 and extras 11. No Storage object was created or removed.

## Database boundary

Migration `20261017000100_safe_specials_and_treatment_removal.sql` was separately approved, applied and verified before this release. It is versioned in this commit but MUST NOT be executed again as part of application deployment. This release does not run resets, seeds, imports, content edits, cleanup scripts or other business-data mutations.

Application rollback consists of promoting the previous deployment above. Do not revert business records or delete migration history during an application rollback. Sensitive environment values remain managed by Vercel; none are included in this release record.
