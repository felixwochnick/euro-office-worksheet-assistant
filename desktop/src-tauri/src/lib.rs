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
    updates::check(&app).await
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
}

#[tauri::command]
fn app_info(app: AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        self_update: updates::self_update_supported(),
        log_dir: app.path().app_log_dir().ok().map(|p| p.display().to_string()),
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
            if let Err(err) = tray::create(&handle) {
                // Without a tray (e.g. GNOME without AppIndicator extension) the window is the only way in.
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
            // Closing the window keeps the app (and the server) running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if app.tray_by_id(tray::TRAY_ID).is_some() {
                    api.prevent_close();
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
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
        // Without a tray, closing the window ends the app.
        RunEvent::ExitRequested { code: None, api, .. } if app.tray_by_id(tray::TRAY_ID).is_some() => {
            api.prevent_exit()
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show_main_window(app),
        _ => {}
    });
}
