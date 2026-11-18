//! Update check against the GitHub releases.
//!
//! With an updater key in the configuration (`plugins.updater.pubkey`, set at build time by
//! scripts/build-desktop.mjs from `WORKSHEET_ASSISTANT_UPDATER_PUBKEY`, see the release workflow) the Tauri updater
//! downloads the signed update from the release's `latest.json`, installs it and restarts the
//! app. Without one, and for installations that cannot replace themselves (Linux .deb), the app only reads the
//! latest release from the GitHub API and offers its download page.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const REPO: &str = "felixwochnick/euro-office-worksheet-assistant";
/// First check shortly after the start, then every six hours.
const FIRST_CHECK: Duration = Duration::from_secs(20);
const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const RETRY: Duration = Duration::from_secs(15 * 60);

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
/// replaced (a .deb belongs to the package manager); not from a temporary place (macOS disk image).
pub fn self_update_supported() -> bool {
    if !UPDATER_ENABLED.load(Ordering::Relaxed)
        || crate::sidecar::is_temporary_location(&crate::sidecar::app_launch_path())
    {
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

/// Tag of the latest release, from the redirect of github.com/<repo>/releases/latest (not the GitHub API: its
/// limit of 60 requests per hour and address is quickly used up by a school network behind one address).
fn latest_release_tag() -> Result<String, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .max_redirects(0)
        .http_status_as_error(false)
        .build()
        .into();
    let response = agent
        .get(&format!("https://github.com/{REPO}/releases/latest"))
        .header("User-Agent", "worksheet-assistant-app")
        .call()
        .map_err(|e| e.to_string())?;
    let location = response
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| format!("HTTP {} ohne Weiterleitung", response.status().as_u16()))?;
    tag_from_location(location).ok_or_else(|| format!("unerwartete Weiterleitung: {location}"))
}

/// ".../releases/tag/v0.6.1" → "v0.6.1"
fn tag_from_location(location: &str) -> Option<String> {
    let tag = location.split("/releases/tag/").nth(1)?.split(['?', '#']).next()?;
    (!tag.is_empty()).then(|| tag.to_string())
}

/// Check for a newer version and publish the result (event `update-status`, tray menu). A failed background check
/// (`manual == false`, e.g. no network yet after logging in) is not shown as an error; returns whether it worked.
pub async fn check(app: &AppHandle, manual: bool) -> (UpdateStatus, bool) {
    let updates = app.state::<Updates>();
    let before = updates.status();
    if matches!(before.state, UpdateState::Checking | UpdateState::Downloading) {
        return (before, true);
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
            latest_release_tag().map(|tag| {
                let version = tag.trim_start_matches('v').to_string();
                is_newer(&tag, &current).then(|| Found {
                    url: release_page(&version),
                    version,
                    notes: None,
                    manual: true,
                })
            })
        })
        .await
        .unwrap_or_else(|e| Err(e.to_string()))
    };

    let ok = result.is_ok();
    updates.update(app, |s| {
        if let (Err(_), false) = (&result, manual) {
            *s = UpdateStatus {
                message: None,
                ..before
            };
            return;
        }
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
    (updates.status(), ok)
}

/// Install the available update: download, install, restart (the server keeps running during the download). For a
/// manual update open the download page instead.
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
    let mut received: u64 = 0;
    let progress_app = app.clone();
    let downloaded = update
        .download(
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
    let result = match downloaded {
        Ok(bytes) => {
            // Windows: the installer replaces the server program too, which it cannot while it runs. Elsewhere the
            // files are replaced in place and the server stops with the restart.
            #[cfg(windows)]
            {
                let stopper = app.clone();
                let _ = tauri::async_runtime::spawn_blocking(move || stopper.state::<crate::sidecar::Sidecar>().stop())
                    .await;
            }
            update.install(bytes)
        }
        Err(err) => Err(err),
    };
    match result {
        Ok(()) => {
            // Windows: the installer has already taken over and quits the app. Elsewhere: start the new version.
            app.restart();
        }
        Err(err) => {
            app.state::<crate::sidecar::Sidecar>().start(app);
            updates.update(app, |s| {
                s.state = UpdateState::Error;
                s.progress = None;
                s.message = Some(format!("Das Update konnte nicht installiert werden: {err}"));
            });
            Err(err.to_string())
        }
    }
}

/// Check in the background: shortly after the start, then every six hours; after a failure again in 15 minutes.
pub fn schedule(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK);
        loop {
            let (_, ok) = tauri::async_runtime::block_on(check(&app, false));
            std::thread::sleep(if ok { INTERVAL } else { RETRY });
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
    fn tags_from_redirects() {
        let base = "https://github.com/felixwochnick/euro-office-worksheet-assistant/releases";
        assert_eq!(
            tag_from_location(&format!("{base}/tag/v0.6.1")).as_deref(),
            Some("v0.6.1")
        );
        assert_eq!(
            tag_from_location(&format!("{base}/tag/v0.6.1?x=1")).as_deref(),
            Some("v0.6.1")
        );
        assert_eq!(tag_from_location(base), None);
        assert_eq!(tag_from_location(&format!("{base}/tag/")), None);
    }

    #[test]
    fn release_pages() {
        assert_eq!(
            release_page("0.6.1"),
            "https://github.com/felixwochnick/euro-office-worksheet-assistant/releases/tag/v0.6.1"
        );
    }
}
