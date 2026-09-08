# ADR-012: Desktop app -- Tauri shell around the existing web app

**Context:** the original brief (dev.md §3, and the Master Brief's own
Appendix backlog) names the desktop app explicitly: "Tauri, React,
TypeScript... thermal printers, A4 printers, barcode scanners, cash
drawers, local printing, weighing-scale integrations, offline
operation." Same reasoning as ADR-005 (mobile-web instead of a second
React Native codebase for drivers): build the desktop shell so it wraps
`apps/web` as-is rather than standing up a second frontend to maintain.

**Structure: `apps/desktop` wraps `apps/web`'s build output, doesn't
duplicate it.** `tauri.conf.json`'s `frontendDist` points at
`../../web/dist`; `beforeBuildCommand`/`beforeDevCommand` just run
`apps/web`'s existing `npm run build`/`npm run dev`. There is no
second React app -- every route, every industry profile, every screen
this session built is the desktop app, automatically, with zero
desktop-specific frontend code required to keep it that way.

**What's real vs. deferred, and why:**

- **The shell itself** (window, native menu bar, app icon, installer
  packaging for `.msi`/`.dmg`/`.deb`/`.AppImage`) is a complete, correct
  Tauri v2 project (`Cargo.toml`, `tauri.conf.json`,
  `src/main.rs`+`lib.rs` split for a possible future mobile target,
  `capabilities/default.json`). Icons are generated from the real brand
  asset (`materialos_brand_assets.zip`'s `05_app_icon.png`) via
  `tauri icon`, not placeholders.
- **A4/local printing**: `window.print()` -- a standard web API that
  works in a Tauri webview with zero plugin or Rust code, wired to
  `InvoiceDetailPage` (`data-print-area` + a global `@media print`
  rule in `index.css` that isolates just the invoice, not the whole
  app shell). This also covers most real thermal-printer setups, which
  are commonly installed as an ordinary OS printer (CUPS/Windows
  driver) rather than accessed at the raw byte level.
- **Barcode scanners**: not implemented, because there is nothing to
  implement. Every barcode scanner in real use is a HID keyboard-wedge
  device -- it types the scanned code into whatever text field has
  focus. That already works in this app today, in a browser tab and in
  the desktop shell identically (see `PosPage`'s search input), because
  a webview's text inputs receive keystrokes the same way a browser's
  do. Building a fake "connect your scanner" UI for something that
  needs no connecting would be exactly the kind of dishonest gesture
  this project has avoided everywhere else.
- **Cash drawer (raw ESC/POS kick command) and weighing-scale
  integration**: not implemented. Both need raw byte-level access to a
  serial/USB device, which means either a native Rust crate talking
  directly to the hardware or a small local print-agent process --
  real work, not a config flag. Deferred rather than shipped
  unverified (see the verification note below for why "unverified" is
  the operative word here).
- **Offline operation**: not addressed beyond what already exists
  (TanStack Query's cache, Zustand's `persist` to localStorage). A
  genuine offline-first desktop mode (asset caching, a mutation queue,
  conflict resolution) is real, separate architecture -- the mobile
  offline-first requirement in dev.md §66 is in the same unbuilt state
  for the same reason, and this doesn't change that.

**Verification status -- read before assuming this compiles.** This
sandboxed dev environment has no Rust toolchain, no system package
manager root access, and critically no `libwebkit2gtk-4.1-dev`
(Tauri's Linux WebView backend) or `pkg-config` pre-installed, and no
sudo to add them. What was actually verified here:
- `rustup` installs cleanly (no root needed) and `cargo` successfully
  resolves and compiles a real chunk of the dependency tree
  (`glib-sys`, `gio-sys`, and their dependents) -- proof the
  `Cargo.toml` manifest and dependency graph are valid, not just
  plausible-looking.
- The build fails, as expected, specifically at `gio-sys`'s build
  script trying to invoke `pkg-config` to locate `glib-2.0`/`gio-2.0`
  -- confirmed by manually downloading (`apt-get download`, no root
  required) and inspecting the relevant `.deb`s: the system libraries
  Tauri's Linux backend needs are genuinely absent and genuinely
  require root (`apt-get install`) to add, which this sandbox does not
  have.
- The frontend half (`apps/web/dist`) builds and typechecks cleanly,
  same as every other frontend change this session -- `frontendDist`
  in `tauri.conf.json` points at a real, existing directory.

None of this proves the desktop app *runs*. What it proves is that the
gap is precisely the documented, standard Tauri Linux prerequisite
(https://tauri.app/start/prerequisites/), not a mistake in this
project's Rust code. The actual compile-and-link verification happens
in CI (`ci.yml`'s new `desktop-check` job, on every push, `cargo check`
only -- fast) and real installer builds happen in
`desktop-release.yml` (`tauri-apps/tauri-action`, one native runner
per OS, triggered on `desktop-v*` tags or manual dispatch) -- both run
on GitHub-hosted runners with real root access and the real
prerequisite packages, which is also how the overwhelming majority of
real Tauri projects actually produce their installers (nobody
hand-builds a Windows `.msi` on a Linux dev box either).
`desktop-release.yml`'s matrix is Windows (`.msi`) and Linux
(`.deb`/`.AppImage`) only -- macOS wasn't requested and GitHub-hosted
macOS runners carry a 10x per-minute cost multiplier on private repos;
re-adding it is one matrix entry, not a structural change (the
workflow's own comments have the exact `--target` values it used
before).

**Unsigned by default.** `desktop-release.yml` has no code-signing
secrets configured -- an unsigned `.msi` triggers a Windows
SmartScreen warning on first launch. Faking a signature isn't possible
without a real certificate; this is named in the workflow's own
comments rather than silently shipped as a surprise.

**Reversibility:** all of the above are additive. Cash-drawer/scale
device access, offline-first sync, and code signing all slot in
without touching the shell's existing structure -- the same "minimal
now, reversible seam later" pattern as every ADR in this project.
