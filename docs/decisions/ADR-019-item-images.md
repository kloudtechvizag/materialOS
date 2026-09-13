# ADR-019: Product-catalogue item images -- real tenant uploads, not stock photos

**Context:** a brief asking MaterialOS to source internet imagery
(Unsplash/Pexels) for a wide range of uses included product-catalogue
images -- photos shown in POS, quotations, and the product master for
a tenant's own inventory. A generic stock photo of "cement" or "TMT
rods" standing in for a specific merchant's actual product would
misrepresent what they're selling: a customer looking at a quotation
line item would reasonably assume that photo is the real product. This
is the same category of problem this project has avoided everywhere
else (ADR-012's barcode-scanner section, ADR-018's SQLite/sync
sections) -- confirmed with the user before building anything (see
conversation), who agreed this needed to be a real upload feature
instead.

**Decision: item photos are real, tenant-uploaded files, stored and
served through the existing `app/storage.py` local-filesystem adapter
-- the same mechanism fleet.py's POD photos and imports.py's uploaded
files already use.** No new storage technology, no third-party image
service.

- **Migration** `a1b2c3d4e5f6_item_image.py`: adds `items.image_path`
  (nullable `VARCHAR(500)`, a storage-relative path -- never a raw
  filesystem path exposed to the browser).
- **Backend** (`app/api/v1/catalog.py`): `POST /items/{id}/image`
  (multipart upload, `items.edit` permission) saves via
  `storage.save_file(category="item_images", ...)` and stores the
  returned relative path on the item. `GET /items/{id}/image`
  (`items.view` permission) reads it back via `storage.read_file` and
  returns it with a `mimetypes`-guessed content type. No file-size or
  content-type validation added -- matches this codebase's existing
  upload endpoints (fleet.py POD photos, printing.py artwork), none of
  which validate either.
- **Frontend**: images need the same tenant JWT as any other API call,
  so a plain `<img src="/api/v1/items/{id}/image">` can't work -- the
  browser won't attach an Authorization header to it. `useAuthenticatedImage`
  (`lib/useAuthenticatedImage.ts`) fetches the image as a blob with the
  bearer token and hands back an object URL; `ItemImage`
  (`components/items/ItemImage.tsx`) wraps that with an icon fallback
  (Lucide's `Package`, matching `EmptyState`'s existing icon-based
  convention -- explicitly kept over an illustration-based redesign,
  confirmed with the user) for items with no photo. Wired into
  `ItemsPage`'s list as a clickable thumbnail (click -> file picker ->
  upload -> list refetches).
- **Cache-key gotcha, caught by actually testing it live (not just
  typechecking):** the image URL is the same before and after a
  re-upload (`/items/{id}/image` never changes), so
  `useAuthenticatedImage`'s effect had no signal to refetch after the
  list query invalidated. Fixed by threading the item's own
  `image_path` value through as a second effect dependency purely as a
  cache key -- it changes exactly when the real image does. Caught this
  by uploading a real file through the actual running app (Playwright-
  style, against the live `docker-compose` stack already running in
  this environment) and finding the thumbnail didn't update after a
  fresh page load; server-side data (`SELECT image_path FROM items`)
  proved the upload itself worked, isolating the bug to the frontend
  cache key specifically before fixing it.

**What this does NOT do:** no image gallery/multiple photos per item
(one primary image only), no resizing/thumbnail generation on upload
(the same original bytes serve every consumer), no delete endpoint (a
re-upload overwrites the pointer; the old file is orphaned on disk,
same tradeoff this codebase already accepts elsewhere for local
storage), not wired into POS/quotations/customer portal yet -- only
`ItemsPage` (the product master, where images are managed) got the
first real consumer. Extending display to other consumers is
straightforward now that the core capability exists.

**Verification.** Unlike most of this session's other backend/desktop
work, this one was fully verified against a real, live environment:
this sandboxed devbox turned out to already have a running
`docker-compose` stack (Postgres, Redis, the API, and the web app --
`docker ps` showed 6-day-old containers this session had, until now,
never checked for). Applied the migration against that real database,
ran the full test suite inside the actual API container (119 passed,
0 failures), and drove the real running web app with headless Chromium
against the real seeded `sribalaji-demo` tenant: logged in, uploaded an
actual file through the real `ItemsPage` UI, confirmed the row in
Postgres (`image_path` set), confirmed the thumbnail rendered after a
full page reload (proving persistence, not just client state), then
reverted that one test upload on the shared demo tenant afterward
(disposable test tenants created by the pytest run were left as-is,
consistent with this codebase's existing test convention of not
cleaning those up).

**Reversibility:** additive -- the column, the two endpoints, and the
two new frontend files can be removed without touching any other
feature.
