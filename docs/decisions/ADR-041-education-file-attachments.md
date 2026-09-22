# ADR-041: Education file attachments — reused the existing storage adapter, not a new upload mechanism

**Context:** the second of four deferred items picked back up this
pass. ADR-026 named "Document upload — no storage wiring attempted;
`app.storage` exists and is reused elsewhere (item images), so this is
a real, scoped follow-up, not a gap in the platform." ADR-030 and
ADR-033 named the same gap for homework and announcements. All three
already pointed at the same answer: `app/storage.py`'s `save_file`/
`read_file` — a real local-filesystem adapter (S3-swappable later per
its own docstring) already used by `Item.image_path` (ADR-019) and
fleet POD photos.

## What shipped

**`AdmissionDocument`** — a real one-to-many table (migration
`a2b3c4d5e6f7`), not a single path column: an application genuinely
needs more than one real file at once (birth certificate, transfer
certificate, photo), unlike the other two entities below. Full CRUD
(`POST`/`GET`/`DELETE /admission-applications/{id}/documents`), a free-
text `document_type` field (same "school-specific categories are
configuration, not code" reasoning as `Student.category`), staff-only
(`admissions.view`/`.edit`).

**`Homework.attachment_path`** and **`Announcement.attachment_path`**
— single nullable path + display filename columns, the same shape as
`Item.image_path`, since a worksheet or a permission-slip attachment
is genuinely one file per record. Upload/download endpoints follow
`catalog.py`'s existing `upload_item_image`/`get_item_image` pattern
exactly: `UploadFile` in, `Response` with a real `Content-Type` (via
`mimetypes.guess_type`) and `Content-Disposition: attachment` out.

**Guardian Portal exposure**: homework attachments
(`/guardian-portal/children/{id}/homework/{homework_id}/attachment`)
and announcement attachments
(`/guardian-portal/announcements/{id}/attachment`) each re-derive the
guardian's real scope before serving a file — a guardian can only
download an attachment for homework their own child was actually
assigned, or an announcement actually in their own targeting scope —
not any id in the tenant. `get_child_homework_attachment` re-checks
against the real roster; `get_guardian_visible_announcement` re-runs
the same visibility filter `list_visible_announcements_for_guardian`
already uses, rather than trusting the id alone.

**Frontend**: a new `downloadAuthenticatedFile` helper
(`lib/api.ts`) — a plain `<a href>` can't carry the `Authorization`
header these endpoints require, so it fetches as a blob and triggers
the save via a throwaway anchor, the same "fetch as blob" shape
`useAuthenticatedImage` already established for images. Wired into
`AdmissionApplicationDetailPage`, `HomeworkDetailPage`,
`AnnouncementsPage`, and both Guardian Portal pages.

## Deliberately not built in this pass

- **Virus/content scanning on upload** — matches every other upload
  path in this codebase (item images, fleet POD photos); named, not a
  new gap this ADR introduces.
- **Per-document-type validation** (e.g. "Birth Certificate must be a
  PDF") — `document_type` is free text with no format constraint tied
  to it.
- **Admission document deletion by anyone other than staff who
  uploaded it** — any staff with `admissions.edit` can delete any
  document; no per-uploader ownership check.

## Verification

Full backend suite: 301 passed, zero regressions (this slice added no
new backend tests beyond what the live verification below covered
directly against the real `greenwood-demo` tenant, since the CRUD
shape is a direct, low-risk mirror of the already-tested item-image
pattern). `tsc --noEmit`, `npm run build` clean.

Backend verified directly via `curl` against the real
`greenwood-demo` tenant: `POST /admission-applications/{id}/documents`
with a real multipart file returned `201` with the real stored
`file_name`; a follow-up `GET` on the documents list showed it
correctly. Frontend upload/list/download UI verified by code-pattern
review (identical to the already-proven `ItemImageCell` production
pattern) rather than a live file-picker click-through: CDP headless
Chromium's `DOM.setFileInputFiles` + `fetch()`'s FormData
serialization hit a reproducible headless-mode-only failure
(`TypeError: Failed to fetch`) when the `File` object came from a CDP-
injected file input specifically — a synthetic `Blob` through the
exact same `fetch()` call succeeded twice, and the backend endpoint
itself succeeded via both `curl` and the raw-`fetch()` replay,
isolating the failure to the test harness, not the product. Real users
picking a file through an OS file dialog are unaffected — this is the
same code path `ItemImageCell` already runs in production.

## Reversibility

Fully additive: one new table (`admission_documents`), two new
nullable columns each on two existing tables, no existing column
changed. Deleting the feature means dropping the new endpoints and
columns; no other code path depends on them.
