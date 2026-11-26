# ADR 0009: Asset library in one `asset` table, videos through the same media storage

Status: accepted, 2026-11-20.

## Context
Phase 1 includes M4, a basic library: one place for the owner's own photos and videos and everything the studio has made. Generated images live in `studio_output`, and product photos, the logo and reference posts sit in brand profile fields. Nothing lists them together, and the owner has nowhere to upload a video.

## Decision
- The `assets` module owns one tenant table, `asset`: `kind` (`image` | `video`), `source` (`upload` | `generated`), the public URL, and display metadata (name, width, height, bytes, duration). It has the same RLS policy as every tenant table. `(workspace_id, url)` is unique, so saving one upload twice keeps one row.
- The studio writes a `generated` asset for each output, inside the transaction that stores the outputs, linked by `studio_output_id`. The migration backfills images that already exist.
- Uploads reuse the signed direct upload from ADR 0006: `POST /assets/upload-ticket { kind }`, the browser posts the file to storage, then `POST /assets` saves the URL. The server accepts only URLs inside `marketpilot_library/<workspaceId>` for that kind. `MediaStoragePort.createUploadTicket` and `ownsUrl` take a `kind`; for Cloudinary, videos use the `video/upload` endpoint with `mp4,mov,webm`.
- Limits: images as in ADR 0006 (JPG, PNG, WebP, 10 MB). Videos are MP4, MOV or WebM, up to 100 MB, the largest single request the Cloudinary base plan accepts. Sizes are checked in the browser only.
- Width, height and duration are read in the browser from the file, not from the storage response, so they do not depend on the provider. They are for display only.
- Removing an asset sets `deleted_at` (ARCHITECTURE.md 3.1 allows soft delete for assets). The file stays in storage, and a generated image stays in its Create page history.
- Everyone in the workspace can browse; owner, admin, manager and creator can upload and remove.
- The list is newest first with a keyset cursor `(created_at, id)`, 40 per page, filterable by kind and source.

## Consequences
- Product photos, the logo and reference posts are not in the library yet. Bringing them in means writing `asset` rows when the profile saves them.
- Thumbnails load the original file. When grid weight matters, add a thumbnail URL to `MediaStoragePort` (Cloudinary can resize on delivery).
- Video files are larger and also go to Cloudinary outside India (see ADR 0001 and 0006).
- Orphans are the same as in ADR 0006: an uploaded file whose save never happens, or a removed asset, stays in storage until a cleanup job exists.
