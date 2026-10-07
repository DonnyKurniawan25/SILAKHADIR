# Final Canva PDF import contract

All routes below are under `/api/events/{event_id}/certificates/`, require an
admin/superadmin Bearer token, and never create participants or attendance.

## Preview

`POST import-preview/` multipart:

- `files`: repeated PDF uploads (`files[]` accepted for compatibility).
- `mode`: `combined` (default; exactly one file) or `separate`.
- `pages_per_participant`: positive integer, default 1, combined only.
- `page_groups`: optional JSON `[{"start":1,"end":2},{"start":3,"end":3}]`.
  Combined only, overrides uniform grouping. Ranges are 1-based, inclusive,
  disjoint and must cover every page. Uniform grouping rejects remainder pages.
- Limits: 100 files, 50 MiB total, 200 total pages.

Response 200: `{batch_id, items, participants}`. Item keys:
`id, filename, page_start, page_end, page_count, detected_name, participant_id,
participant_name, match_status, certificate_number, preview_url`.
Participants contain `id, full_name, nik, nip`, ONLY event attendance `hadir`.

`match_status`: `matched`, `ambiguous`, `unmatched`, `needs_review`, `duplicate`.
Automatic matching requires a unique exact normalized full name in the explicit
recipient position (`Diberikan kepada`, `Kepada`, `Presented to`, etc.). Matching
scans every registered event name to reject overlaps and signatory collisions.
No fuzzy matching, filename matching, identity-number fallback or OCR. Unanchored
names, scanned PDFs and repeated names require manual correction. Multiple files
matched to one participant clear all those proposed assignments.

`preview_url` is an authenticated GET route, NOT a public media URL. Frontend
must fetch with the Bearer token and display a blob URL; a bare iframe URL cannot
supply the token. Response uses `private, no-store`. Only the batch owner can view.

Preview files use private filesystem storage outside `MEDIA_ROOT`: configurable
Django setting `CERTIFICATE_IMPORT_ROOT`, default sibling directory
`private_certificate_imports`. Provision durable private storage/volume when
operationalizing this workflow; do not expose it in nginx. Batches expire after
24 hours. Expired batches/files for an owner are purged lazily on their next
successful preview. Applied batch records remain for replay prevention; their
private files are deleted after successful commit.

## Apply

`POST import-apply/` JSON:

```json
{
  "batch_id": "uuid",
  "assignments": [
    {"item_id": "uuid", "participant_id": "uuid", "certificate_number": ""}
  ],
  "replace_existing": false
}
```

Omit unselected items or use null/empty participant_id to skip; at least one
assignment must be selected. Manual correction can assign any currently attended
participant, including ambiguous/unmatched items. Item and participant IDs must
be unique. A number is optional (missing/null becomes empty), max 100 characters;
preview-detected numbers are suggestions and must be sent explicitly to retain.
Existing certificates require boolean `replace_existing: true`.

Response 200: `{applied: count, certificates: [existing certificate serializer]}`.
Validation returns 400; foreign event/owner batches return 404. The batch is
single-use. Any event participant, attendance or certificate change since preview
invalidates the entire batch and requires a fresh preview (conservative snapshot).
All assignments validate before any write; database writes are atomic, failed
writes delete new files, replacements retain old files until successful commit.

Stored certificates are `source=uploaded`, `status=tersedia`; no template, number,
QR or signature asset is required or added. Separate files remain byte-for-byte
identical. Combined groups use pypdf page copying only (no render/overlay): their
PDF container changes but page design/content/resources are preserved. This is
not a claim of cryptographic signature validation; splitting a digitally signed
PDF does not preserve its cryptographic document signature.

Automatic generation already skips uploaded certificates. `set-number` now only
updates uploaded metadata and never re-renders its PDF or changes status.
Legacy `upload` / `bulk-upload` remain separate old APIs and should not be used by
the new UI; they do not have this review-first safety contract.

## Isolated verification

Tests are in `test_import.py`; `test_settings.py` forces in-memory SQLite and
temporary media/private paths, regardless of production database environment.
Run in a copied backend tree, not production source:

```
python manage.py test apps.certificates.test_import apps.certificates.test_workflow \
  --settings=apps.certificates.test_settings --noinput
python manage.py makemigrations certificates --check --dry-run \
  --settings=apps.certificates.test_settings
```

No additional dependency needed: pypdf/reportlab are already installed.
