//! Update check against the GitHub releases.
//!
//! With an updater key in the configuration (`plugins.updater.pubkey`, set at build time by
//! scripts/build-desktop.mjs from `WORKSHEET_ASSISTANT_UPDATER_PUBKEY`, see the release workflow) the Tauri updater
//! downloads the signed update from the release's `latest.json`, installs it and restarts the
//! app. Without one, and for installations that cannot replace themselves (Linux .deb), the app only reads the
//! latest release from the GitHub API and offers its download page.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const REPO: &str = "felixwochnick/euro-office-worksheet-assistant";
/// First check shortly after the start, then every six hours.
const FIRST_CHECK: Duration = Duration::from_secs(20);
const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

static UPDATER_ENABLED: AtomicBool = AtomicBool::new(false);

/// Does this build's configuration carry an updater key? (Then the updater plugin is registered.)
pub fn has_updater_key(config: &tauri::Config) -> bool {
    config
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("pubkey"))
        .and_then(|k| k.as_str())
        .is_some_and(|k| !k.trim().is_empty())
}

pub fn set_updater_enabled(enabled: bool) {
    UPDATER_ENABLED.store(enabled, Ordering::Relaxed);
}

#[derive(Clone, Copy, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateState {
    Idle,
    Checking,
    None,
    Available,
    Downloading,
    Error,
}

#[derive(Clone, Serialize, Debug)]
pub struct UpdateStatus {
    pub state: UpdateState,
    pub current: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    /// Only a download page: this installation cannot replace itself.
    pub manual: bool,
    /// Release page of the new version.
    pub url: Option<String>,
    /// Download progress 0…1 (when the size is known).
    pub progress: Option<f64>,
    pub message: Option<String>,
    /// Unix time of the last finished check.
    pub checked_at: Option<u64>,
}

pub struct Updates {
    status: Mutex<UpdateStatus>,
    pending: Mutex<Option<Update>>,
}

impl Updates {
    pub fn new(current: String) -> Self {
        Self {
            status: Mutex::new(UpdateStatus {
                state: UpdateState::Idle,
                current,
                version: None,
                notes: None,
                manual: false,
                url: None,
                progress: None,
                message: None,
                checked_at: None,
            }),
            pending: Mutex::new(None),
        }
    }

    pub fn status(&self) -> UpdateStatus {
        self.status.lock().unwrap().clone()
    }

    fn update(&self, app: &AppHandle, f: impl FnOnce(&mut UpdateStatus)) {
        let (status, changed) = {
            let mut s = self.status.lock().unwrap();
            let before = (s.state, s.version.clone());
            f(&mut s);
            (s.clone(), before != (s.state, s.version.clone()))
        };
        // The tray menu only shows the state and version (not the download progress).
        if changed {
            crate::tray::refresh(app);
        }
        let _ = app.emit("update-status", status);
    }
}

/// Can this installation install updates itself? Needs the updater key; on Linux only the AppImage can be
/// replaced (a .deb belongs to the package manager).
pub fn self_update_supported() -> bool {
    if !UPDATER_ENABLED.load(Ordering::Relaxed) {
        return false;
    }
    if cfg!(target_os = "linux") {
        return std::env::var_os("APPIMAGE").is_some();
    }
    true
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn release_page(version: &str) -> String {
    format!("https://github.com/{REPO}/releases/tag/v{version}")
}

/// Is `remote` (a tag like "v0.6.1" or "0.6.1") newer than `current`?
pub fn is_newer(remote: &str, current: &str) -> bool {
    let parse = |v: &str| semver::Version::parse(v.trim().trim_start_matches('v')).ok();
    match (parse(remote), parse(current)) {
        (Some(r), Some(c)) => r > c,
        _ => false,
    }
}

/// A newer version found by a check.
struct Found {
    version: String,
    notes: Option<String>,
    manual: bool,
    url: String,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    body: Option<String>,
}

fn latest_github_release() -> Result<GithubRelease, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .build()
        .into();
    agent
        .get(&format!("https://api.github.com/repos/{REPO}/releases/latest"))
        .header("User-Agent", "worksheet-assistant-app")
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_json::<GithubRelease>()
        .map_err(|e| e.to_string())
}

/// Check for a newer version and publish the result (event `update-status`, tray menu).
pub async fn check(app: &AppHandle) -> UpdateStatus {
    let updates = app.state::<Updates>();
    if matches!(updates.status().state, UpdateState::Checking | UpdateState::Downloading) {
        return updates.status();
    }
    updates.update(app, |s| {
        s.state = UpdateState::Checking;
        s.message = None;
    });
    let current = app.package_info().version.to_string();

    let result: Result<Option<Found>, String> = if self_update_supported() {
        match app.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    let found = Found {
                        version: update.version.clone(),
                        notes: update.body.clone(),
                        manual: false,
                        url: release_page(&update.version),
                    };
                    *updates.pending.lock().unwrap() = Some(update);
                    Ok(Some(found))
                }
                Ok(None) => Ok(None),
                Err(err) => Err(err.to_string()),
            },
            Err(err) => Err(err.to_string()),
        }
    } else {
        let current = current.clone();
        tauri::async_runtime::spawn_blocking(move || {
            latest_github_release().map(|r| {
                is_newer(&r.tag_name, &current).then(|| Found {
                    version: r.tag_name.trim_start_matches('v').to_string(),
                    notes: r.body,
                    manual: true,
                    url: r.html_url,
                })
            })
        })
        .await
        .unwrap_or_else(|e| Err(e.to_string()))
    };

    updates.update(app, |s| {
        s.checked_at = Some(now());
        s.progress = None;
        match result {
            Ok(Some(found)) => {
                s.state = UpdateState::Available;
                s.version = Some(found.version);
                s.notes = found.notes.filter(|n| !n.trim().is_empty());
                s.manual = found.manual;
                s.url = Some(found.url);
            }
            Ok(None) => {
                s.state = UpdateState::None;
                s.version = None;
                s.notes = None;
                s.url = None;
            }
            Err(err) => {
                s.state = UpdateState::Error;
                s.message = Some(format!("Keine Verbindung zum Update-Server: {err}"));
            }
        }
    });
    updates.status()
}

/// Install the available update: stop the server, download, install, restart. For a manual update open the
/// download page instead.
pub async fn install(app: &AppHandle) -> Result<(), String> {
    let updates = app.state::<Updates>();
    let status = updates.status();
    if status.state != UpdateState::Available {
        return Err("Es ist kein Update verfügbar.".into());
    }
    if status.manual {
        let url = status
            .url
            .unwrap_or_else(|| format!("https://github.com/{REPO}/releases/latest"));
        return crate::open_url(app, &url);
    }
    let Some(update) = updates.pending.lock().unwrap().take() else {
        return Err("Das Update ist nicht mehr verfügbar – bitte erneut suchen.".into());
    };
    updates.update(app, |s| {
        s.state = UpdateState::Downloading;
        s.progress = Some(0.0);
        s.message = None;
    });
    // The installer replaces the server program as well; on Windows a running program cannot be replaced.
    let sidecar = app.state::<crate::sidecar::Sidecar>();
    sidecar.stop();

    let mut received: u64 = 0;
    let progress_app = app.clone();
    let result = update
        .download_and_install(
            move |chunk, total| {
                received += chunk as u64;
                if let Some(total) = total.filter(|t| *t > 0) {
                    let p = (received as f64 / total as f64).min(1.0);
                    let updates = progress_app.state::<Updates>();
                    let last = updates.status().progress.unwrap_or(0.0);
                    // Do not flood the window with events: every percent is enough.
                    if p - last >= 0.01 || p >= 1.0 {
                        updates.update(&progress_app, |s| s.progress = Some(p));
                    }
                }
            },
            || {},
        )
        .await;
    match result {
        Ok(()) => {
            // Windows: the installer has already taken over and quits the app. Elsewhere: start the new version.
            app.restart();
        }
        Err(err) => {
            sidecar.start(app);
            updates.update(app, |s| {
                s.state = UpdateState::Error;
                s.progress = None;
                s.message = Some(format!("Das Update konnte nicht installiert werden: {err}"));
            });
            Err(err.to_string())
        }
    }
}

/// Check in the background: shortly after the start, then every six hours.
pub fn schedule(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK);
        loop {
            tauri::async_runtime::block_on(check(&app));
            std::thread::sleep(INTERVAL);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer("v0.6.1", "0.6.0"));
        assert!(is_newer("0.10.0", "0.9.9"));
        assert!(!is_newer("v0.6.0", "0.6.0"));
        assert!(!is_newer("v0.5.9", "0.6.0"));
        assert!(!is_newer("nightly", "0.6.0"));
        assert!(!is_newer("v0.7.0-beta.1", "0.7.0"));
    }

    #[test]
    fn release_pages() {
        assert_eq!(
            release_page("0.6.1"),
            "https://github.com/felixwochnick/euro-office-worksheet-assistant/releases/tag/v0.6.1"
        );
    }
}
