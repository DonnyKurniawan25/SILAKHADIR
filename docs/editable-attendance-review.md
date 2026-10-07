# Editable attendance preview and system identity matching

## User-facing workflow

1. Upload the existing .xlsx template; initial preview does not write.
2. Edit bad values directly in the preview, including Name, NIK, NIP and optional fields/status.
3. Remove/skip duplicate rows in the preview without changing the original workbook.
4. Revalidate the edited rows against the current database.
5. Confirm and save the edited values, not the original file contents.
6. Participant/attendance records remain visible after reopening. Real certificate history remains discoverable across compatible event records.

## Identity indicators and correction

- Green existing: verified matching system identity, not name-only similarity.
- Same NIP/name but different NIK: highlight/correct NIK.
- Same NIK/name but different NIP: highlight/correct NIP.
- Same unique name but both identifiers different: highlight/correct both.
- Ambiguous names/contradictory stored identities: no guessed automatic linking.
- A system-data correction is an explicit admin action; never silently rewrite existing identity records.
- Name plus NIP or NIK remains the required combination. Missing NIK is stored NULL if unknown.

## API

`POST /api/events/{eventId}/attendance/import-xlsx/`

- Multipart `file` + string `dry_run` for initial XLSX preview, legacy compatibility.
- JSON `{rows:[{row,nik,nip,full_name,institution,position,phone,email,status}],dry_run:true|false}` for edited preview/apply.
- Ignore untrusted IDs/system flags/history metadata; reconstruct them server-side.
- Revalidate atomically at apply under the existing event lock. All remaining rows must pass validation.

Additional row metadata: `system_status`, `system_record`, `correction_fields`, `certificate_history`. Permanent participant-list history is derived from actual certificate records associated with compatible identity records, not manufactured from an attendance upload. Attendance import does not generate a PDF or mark a new event certificate as available.

## Acceptance verification matrix

- Duplicate removal followed by edited JSON validation/application.
- All three identity conflict combinations in event and across previous events.
- Green exact system match and no green indication for name-only/conflicting identities.
- Missing optional fields and NIP-only/NIK-only compatibility.
- Invalid edits/no approval, stale request invalidation, server-side revalidation.
- Idempotent repeat apply and unchanged participant/attendance IDs.
- Real uploaded PDF history in preview and reopened participant list.
- No phantom certificate after attendance import; no certificate overwrite.
- Browser correction buttons, manual cell edits, duplicate removal, revalidation and explicit save.

Verification outcomes are recorded after actual execution in the delivery; this document is the acceptance contract, not a claim that every scenario above has passed before test execution.
