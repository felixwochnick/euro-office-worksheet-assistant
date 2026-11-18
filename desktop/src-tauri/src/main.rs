// No console window on Windows (the app has its own window and tray icon).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    worksheet_assistant_app_lib::run()
}
