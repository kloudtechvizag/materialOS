# ADR-018: Desktop auto-update -- Tauri's official updater plugin, not a custom mechanism

**Context:** now that `desktop-release.yml` (ADR-012) actually publishes
installable binaries, an installed copy of MaterialOS has no way to
find out a newer one exists short of a person manually checking
GitHub Releases. The brief for this asks for a much larger
local-first architecture (SQLite, sync queue, conflict resolution,
device licensing) coordinated with auto-update -- none of that exists
yet in this repo (confirmed: no SQLite, no sync engine, no license/
device-activation backend). Building auto-update logic *for*
infrastructure that doesn't exist would be exactly the kind of fake
functionality this project avoids elsewhere (ADR-012's own barcode-
scanner section). This ADR is scoped to what's real today: the
version-update pipeline itself, using Tauri v2's own official
mechanism per the brief's own instruction not to replace the desktop
framework merely to add auto-update.

**Decision: `tauri-plugin-updater` + `tauri-plugin-process`, signed
manifest hosted on the GitHub Release itself.** No custom update
server, no custom signature scheme.

- `apps/desktop/src-tauri/tauri.conf.json`: `bundle.createUpdaterArtifacts:
  true` makes `tauri build` emit a signed update payload + `.sig`
  alongside the normal installers. `plugins.updater.endpoints` points at
  `https://github.com/kloudtechvizag/materialOS/releases/latest/download/latest.json`
  -- a static JSON manifest, no server to run or maintain.
  `plugins.updater.pubkey` is the real Ed25519 public key from a keypair
  generated via `tauri signer generate` (see below).
- `apps/desktop/src-tauri/src/lib.rs`: both plugins registered under
  `#[cfg(desktop)]` in `.setup()` (mobile targets don't build them).
- `apps/desktop/src-tauri/capabilities/default.json`: `updater:default`
  and `process:default` permissions added to the main window.
- `.github/workflows/desktop-release.yml`: `TAURI_SIGNING_PRIVATE_KEY`
  and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` passed as env on the
  `tauri-action` step. `tauri-action`'s `includeUpdaterJson` input
  defaults to `true` and the step already passes `releaseId` (ADR-012),
  so no other workflow input changes were needed -- it generates and
  uploads `latest.json` to the same release automatically.
- **Frontend, desktop-only, zero effect on the web build:**
  `apps/web/src/lib/desktopUpdater.ts` wraps `check()` /
  `downloadAndInstall()` / `relaunch()` behind `isTauri()` from
  `@tauri-apps/api/core` -- every function no-ops (returns `null` /
  does nothing) when not running inside the Tauri webview, since
  `apps/web`'s build is shared between the web app and the desktop
  shell (ADR-012) and must behave identically in a plain browser tab.
  `apps/web/src/components/DesktopUpdateNotifier.tsx` mounts once in
  `AppShell`, checks on startup and every 4h, and shows a `sonner`
  toast ("MaterialOS x.y.z is available", Update Now / Later) rather
  than a blocking dialog.

**The restart is always user-initiated, on purpose.** The brief asks
for the update to avoid interrupting an active POS sale, payment, or
print job. Building real "is this a safe moment" detection would mean
threading update-awareness through every transaction flow in the app
-- a large, separate change. Instead: `downloadAndInstall()` (which
also performs the actual install) only ever runs from the user's own
"Update Now" click on the toast -- MaterialOS never restarts itself
unprompted. This is a genuinely safe way to satisfy "don't interrupt
active work" without fabricating transaction-awareness that isn't
there yet.

**What this does NOT do, and why -- read before assuming more than
version-bump auto-update exists:**

- **No SQLite migration coordination (brief §18-27).** There is no
  local database to migrate. `latest.json`'s schema has no field for
  this and none was invented. When SQLite lands, this ADR's update
  flow is exactly where a migration-on-update step would plug in
  (`downloadAndInstall()` succeeds → run pending migrations → then
  `relaunch()`), but that step does not exist today.
- **No mandatory-update enforcement.** Tauri's static-JSON manifest
  format has no "mandatory" field the plugin acts on -- `check()`
  returns "an update exists" or it doesn't. A real mandatory-update
  policy (block usage below some minimum version) needs an actual
  update *service* the client calls, not a static file. Not built.
- **No staged rollout, release channels, or maintenance windows
  (§7-8, §36).** `latest.json` always points at the single most recent
  GitHub Release for everyone. No STABLE/BETA/DEV channel split, no
  percentage rollout, no admin-configured install window. All of
  these need a real update service too.
- **No OS-level code signing.** Same unsigned-`.msi`/`.exe` gap
  ADR-012 already named -- SmartScreen still warns on first install.
  The Ed25519 keypair this ADR adds is a *separate* thing: it lets
  `tauri-plugin-updater` verify an update package wasn't tampered
  with in transit, unrelated to Authenticode/notarization.
- **No delta/differential updates (§37-38).** Each update ships the
  full installer payload. Tauri doesn't provide binary diffing out of
  the box; this uses the reliable default rather than building one.
- **No Settings → About → Update History UI (§34).** There's no
  Settings/About page in this app at all yet, and no durable local
  store to honestly back an update-history log with (the "later"
  dismissal is a single `localStorage` key, a UI preference per
  ADR-012's own precedent -- not an audit trail).

**Signing key generated, not committed.** `tauri signer generate -p
<password>` produced a real Ed25519 keypair. The **public** key is
committed in `tauri.conf.json` (`plugins.updater.pubkey`) -- that's
its intended use, it's meaningless without the private half. The
**private** key and its password were written to a local, un-tracked
path outside this repository and were never staged, committed, or
pasted into any file under version control (see "no secret leakage,"
brief §72). They must be added as two GitHub Actions repository
secrets -- `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` -- before the *next* tagged
release can produce a working, verifiable update; the workflow will
otherwise fail at the sign-and-bundle step. **Losing this private key
means no future release can ever be verified by already-installed
copies of MaterialOS again** -- it should be backed up somewhere
outside GitHub (a password manager, not another repo), not only in
the Actions secret.

**Verification status.** Same sandboxed environment constraints as
ADR-012 (no root, no `libwebkit2gtk-4.1-dev`/`pkg-config`) apply here
too:
- `cargo metadata` / `cargo tree -p tauri-plugin-updater -p
  tauri-plugin-process` resolve and lock cleanly against the real
  crates.io index -- proof the two new dependencies and their version
  constraints are valid, same evidentiary bar as ADR-012's `glib-sys`
  check. A full `cargo check`/`cargo build` still cannot run here for
  the same pre-existing reason (Linux WebView system libraries
  require root); real compile verification happens in CI
  (`ci.yml`'s `desktop-check`) exactly as ADR-012 already established.
- `apps/web`: `tsc --noEmit` and `vite build` both pass with the new
  `@tauri-apps/api`, `@tauri-apps/plugin-updater`,
  `@tauri-apps/plugin-process` imports in place.
- Confirmed live in a real browser (Playwright, against this repo's
  running dev stack, logged in as the seeded demo tenant): zero
  console/page errors with `DesktopUpdateNotifier` mounted --
  `isTauri()` correctly returns `false` outside the Tauri webview, so
  every updater call in `desktopUpdater.ts` short-circuits before
  touching the Tauri IPC bridge that doesn't exist in a browser tab.
- **Not verified:** an actual end-to-end update (old installed
  binary → `check()` finds `latest.json` → download → signature
  verified → installed → `relaunch()`) has not run, because doing so
  needs a real Windows/Linux desktop install and a second tagged
  release to update *to* -- this sandboxed environment cannot produce
  or run a GUI binary. First real proof comes from the next
  `desktop-v*` tag after the two signing secrets are added: install
  the current 0.2.6 build, cut e.g. 0.2.7, and confirm the running
  0.2.6 instance offers and completes the update.

**Reversibility.** Additive, same as every ADR in this project: the
updater plugins, capabilities, and `DesktopUpdateNotifier` can be
removed without touching anything else in the desktop shell or the
shared `apps/web` codebase. Rotating the signing key is also
non-destructive to already-installed clients -- they simply stop
seeing new updates as available until they're reinstalled with the
new `pubkey`, which is why losing the current key is a real (if
recoverable-by-reinstall) event, not a silent one.
