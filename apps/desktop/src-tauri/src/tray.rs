//! The icon in the system tray (menu bar on macOS): the app keeps running there when its window is closed,
//! because the plugin's AI chat and MCP need the server.

use crate::sidecar::{ServerState, Sidecar};
use crate::updates::{UpdateState, Updates};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

pub const TRAY_ID: &str = "main";

/// Can this desktop show tray icons? Linux: only with a StatusNotifier host (KDE, most desktops; GNOME only with the
/// AppIndicator extension) – the library would create an icon nobody sees. Windows and macOS always can.
pub fn host_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        use gio::prelude::*;
        let Ok(bus) = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE) else {
            return false;
        };
        bus.call_sync(
            Some("org.freedesktop.DBus"),
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "NameHasOwner",
            Some(&("org.kde.StatusNotifierWatcher",).to_variant()),
            Some(gio::glib::VariantTy::new("(b)").expect("valid type")),
            gio::DBusCallFlags::NONE,
            2000,
            gio::Cancellable::NONE,
        )
        .ok()
        .and_then(|v| v.get::<(bool,)>())
        .is_some_and(|(owned,)| owned)
    }
    #[cfg(not(target_os = "linux"))]
    true
}

fn status_text(app: &AppHandle) -> String {
    let status = app.state::<Sidecar>().status();
    match status.state {
        ServerState::Starting => "Startet …".into(),
        ServerState::Running if status.chat_error.is_some() => "Läuft – MCP bereit, KI-Chat aus".into(),
        ServerState::Running => "Läuft – KI-Chat und MCP bereit".into(),
        ServerState::Error => "Fehler – Fenster öffnen für Details".into(),
        ServerState::Stopped => "Angehalten".into(),
    }
}

fn update_text(app: &AppHandle) -> Option<String> {
    let status = app.state::<Updates>().status();
    (status.state == UpdateState::Available)
        .then(|| format!("Version {} verfügbar …", status.version.unwrap_or_default()))
}

fn menu<R: Runtime>(app: &AppHandle<R>, status: &str, update: Option<&str>) -> tauri::Result<Menu<R>> {
    let open = MenuItem::with_id(app, "open", "Arbeitsblatt-Assistent öffnen", true, None::<&str>)?;
    let state = MenuItem::with_id(app, "status", status, false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(app, &[&open, &sep()?, &state])?;
    if let Some(text) = update {
        menu.append(&MenuItem::with_id(app, "update", text, true, None::<&str>)?)?;
    }
    menu.append_items(&[&sep()?, &quit])?;
    Ok(menu)
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Arbeitsblatt-Assistent")
        .menu(&menu(app, &status_text(app), None)?)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" | "update" => crate::show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Windows/Linux: a left click opens the window, the right click shows the menu.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        });
    #[cfg(target_os = "macos")]
    let builder = builder
        .icon(tauri::image::Image::from_bytes(include_bytes!(
            "../icons/tray-template.png"
        ))?)
        .icon_as_template(true);
    #[cfg(not(target_os = "macos"))]
    let builder = {
        let builder = builder.show_menu_on_left_click(false);
        match app.default_window_icon() {
            Some(icon) => builder.icon(icon.clone()),
            None => builder,
        }
    };
    builder.build(app)?;
    Ok(())
}

/// Rebuild the menu after a change of the server or update status (menu items cannot be hidden).
pub fn refresh(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let status = status_text(app);
    let update = update_text(app);
    if let Ok(menu) = menu(app, &status, update.as_deref()) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_tooltip(Some(format!("Arbeitsblatt-Assistent – {status}")));
}
