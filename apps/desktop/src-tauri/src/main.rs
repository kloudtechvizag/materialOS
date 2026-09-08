// Thin entrypoint -- all real setup lives in lib.rs (see ADR-012) so a
// future mobile target can reuse it without duplicating this file.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    materialos_desktop_lib::run();
}
