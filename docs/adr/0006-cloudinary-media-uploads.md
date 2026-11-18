# ADR 0006: Cloudinary for owner-uploaded images, behind MediaStoragePort

Status: accepted, 2026-11-17.

## Context
Owners need to add photos to products in the catalogue. These images feed posts and creatives, so they need fast public delivery and, later, resizing and cropping per platform. BUSINESS_BRAIN.md plans S3-compatible storage behind `StoragePort` for originals, but nothing is built yet, and a plain bucket would also need a CDN and an image-resizing layer.

## Decision
- Owner-uploaded images go to Cloudinary, configured by one variable, `CLOUDINARY_URL` (`cloudinary://<api_key>:<api_secret>@<cloud_name>`). Without it, upload is off and the rest of the app works.
- Access goes only through `MediaStoragePort` in `infra/storage` (`CloudinaryAdapter`, or `UnavailableMediaStorage` when unset). Feature code never sees the provider.
- **Signed direct upload, no SDK.** `POST /brand/media/upload-ticket` with `{ purpose: "product_image" | "brand_logo" | "reference_post" }` (owner, admin, manager) returns a ticket: the upload URL and signed fields (`folder`, `allowed_formats`, `timestamp`, `api_key`, `signature`). The browser posts the file straight to Cloudinary, so file bytes never pass through our API. Signing is SHA-1 over the sorted params plus the secret, using `node:crypto`. The secret never leaves the server. A signature is valid for one hour.
- Product photos go in `marketpilot_products/<workspaceId>` logos in `marketpilot_brand/<workspaceId>`, and the owner's own past posts (the "Your recent posts" profile field, up to 9, used as style references for image generation until a social account is connected) in `marketpilot_posts/<workspaceId>`. The logo is a profile field that already accepts any web address (the owner can also paste a link, and the website scan finds one), so an uploaded logo is saved like any other value. When a product is saved, each new image URL must be a `https://res.cloudinary.com/<our cloud>/image/upload/...` URL inside that workspace's folder. URLs already on the product (for example, ones read from the website) are kept. A client cannot attach arbitrary links or another tenant's files.
- Only the public `secure_url` is stored, in the existing `brand_product.image_urls` column. No schema change.
- Limits: JPG, PNG or WebP (enforced by the signed `allowed_formats`), up to 6 images per product and 10 MB each (checked in the browser).

## Consequences
- Cloudinary is a subprocessor and stores data outside India. List it in the privacy policy (see ADR 0001 on residency).
- Delivery URLs are public. Product photos are public by nature, but nothing private may go through this path.
- Uploads whose product is never saved, and images removed from a product, stay in Cloudinary as orphans. A cleanup job (list the folder, diff against `image_urls`) is deferred until storage cost matters.
- File size is only checked in the browser. To enforce it on the server, move to a signed upload preset with a size limit.
- Raw originals for the Brand Brain (page snapshots, documents) still belong to the planned S3-compatible `StoragePort`. Moving images there later is a new adapter plus a URL migration.
