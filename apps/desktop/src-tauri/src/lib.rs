//! Desktop app of the worksheet assistant: a window with the settings (Nuxt UI), an icon in the system tray and
//! the local server (the companion program) as a hidden child process. No terminal, no browser tab.
//!
//! Command line:
//!   worksheet-assistant-app                 open the window
//!   worksheet-assistant-app --background    start in the tray only (autostart, started by Claude Desktop)
//!   worksheet-assistant-app mcp-stdio       MCP over stdin/stdout for Claude Desktop (no window)

mod sidecar;
mod tray;
mod updates;

use serde::Serialize;
use serde_json::Value;
use sidecar::{ServerStatus, Sidecar};
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use updates::{UpdateStatus, Updates};

pub fn show_main_window(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://127.0.0.1")) {
        return Err("Nur Webadressen können geöffnet werden.".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn server_status(sidecar: State<Sidecar>) -> ServerStatus {
    sidecar.status()
}

#[tauri::command]
fn restart_server(app: AppHandle) {
    std::thread::spawn(move || app.state::<Sidecar>().restart(&app));
}

/// The companion's settings API (`/companion/api/<path>`), called from Rust: the secret stays here and the
/// webview needs no network access.
#[tauri::command]
async fn api(sidecar: State<'_, Sidecar>, method: String, path: String, body: Option<Value>) -> Result<Value, String> {
    if path.is_empty()
        || !path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '/' || c == '-' || c == '_')
    {
        return Err("Ungültiger Pfad.".into());
    }
    let Some(base) = sidecar.url() else {
        return Err("Der Server läuft gerade nicht.".into());
    };
    let url = format!("{base}/companion/api/{path}");
    let secret = sidecar.secret().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(60)))
            .http_status_as_error(false)
            // Never through an HTTP proxy from the environment (school or company networks): the server is local,
            // and the secret must not travel to a proxy.
            .proxy(None)
            .build()
            .into();
        let response = match method.as_str() {
            "GET" => agent.get(&url).header("x-companion-secret", &secret).call(),
            "POST" => agent
                .post(&url)
                .header("x-companion-secret", &secret)
                .send_json(body.unwrap_or(Value::Object(Default::default()))),
            _ => return Err("Ungültige Methode.".into()),
        };
        let mut response = response.map_err(|e| format!("Der Server antwortet nicht: {e}"))?;
        let status = response.status();
        let data: Value = response.body_mut().read_json().unwrap_or(Value::Null);
        if status.is_success() {
            Ok(data)
        } else {
            Err(data
                .get("error")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("HTTP {}", status.as_u16())))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn update_status(updates: State<Updates>) -> UpdateStatus {
    updates.status()
}

#[tauri::command]
async fn check_updates(app: AppHandle) -> UpdateStatus {
    updates::check(&app, true).await.0
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    updates::install(&app).await
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    open_url(&app, &url)
}

/// Open a folder (e.g. the settings folder) in the file manager.
#[tauri::command]
fn open_folder(app: AppHandle, path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).is_dir() {
        return Err("Der Ordner existiert nicht.".into());
    }
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct AppInfo {
    version: String,
    platform: &'static str,
    self_update: bool,
    log_dir: Option<String>,
    /// Icon in the tray / menu bar: closing the window keeps the app running there (otherwise it is minimized).
    tray: bool,
    /// Started from a temporary place (macOS: the disk image): it must be moved to Programme first.
    temporary: bool,
}

#[tauri::command]
fn app_info(app: AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        self_update: updates::self_update_supported(),
        log_dir: app.path().app_log_dir().ok().map(|p| p.display().to_string()),
        tray: app.tray_by_id(tray::TRAY_ID).is_some(),
        temporary: sidecar::is_temporary_location(&sidecar::app_launch_path()),
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    let args: Vec<std::ffi::OsString> = std::env::args_os().collect();
    if args.get(1).is_some_and(|a| a == "mcp-stdio") {
        std::process::exit(sidecar::run_passthrough(&args[1..]));
    }
    let background = args.iter().any(|a| a == "--background");

    let mut builder = tauri::Builder::default()
        // A second start shows the window of the running app (but not when Claude Desktop or the autostart
        // only make sure the app runs).
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if !argv.iter().any(|a| a == "--background") {
                show_main_window(app);
            }
        }))
        .plugin(tauri_plugin_opener::init());
    let context = tauri::generate_context!();
    // Self-updates only in builds with an updater key (release builds with the signing secrets).
    if updates::has_updater_key(context.config()) {
        updates::set_updater_enabled(true);
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    let app = builder
        .setup(move |app| {
            let handle = app.handle().clone();
            app.manage(Sidecar::new());
            app.manage(Updates::new(app.package_info().version.to_string()));
            // Without a tray (e.g. GNOME without the AppIndicator extension) the window is the only way in.
            if !tray::host_available() {
                eprintln!("worksheet-assistant: no tray on this desktop, the window is minimized instead of hidden");
            } else if let Err(err) = tray::create(&handle) {
                eprintln!("worksheet-assistant: no tray icon: {err}");
            }
            #[cfg(target_os = "macos")]
            if background {
                let _ = handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            if !background {
                show_main_window(&handle);
            }
            let starter = handle.clone();
            std::thread::spawn(move || starter.state::<Sidecar>().start(&starter));
            updates::schedule(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps the app (and the server for the plugin and Claude) running: hidden in the tray,
            // or minimized where there is no tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                api.prevent_close();
                if app.tray_by_id(tray::TRAY_ID).is_some() {
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                } else {
                    let _ = window.minimize();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            server_status,
            restart_server,
            api,
            update_status,
            check_updates,
            install_update,
            open_external,
            open_folder,
            app_info,
            quit_app
        ])
        .build(context)
        .expect("error while building the app");

    app.run(|app, event| match event {
        RunEvent::Exit => app.state::<Sidecar>().stop(),
        // The app only ends through "Beenden" (an exit with a code), never because its window went away.
        RunEvent::ExitRequested { code: None, api, .. } => api.prevent_exit(),
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show_main_window(app),
        _ => {}
    });
}
