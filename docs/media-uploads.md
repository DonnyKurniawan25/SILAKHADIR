# Media upload size and file lifecycle

## New uploads

`apps.media.storage.OptimizedMediaStorage` is the default Django media storage.
Optimization happens **before** saving the resulting file. It does not keep an
additional original in MEDIA_ROOT. Static files use their unchanged storage.

- Still JPG/JPEG, PNG and WebP: target **strictly below 1,000,000 bytes**. Already
  smaller files remain unchanged. Larger photographs try encoding (JPEG/WebP
  quality 90 to 60), then bounded proportional downscaling. Output extension and
  image format stay consistent. PNG alpha/transparency is retained; large EXIF
  images are orientation-normalized.
- General PDF attachments: conservative lossless optimization only. Pages,
  decoded drawing instructions, page boxes/rotation and extracted text are
  checked after rewriting. Never rasterize pages or re-encode their images.
  Digitally signed/encrypted/complex PDFs remain untouched. Text/vector PDFs
  must pass an 8 MB total decoded content/font-stream budget; complex filters
  and XObjects skip optimization. A smaller result is useful even when >1 MB.
- **Final certificate imports intentionally bypass optimization** so reviewed
  Canva PDFs retain their exact original bytes in separate-file mode, whether
  the signature is cryptographic or only visual. Combined mode still splits
  ordinary PDFs as requested; a detected digital signature requires separate
  upload mode, since splitting would invalidate it.
- Office files (XLSX/DOCX), ZIP, animations and other unsupported formats remain
  intact. They are not rejected merely for exceeding the optimization target.

Safety escape hatches retain originals: source >32,000,000 bytes, image
>16,777,216 pixels / 12,000 pixels on a side, unsafe/corrupt/unsupported content,
or PDF >500 pages. API-specific upload validation still applies (e.g. thumbnail
source max 5 MB and 4096 x 4096). The target is not a universal upload size limit.
No retroactive resizing/rewrite of existing production documents is performed.

Optional Django settings: `MEDIA_OPTIMIZATION_TARGET_BYTES` (cannot exceed
1,000,000), `MEDIA_OPTIMIZATION_MAX_INPUT_BYTES`, `MEDIA_OPTIMIZATION_MAX_PIXELS`,
`MEDIA_OPTIMIZATION_MAX_DIMENSION`, `MEDIA_OPTIMIZATION_RESIZE_STEPS`,
`MEDIA_OPTIMIZATION_MAX_PDF_PAGES`. Defaults are deliberately resource-bounded.

## Replace / clear / delete

Media app startup registers handlers for all local managed models with FileField
or ImageField (event thumbnails, report covers/photos/attachments, certificate
PDF/QR, templates and attendance images). They snapshot persisted file names,
then remove old files **after successful database commit**. Clearing a field,
ordinary object deletion and cascade deletion use the same mechanism.

Before deletion they check references across all local file fields in that DB.
Distinct filesystem storage aliases resolving to the same root share reference
protection. Still-referenced files are retained. Only known owned upload prefixes
are removable; traversal, foreign paths and symlinks outside storage fail closed.
A failed transaction retains previous files. Cleanup failures are logged, not
allowed to silently delete unrelated files or fail an already committed request.
Private certificate previews are also removed on item/batch/event cascade deletion;
expiry cleanup now uses these commit-safe handlers. Import apply/error paths retain
their explicit newly-written file/preview cleanup.

Storage itself is not transactional: a new file written before an outer database
rollback can still become an orphan. Raw SQL, QuerySet.update/bulk_update and
explicit FieldFile.delete bypass these hooks. Current successful application
replace/delete paths use ORM save/delete; this feature is **not** a mass orphan
purge, and does not erase arbitrary historical/manual files or backups. Unknown
callable upload roots must be registered in the code-owned prefix map first.

## Verification

Run isolated `config.settings_test` with temporary media/private roots, never a
production test database. Relevant regression tests cover actual image/PDF bytes,
stream ownership/cursors, alpha, EXIF, signed-PDF preservation, large-final-PDF
byte identity, largest allowed thumbnails, thin banners, namespace aliases,
replace/clear/delete/cascade, rollback, shared files and unsafe paths. Exercise
real multipart uploads through the public API after deployment, then check both
HTTP 404 and filesystem absence after replacement/deletion using a dedicated QA
event. Remove the QA event and confirm private preview and certificate cascades.
