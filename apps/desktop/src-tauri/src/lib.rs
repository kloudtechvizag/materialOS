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
    #[cfg(windows)]
    set_app_user_model_id();

    tauri::Builder::default()
        // Updater checks a signed manifest (tauri.conf.json's
        // plugins.updater.endpoints) and verifies the downloaded
        // package against plugins.updater.pubkey before ever writing
        // it to disk -- see docs/decisions/ADR-LOCAL-009. process
        // gives the frontend a way to relaunch after
        // downloadAndInstall() completes. Desktop-only: this plugin
        // doesn't build for mobile targets.
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running the MaterialOS desktop shell");
}

/// Without this, a taskbar-pinned shortcut can fall back to Explorer's
/// default per-process grouping/icon resolution instead of using this
/// app's own identity -- must run before window creation. Matches
/// tauri.conf.json's `identifier`. Best-effort: a failure here (e.g. an
/// already-set AppUserModelID on an unusual host) shouldn't block
/// startup, so the HRESULT is intentionally not unwrapped.
#[cfg(windows)]
fn set_app_user_model_id() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    let wide: Vec<u16> = "com.materialos.app\0".encode_utf16().collect();
    unsafe {
        SetCurrentProcessExplicitAppUserModelID(wide.as_ptr());
    }
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
