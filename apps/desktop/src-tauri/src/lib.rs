//! MaterialOS desktop shell (ADR-012). Deliberately thin: the window
//! just loads the same React app apps/web already builds
//! (tauri.conf.json's frontendDist), so there is no second frontend to
//! maintain. A4/local printing uses the webview's native window.print()
//! (a standard web API, works with zero Tauri plugin/command code --
//! see the frontend's InvoiceDetailPage print button) rather than a
//! custom Rust print pipeline. Barcode scanners are HID keyboard-wedge
//! devices and already work against any focused text input, in this
//! window exactly as in a browser tab -- nothing to wire up.
//!
//! What is NOT here, on purpose: raw ESC/POS byte-level printing (for
//! a cash-drawer kick command specifically -- normal receipt *text*
//! printing works via window.print() to a thermal printer installed
//! as a normal OS printer, which covers most real setups) and serial/
//! USB device access for scales. Both need either a native Rust crate
//! talking directly to a device or a small local print-agent process,
//! and neither could be verified compiling in the sandboxed
//! environment this was written in (no system Rust/webkit2gtk
//! toolchain, no root to install one -- see the desktop README). Real,
//! uncompiled-and-unverified low-level device code is a bigger risk
//! than an honest gap; this ships only what's simple enough to be
//! confident is correct.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running the MaterialOS desktop shell");
}

#[derive(serde::Serialize)]
struct AppInfo {
    version: &'static str,
    platform: &'static str,
}

/// Exposed to the frontend as `invoke("app_info")` -- lets the UI show
/// e.g. "Desktop v0.1.0 (linux)" without hardcoding it in TypeScript,
/// and doubles as the one real, verifiable Tauri command<->webview
/// round trip in this shell.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo { version: env!("CARGO_PKG_VERSION"), platform: std::env::consts::OS }
}
