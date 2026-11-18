//! The local server: the companion program (`worksheet-assistant`, a Node.js single executable shipped next to
//! this app) runs as a hidden child process in "app mode".
//!
//! Contract with the companion (proxy/src/companion/main.ts):
//! - started as `worksheet-assistant --app` with `WORKSHEET_ASSISTANT_UI_SECRET` (secret for /companion/api/*)
//!   and `WORKSHEET_ASSISTANT_APP` (this app's executable, used for autostart and Claude Desktop's MCP entry);
//! - stdout carries one JSON event per line: `ready` (with the URL), `error` (with a code), `quit`;
//! - it stops when its stdin is closed, so it never outlives this app;
//! - exit codes: 3 = another companion is running, 4 = the port is used by another program.

use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Restarts after a crash within this window; more than `MAX_RESTARTS` and we give up and show the error.
const RESTART_WINDOW: Duration = Duration::from_secs(120);
const MAX_RESTARTS: usize = 4;

#[derive(Clone, Copy, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServerState {
    Starting,
    Running,
    Error,
    Stopped,
}

#[derive(Clone, Serialize, Debug)]
pub struct ServerStatus {
    pub state: ServerState,
    pub url: Option<String>,
    pub version: Option<String>,
    /// `already_running`, `port_in_use`, `failed`, `crashed` or `missing` when `state` is `error`.
    pub code: Option<String>,
    pub message: Option<String>,
    /// The server runs, but the AI chat is off (e.g. a provider without API key).
    pub chat_error: Option<String>,
}

impl ServerStatus {
    fn new(state: ServerState) -> Self {
        Self {
            state,
            url: None,
            version: None,
            code: None,
            message: None,
            chat_error: None,
        }
    }

    fn error(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: Some(code.into()),
            message: Some(message.into()),
            ..Self::new(ServerState::Error)
        }
    }
}

/// One line on the companion's stdout.
#[derive(Deserialize, Debug, PartialEq)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    Ready {
        url: String,
        #[serde(default)]
        version: String,
        #[serde(default)]
        chat_error: String,
    },
    Error {
        code: String,
        #[serde(default)]
        message: String,
    },
    Quit,
}

pub fn parse_event(line: &str) -> Option<Event> {
    serde_json::from_str(line.trim()).ok()
}

/// What an exit means, from the exit code and the last error event.
pub fn exit_status(code: Option<i32>, last_error: Option<&(String, String)>) -> ServerStatus {
    if let Some((code, message)) = last_error {
        return ServerStatus::error(code, message.clone());
    }
    match code {
        Some(3) => ServerStatus::error(
            "already_running",
            "Ein anderer Arbeitsblatt-Assistent läuft bereits (ältere Version im Terminal oder Autostart). Bitte beenden und erneut versuchen.",
        ),
        Some(4) => ServerStatus::error("port_in_use", "Der Port des Servers wird von einem anderen Programm benutzt."),
        _ => ServerStatus::error("crashed", format!("Der Server wurde unerwartet beendet (Code {}).", code.map_or("?".into(), |c| c.to_string()))),
    }
}

struct Inner {
    status: ServerStatus,
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    /// Incremented for every start; threads of an older process ignore themselves.
    generation: u64,
    stopping: bool,
    restarts: Vec<Instant>,
}

pub struct Sidecar {
    inner: Mutex<Inner>,
    secret: String,
}

/// The companion executable next to this app's executable (Tauri puts `externalBin` there).
pub fn sidecar_path() -> PathBuf {
    if let Some(p) = std::env::var_os("WORKSHEET_ASSISTANT_SIDECAR") {
        return PathBuf::from(p);
    }
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().map(Path::to_path_buf).unwrap_or_default();
    dir.join(format!("worksheet-assistant{}", std::env::consts::EXE_SUFFIX))
}

/// The command that starts this app: the AppImage file itself on Linux (its mount point changes every start),
/// otherwise this executable.
pub fn app_launch_path() -> PathBuf {
    #[cfg(target_os = "linux")]
    if let Some(p) = std::env::var_os("APPIMAGE") {
        return PathBuf::from(p);
    }
    std::env::current_exe().unwrap_or_default()
}

fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    let _ = cmd;
}

/// `worksheet-assistant-app mcp-stdio`: Claude Desktop starts this app as an MCP server. Run the companion's
/// `mcp-stdio` with our stdin/stdout and return its exit code (no window, no tray).
pub fn run_passthrough(args: &[OsString]) -> i32 {
    let mut cmd = Command::new(sidecar_path());
    cmd.args(args)
        .env("WORKSHEET_ASSISTANT_APP", app_launch_path())
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    hide_console(&mut cmd);
    match cmd.status() {
        Ok(s) => s.code().unwrap_or(1),
        Err(err) => {
            eprintln!("worksheet-assistant: cannot start {}: {err}", sidecar_path().display());
            1
        }
    }
}

fn random_secret() -> String {
    let bytes: [u8; 24] = rand::random();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                status: ServerStatus::new(ServerState::Stopped),
                child: None,
                stdin: None,
                generation: 0,
                stopping: false,
                restarts: Vec::new(),
            }),
            secret: random_secret(),
        }
    }

    pub fn secret(&self) -> &str {
        &self.secret
    }

    pub fn status(&self) -> ServerStatus {
        self.inner.lock().unwrap().status.clone()
    }

    /// The server's URL while it runs.
    pub fn url(&self) -> Option<String> {
        let inner = self.inner.lock().unwrap();
        (inner.status.state == ServerState::Running)
            .then(|| inner.status.url.clone())
            .flatten()
    }

    fn set_status(&self, app: &AppHandle, status: ServerStatus) {
        self.inner.lock().unwrap().status = status.clone();
        crate::tray::refresh(app);
        let _ = app.emit("server-status", status);
    }

    /// Start the companion (no-op while one is running).
    pub fn start(&self, app: &AppHandle) {
        let mut inner = self.inner.lock().unwrap();
        if inner.child.is_some() {
            return;
        }
        inner.stopping = false;
        inner.generation += 1;
        let generation = inner.generation;
        let path = sidecar_path();
        if !path.exists() {
            drop(inner);
            self.set_status(
                app,
                ServerStatus::error("missing", format!("Das Server-Programm fehlt: {}", path.display())),
            );
            return;
        }
        let mut cmd = Command::new(&path);
        cmd.arg("--app")
            .env("WORKSHEET_ASSISTANT_UI_SECRET", &self.secret)
            .env("WORKSHEET_ASSISTANT_APP", app_launch_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hide_console(&mut cmd);
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(err) => {
                drop(inner);
                self.set_status(
                    app,
                    ServerStatus::error("failed", format!("Der Server konnte nicht gestartet werden: {err}")),
                );
                return;
            }
        };
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        inner.stdin = child.stdin.take();
        inner.child = Some(child);
        inner.status = ServerStatus::new(ServerState::Starting);
        let status = inner.status.clone();
        drop(inner);
        crate::tray::refresh(app);
        let _ = app.emit("server-status", status);

        if let Some(stderr) = stderr {
            let log = log_file(app);
            thread::spawn(move || {
                let mut log = log;
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    if let Some(f) = log.as_mut() {
                        let _ = writeln!(f, "{line}");
                    }
                }
            });
        }
        if let Some(stdout) = stdout {
            let app = app.clone();
            thread::spawn(move || {
                let sidecar = app.state::<Sidecar>();
                let mut last_error: Option<(String, String)> = None;
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    match parse_event(&line) {
                        Some(Event::Ready {
                            url,
                            version,
                            chat_error,
                        }) => {
                            let status = ServerStatus {
                                url: Some(url),
                                version: (!version.is_empty()).then_some(version),
                                chat_error: (!chat_error.is_empty()).then_some(chat_error),
                                ..ServerStatus::new(ServerState::Running)
                            };
                            if sidecar.is_current(generation) {
                                sidecar.set_status(&app, status);
                            }
                        }
                        Some(Event::Error { code, message }) => last_error = Some((code, message)),
                        Some(Event::Quit) => {
                            // "Programm beenden" on the companion's own settings page: quit the whole app.
                            app.exit(0);
                        }
                        None => {}
                    }
                }
                // stdout closed: the process ended (or is about to).
                sidecar.on_exit(&app, generation, last_error);
            });
        }
    }

    fn is_current(&self, generation: u64) -> bool {
        self.inner.lock().unwrap().generation == generation
    }

    fn on_exit(&self, app: &AppHandle, generation: u64, last_error: Option<(String, String)>) {
        let mut inner = self.inner.lock().unwrap();
        if inner.generation != generation {
            return;
        }
        let code = inner
            .child
            .take()
            .map(|mut c| wait_or_kill(&mut c, Duration::from_secs(3)));
        inner.stdin = None;
        if inner.stopping {
            inner.status = ServerStatus::new(ServerState::Stopped);
            let status = inner.status.clone();
            drop(inner);
            crate::tray::refresh(app);
            let _ = app.emit("server-status", status);
            return;
        }
        let status = exit_status(code.flatten(), last_error.as_ref());
        let crashed = status.code.as_deref() == Some("crashed");
        let now = Instant::now();
        inner.restarts.retain(|t| now.duration_since(*t) < RESTART_WINDOW);
        let retry = crashed && inner.restarts.len() < MAX_RESTARTS;
        if retry {
            inner.restarts.push(now);
        }
        let attempt = inner.restarts.len() as u64;
        drop(inner);
        if retry {
            self.set_status(app, ServerStatus::new(ServerState::Starting));
            let app = app.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(attempt));
                let sidecar = app.state::<Sidecar>();
                if sidecar.is_current(generation) && !sidecar.inner.lock().unwrap().stopping {
                    sidecar.start(&app);
                }
            });
        } else {
            self.set_status(app, status);
        }
    }

    /// Stop the companion: close its stdin (it then shuts down cleanly), kill it if it does not exit in time.
    pub fn stop(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.stopping = true;
        inner.stdin = None;
        if let Some(mut child) = inner.child.take() {
            wait_or_kill(&mut child, Duration::from_secs(4));
        }
        inner.status = ServerStatus::new(ServerState::Stopped);
    }

    /// Start again (button "Erneut versuchen" after an error).
    pub fn restart(&self, app: &AppHandle) {
        self.stop();
        self.inner.lock().unwrap().restarts.clear();
        self.start(app);
    }
}

fn wait_or_kill(child: &mut Child, timeout: Duration) -> Option<i32> {
    let until = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return status.code(),
            Ok(None) if Instant::now() < until => thread::sleep(Duration::from_millis(50)),
            _ => {
                let _ = child.kill();
                return child.wait().ok().and_then(|s| s.code());
            }
        }
    }
}

/// The companion's diagnostics (stderr) go to `server.log` in the app's log folder; it is started anew when it
/// grew larger than 2 MB.
fn log_file(app: &AppHandle) -> Option<File> {
    let dir = app.path().app_log_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    let path = dir.join("server.log");
    let too_big = std::fs::metadata(&path)
        .map(|m| m.len() > 2 * 1024 * 1024)
        .unwrap_or(false);
    OpenOptions::new()
        .create(true)
        .append(!too_big)
        .write(true)
        .truncate(too_big)
        .open(path)
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_events() {
        assert_eq!(
            parse_event(r#"{"event":"ready","url":"http://127.0.0.1:8787","version":"0.6.0","chat_error":""}"#),
            Some(Event::Ready {
                url: "http://127.0.0.1:8787".into(),
                version: "0.6.0".into(),
                chat_error: String::new()
            })
        );
        assert_eq!(
            parse_event(r#"{"event":"error","code":"port_in_use","message":"belegt"}"#),
            Some(Event::Error {
                code: "port_in_use".into(),
                message: "belegt".into()
            })
        );
        assert_eq!(parse_event(r#"{"event":"quit"}"#), Some(Event::Quit));
        assert_eq!(parse_event("Arbeitsblatt-Assistent läuft"), None);
        assert_eq!(parse_event(r#"{"event":"unknown"}"#), None);
    }

    #[test]
    fn maps_exit_codes() {
        assert_eq!(exit_status(Some(3), None).code.as_deref(), Some("already_running"));
        assert_eq!(exit_status(Some(4), None).code.as_deref(), Some("port_in_use"));
        assert_eq!(exit_status(Some(1), None).code.as_deref(), Some("crashed"));
        assert_eq!(exit_status(None, None).code.as_deref(), Some("crashed"));
        // the error event wins over the exit code
        let e = ("failed".to_string(), "kaputt".to_string());
        let s = exit_status(Some(1), Some(&e));
        assert_eq!(
            (s.code.as_deref(), s.message.as_deref()),
            (Some("failed"), Some("kaputt"))
        );
        assert_eq!(s.state, ServerState::Error);
    }

    #[test]
    fn secret_is_random_hex() {
        let a = random_secret();
        assert_eq!(a.len(), 48);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, random_secret());
    }
}
