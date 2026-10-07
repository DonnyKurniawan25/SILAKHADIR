# Verification: Canva final PDFs + attendance XLSX

## Passed

- Docker backend build exit 0; Docker frontend build exit 0.
- New backend image: 50 certificate/attendance XLSX tests passed using SQLite/test media, never production DB.
- Frontend: 8 Node workflow/API contract tests passed.
- `makemigrations --check --dry-run`: no changes detected.
- Production `manage.py check`: no issues.
- Production certificate import migration applied.
- Private preview volume `/app/private_certificate_imports` mounted separately from public media.
- Hash checks: deployed imports, certificate views, attendance views/XLSX handlers and event routes match source.

## Live public HTTPS integration

Own draft fixture event, removed in `finally` together with participants, attendance, certificates and PDF files:

1. Download template XLSX; add three attended rows; dry-run; apply; repeat apply; assert exactly three attendance records, no automatically generated certificates; export XLSX and verify rows.
2. Upload three-page PDF; split explicit groups 1–2 and 3; automatic recipient name matches; authenticated private PDF previews return correct page counts; no certificate writes before apply; apply and download both participant PDFs via public download-token endpoint; assert participant text present and no event-title overlay.
3. Upload individual participant PDF; apply; assert stored bytes equal original input bytes.

All three live flows passed. An initial smoke-test attempt used a non-existent `/api/certificates/{id}/preview/` URL; corrected the diagnostic script to use the supported public download-token route and reran successfully.

## Browser UI inspection (read-only)

Dedicated headless Chrome with five-minute QA admin token:

- Actual event detail shows PDF Final Satu Peserta, Impor PDF Final Canva, Unggah Absensi Excel and Ekspor Absensi .xlsx.
- Combined/separate PDF options present; mixed-page checkbox opens `1-2, 3, 4-6` range field; limits show total 50 MB / 100 files / 200 pages.
- Attendance modal shows XLSX template/export, .xlsx-only file selection and 5 MB limit.
- Visual screenshot inspected: scrollable import modal, readable controls. Browser inspection did not submit production event data; full upload/apply flows were exercised separately via live HTTP above.

## Notes and limits

- Text-based matching only; flattened/scanned names and ambiguous recipients require manual assignment.
- Existing historical public profile lookup regression test exposes phone/email and fails its privacy assertion. It predates this change; unrelated lookup behavior was not modified. The 50-test passing scope is certificate + XLSX, not a claim that the entire app suite passes.
- Local native Rollup import failed with SIGBUS; production frontend successfully compiled inside Docker instead.
- Fresh dependencies emit a requests compatibility warning. Builds, tests and live workflow still passed.
- Splitting PDFs preserves page content/design, not a promise to preserve cryptographic PDF signatures.
