#!/usr/bin/env bash
# Install the worksheet assistant plugin into the Euro-Office container of Nextcloud AIO.
#
# The sdkjs-plugins folder inside the container is emptied whenever AIO re-creates the
# container (updates). With --watch a small systemd service re-installs the plugin
# automatically every time the container starts.
#
# Usage (on the AIO host, as root or a member of the docker group):
#
#   # latest release from GitHub
#   curl -fsSL https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main/scripts/install-aio.sh | sudo bash -s -- --watch
#
#   # or from a local build / downloaded archive
#   sudo scripts/install-aio.sh --source dist/worksheet-assistant --watch
#   sudo scripts/install-aio.sh --archive worksheet-assistant.tar.gz
#
# Options:
#   --source DIR        plugin folder (contains config.json)
#   --archive FILE      .tar.gz or .zip with the plugin folder
#   --version TAG       release to download (default: latest)
#   --container NAME    Euro-Office container (default: nextcloud-aio-eurooffice)
#   --plugin-dir PATH   plugin directory in the container
#                       (default: /var/www/euro-office/documentserver/sdkjs-plugins)
#   --watch             install a systemd service that re-installs after container restarts
#   --uninstall         remove the plugin from the container and the service
#   --print-unit        print the systemd unit that --watch would install and exit
#   --install-only      (internal) copy the stored plugin into the container and exit
set -euo pipefail

REPO="felixwochnick/euro-office-worksheet-assistant"
NAME="worksheet-assistant"
CONTAINER="${EUROOFFICE_CONTAINER:-nextcloud-aio-eurooffice}"
PLUGIN_DIR="/var/www/euro-office/documentserver/sdkjs-plugins"
STORE="/opt/eurooffice-plugins"
SERVICE="eurooffice-worksheet-assistant"
# Earlier name of the plugin (version 0.1, "Noten-Assistent"): same GUID, removed on install.
LEGACY_NAME="music-notation"
LEGACY_SERVICE="eurooffice-music-notation"
SOURCE=""
ARCHIVE=""
VERSION="latest"
MODE="install"
WATCH=0

log() { printf '%s %s\n' "==>" "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --archive) ARCHIVE="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --container) CONTAINER="$2"; shift 2 ;;
    --plugin-dir) PLUGIN_DIR="$2"; shift 2 ;;
    --store) STORE="$2"; shift 2 ;;
    --watch) WATCH=1; shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    --install-only) MODE="install-only"; shift ;;
    --print-unit) MODE="print-unit"; shift ;;
    -h|--help) grep '^#' "${BASH_SOURCE[0]}" 2>/dev/null | sed -n '2,33p' || echo "see https://github.com/$REPO"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

# systemd unit of the --watch service: re-installs the plugin whenever the container starts.
unit_text() {
  local script="$1"
  cat <<UNIT
[Unit]
Description=Re-install the Euro-Office worksheet assistant plugin after '$CONTAINER' starts (Nextcloud AIO updates)
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStartPre=-$script --install-only --container $CONTAINER --plugin-dir $PLUGIN_DIR --store $STORE
ExecStart=/bin/sh -c 'docker events --filter container=$CONTAINER --filter event=start --format "{{.Actor.Attributes.name}}" | while read -r name; do sleep 15; $script --install-only --container $CONTAINER --plugin-dir $PLUGIN_DIR --store $STORE || true; done'

[Install]
WantedBy=multi-user.target
UNIT
}

if [[ "$MODE" == "print-unit" ]]; then
  unit_text "$STORE/install-aio.sh"
  exit 0
fi

command -v docker >/dev/null || die "docker not found"
docker info >/dev/null 2>&1 || die "cannot talk to Docker – run as root or as a member of the docker group"

container_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" == "true" ]]
}

# Copy $STORE/$NAME into the container (replacing an older version).
copy_into_container() {
  local src="$STORE/$NAME"
  [[ -f "$src/config.json" ]] || die "no plugin in $src"
  container_running || die "container '$CONTAINER' is not running (docker ps)"
  docker exec -u root "$CONTAINER" test -d "$PLUGIN_DIR" \
    || die "plugin directory $PLUGIN_DIR not found in '$CONTAINER' – set --plugin-dir"
  docker exec -u root "$CONTAINER" sh -c "rm -rf '$PLUGIN_DIR/$NAME' '$PLUGIN_DIR/$LEGACY_NAME' && mkdir -p '$PLUGIN_DIR/$NAME'"
  docker cp "$src/." "$CONTAINER:$PLUGIN_DIR/$NAME/" >/dev/null
  docker exec -u root "$CONTAINER" chmod -R a+rX "$PLUGIN_DIR/$NAME"
  log "plugin copied to $CONTAINER:$PLUGIN_DIR/$NAME"
}

verify() {
  docker exec "$CONTAINER" test -f "$PLUGIN_DIR/$NAME/config.json" || die "verification failed: config.json missing in the container"
  # The Document Server lists the plugin folders on every editor start (/plugins.json).
  local list
  list="$(docker exec "$CONTAINER" sh -c 'curl -fsS --max-time 5 http://localhost/plugins.json 2>/dev/null || wget -qO- -T 5 http://localhost/plugins.json 2>/dev/null' || true)"
  if [[ "$list" == *"$NAME/config.json"* ]]; then
    log "the Document Server lists the plugin – reload the editor (close and reopen the document)"
  else
    log "plugin files are in place (could not query /plugins.json inside the container) – reload the editor"
  fi
}

fetch_release() {
  local tmp base file
  tmp="$(mktemp -d)"
  if [[ "$VERSION" == "latest" ]]; then
    base="https://github.com/$REPO/releases/latest/download"
  else
    base="https://github.com/$REPO/releases/download/$VERSION"
  fi
  # Releases up to 0.1.0 used the archive name music-notation.tar.gz.
  for file in "$NAME.tar.gz" "$LEGACY_NAME.tar.gz"; do
    log "downloading $base/$file"
    if curl -fsSL "$base/$file" -o "$tmp/$file"; then
      ARCHIVE="$tmp/$file"
      return 0
    fi
  done
  die "download failed – is there a release? (or use --source/--archive)"
}

# Put the plugin into $STORE/$NAME (the copy the watcher re-installs from).
stage() {
  local tmp
  tmp="$(mktemp -d)"
  if [[ -n "$SOURCE" ]]; then
    [[ -f "$SOURCE/config.json" ]] || die "$SOURCE does not contain config.json"
    cp -R "$SOURCE/." "$tmp/"
  else
    [[ -n "$ARCHIVE" ]] || fetch_release
    case "$ARCHIVE" in
      *.zip) command -v unzip >/dev/null || die "unzip not found (use the .tar.gz)"; unzip -q "$ARCHIVE" -d "$tmp" ;;
      *) tar -xzf "$ARCHIVE" -C "$tmp" ;;
    esac
    # archives contain either the files directly or a worksheet-assistant/ (before 0.2: music-notation/) folder
    local dir
    for dir in "$NAME" "$LEGACY_NAME"; do
      if [[ ! -f "$tmp/config.json" && -f "$tmp/$dir/config.json" ]]; then
        local inner="$tmp/$dir"; tmp="$(mktemp -d)"; cp -R "$inner/." "$tmp/"
      fi
    done
    [[ -f "$tmp/config.json" ]] || die "archive does not contain the plugin (config.json)"
  fi
  mkdir -p "$STORE"
  rm -rf "$STORE/$NAME"
  mkdir -p "$STORE/$NAME"
  cp -R "$tmp/." "$STORE/$NAME/"
  log "plugin stored in $STORE/$NAME ($(grep -o '"version": *"[^"]*"' "$STORE/$NAME/config.json" | head -1))"
}

remove_legacy_service() {
  if command -v systemctl >/dev/null && [[ -f "/etc/systemd/system/$LEGACY_SERVICE.service" ]]; then
    systemctl disable --now "$LEGACY_SERVICE.service" >/dev/null 2>&1 || true
    rm -f "/etc/systemd/system/$LEGACY_SERVICE.service"
    systemctl daemon-reload
    log "old service $LEGACY_SERVICE removed"
  fi
  rm -rf "${STORE:?}/$LEGACY_NAME"
}

install_service() {
  command -v systemctl >/dev/null || die "systemd not found – cannot install the watcher (install again manually after AIO updates)"
  remove_legacy_service
  local script="$STORE/install-aio.sh"
  cp "$0" "$script" 2>/dev/null || curl -fsSL "https://raw.githubusercontent.com/$REPO/main/scripts/install-aio.sh" -o "$script"
  chmod 755 "$script"
  unit_text "$script" > "/etc/systemd/system/$SERVICE.service"
  systemctl daemon-reload
  systemctl enable --now "$SERVICE.service" >/dev/null
  log "service $SERVICE enabled – the plugin is re-installed whenever '$CONTAINER' starts"
}

case "$MODE" in
  install-only)
    copy_into_container
    exit 0
    ;;
  uninstall)
    if command -v systemctl >/dev/null && [[ -f "/etc/systemd/system/$SERVICE.service" ]]; then
      systemctl disable --now "$SERVICE.service" >/dev/null 2>&1 || true
      rm -f "/etc/systemd/system/$SERVICE.service"
      systemctl daemon-reload
      log "service removed"
    fi
    remove_legacy_service
    if container_running; then
      docker exec -u root "$CONTAINER" rm -rf "$PLUGIN_DIR/$NAME" "$PLUGIN_DIR/$LEGACY_NAME"
      log "plugin removed from $CONTAINER"
    fi
    rm -rf "${STORE:?}/$NAME"
    exit 0
    ;;
esac

stage
copy_into_container
verify
if [[ "$WATCH" == 1 ]]; then
  install_service
else
  log "note: AIO updates re-create the container and remove the plugin – use --watch to re-install automatically"
fi
