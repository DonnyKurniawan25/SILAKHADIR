# Attendance XLSX identity and error presentation correction

## Product rule

- Require Nama Lengkap plus at least one exact identity: NIP (18 digits) or NIK (16 digits).
- NIP-only ASN may be stored with NULL NIK; never fabricate identifiers.
- If a compatible exact NIP exists, recover a consistent known NIK across events. Reject conflicting names/identities rather than linking by name alone.
- NIK-only non-ASN supported. Optional cells may be empty; empty status defaults to hadir.
- Blank optional cells retain existing values on reimport. Completing a NIK later updates the same NIP-only participant/attendance.
- Both provided identities must be valid; malformed/scientific/numeric identifiers cannot be silently discarded or reconstructed from rounded Excel numbers.

## Human-readable validation

- HTTP errors retain structured row/column/message/hint issues.
- Frontend error banner summarizes the error count without serializing participant rows.
- Issue table shows Excel row, participant name, column, cause, and repair instructions.
- Preview has dedicated name/NIP/NIK/status/action columns, no internal IDs or raw JSON.
- Approval/apply remains disabled on validation errors.
- Numeric identity cells have one actionable error per affected column rather than redundant regex/length errors.
- Updated downloadable template documents NIP-only and NIK-only examples and preformatted text identifiers.

## Verification

- 69 scoped backend tests passed with SQLite and temporary storage, including certificate regressions, identity collision checks and nullable-NIK behavior.
- 10 frontend validator/API tests passed.
- Docker frontend build and backend builds succeeded; Django check and migration dry-run passed.
- Production participants.0003_nullable_nik applied; SQL backup verified before deployment. No database service restart.
- Live public HTTPS preview/apply checked five disposable participants: two NIP-only, one NIK-only, known-NIP enrichment, dash-as-empty non-ASN.
- Verified preview no-write, optional fields blank, default hadir, repeat import idempotence, later NIK completion on same record, XLSX export with missing NIK, and zero auto-generated certificates.
- Live invalid scientific NIP and missing NIP/NIK returned HTTP 400 with row/column/hint; attempted apply rejected atomically.
- Real browser file selection/upload of an invalid XLSX showed the structured issue table and disabled apply; no raw participant JSON in the banner.
- Own temporary draft events, attendance and participants removed; production participant count returned to its original value.

Scope: attendance XLSX import, not a relaxation of existing public attendance/form CAPTCHA contracts. Tests are scoped; this is not a claim that unrelated legacy test suites or multi-process MySQL races have been exhaustively validated.
