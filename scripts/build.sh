#!/usr/bin/env bash
# Build the Euro-Office plugin: apps/plugin/src + the shared modules (packages/shared) + vendor/.
#
#   scripts/build.sh                  build dist/worksheet-assistant/ and dist/worksheet-assistant.plugin
#   scripts/build.sh --update-vendor  re-download abcjs, qrcode-generator, dagre and the ONLYOFFICE v1 SDK files
#                                     into vendor/ (versions below), rebuild the three.js subset
#                                     (scripts/build-three.mjs, version from the root package.json), then build
#
# Output:
#   dist/worksheet-assistant/          plugin folder – copy into .../documentserver/sdkjs-plugins/
#   dist/worksheet-assistant.plugin    ZIP with config.json at the root (for plugin managers)
#   dist/worksheet-assistant.tar.gz    archive with the worksheet-assistant/ folder (scripts/install-aio.sh --archive)
#   dist/worksheet-assistant.zip       the same as ZIP
#
# PLUGIN_VERSION=1.2.3 sets the version in config.json (used by the release workflow).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="worksheet-assistant"
OUT="$ROOT/dist/$NAME"
SRC="$ROOT/apps/plugin/src"
SHARED="$ROOT/packages/shared"
VENDOR="$ROOT/vendor"

ABCJS_VERSION="${ABCJS_VERSION:-6.7.2}"
QRCODE_VERSION="${QRCODE_VERSION:-2.0.4}"
# Keep in sync with "@dagrejs/dagre" in packages/shared/package.json (Node uses the npm package; a unit test compares them).
DAGRE_VERSION="${DAGRE_VERSION:-3.1.2}"
# Pinned commit of https://github.com/ONLYOFFICE/onlyoffice.github.io (sdkjs-plugins/v1)
ONLYOFFICE_REF="${ONLYOFFICE_REF:-94927418d89373a647b99100a40cc57d08da44e2}"

update_vendor() {
  echo "==> Downloading vendor files"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  mkdir -p "$VENDOR/onlyoffice" "$VENDOR/abcjs" "$VENDOR/qrcode-generator" "$VENDOR/dagre"
  local base="https://raw.githubusercontent.com/ONLYOFFICE/onlyoffice.github.io/$ONLYOFFICE_REF"
  curl -fsSL -o "$VENDOR/onlyoffice/plugins.js" "$base/sdkjs-plugins/v1/plugins.js"
  curl -fsSL -o "$VENDOR/onlyoffice/plugins-ui.js" "$base/sdkjs-plugins/v1/plugins-ui.js"
  curl -fsSL -o "$VENDOR/onlyoffice/LICENSE" "$base/LICENSE"
  curl -fsSL "$(pnpm view "abcjs@$ABCJS_VERSION" dist.tarball)" | tar xz -C "$tmp"
  cp "$tmp/package/dist/abcjs-basic-min.js" "$tmp/package/dist/abcjs-basic-min.js.LICENSE" "$tmp/package/LICENSE.md" "$VENDOR/abcjs/"
  # qrcode-generator: the npm package ships no LICENSE file – take it from the
  # GitHub repository at the commit the npm release was built from (gitHead).
  mkdir -p "$tmp/qrcode"
  curl -fsSL "$(pnpm view "qrcode-generator@$QRCODE_VERSION" dist.tarball)" | tar xz -C "$tmp/qrcode"
  cp "$tmp/qrcode/package/dist/qrcode.js" "$VENDOR/qrcode-generator/qrcode.js"
  local qrcode_ref
  qrcode_ref="$(pnpm view "qrcode-generator@$QRCODE_VERSION" gitHead)"
  curl -fsSL -o "$VENDOR/qrcode-generator/LICENSE" \
    "https://raw.githubusercontent.com/kazuhikoarase/qrcode-generator/$qrcode_ref/LICENSE"
  # dagre: the browser build (graphlib bundled in, global "dagre")
  mkdir -p "$tmp/dagre"
  curl -fsSL "$(pnpm view "@dagrejs/dagre@$DAGRE_VERSION" dist.tarball)" | tar xz -C "$tmp/dagre"
  cp "$tmp/dagre/package/dist/dagre.min.js" "$tmp/dagre/package/LICENSE" "$VENDOR/dagre/"
  # three.js: a subset bundled from the npm package (root devDependency "three") – global THREE
  (cd "$ROOT" && pnpm install --frozen-lockfile >/dev/null && node scripts/build-three.mjs)
  (cd "$VENDOR" && sha256sum onlyoffice/plugins.js onlyoffice/plugins-ui.js abcjs/abcjs-basic-min.js \
    qrcode-generator/qrcode.js dagre/dagre.min.js three/three.min.js > SHA256SUMS)
  echo "    Updated vendor/SHA256SUMS – also update the table in vendor/SOURCES.md:"
  cat "$VENDOR/SHA256SUMS"
}

if [[ "${1:-}" == "--update-vendor" ]]; then
  update_vendor
fi

echo "==> Verifying vendor checksums"
(cd "$VENDOR" && sha256sum --quiet -c SHA256SUMS)

echo "==> Checking config.json"
node -e '
  const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const v = c.variations[0];
  if (!/^asc\.\{[0-9A-F-]{36}\}$/.test(c.guid)) throw new Error("bad guid");
  if (v.type !== "panel" || v.isInsideMode !== true) throw new Error("panel/isInsideMode missing");
' "$SRC/config.json"

echo "==> Building $OUT"
# Empty the folder instead of deleting it: it may be bind-mounted into a
# Document Server container (deploy/, dev/eurooffice/), and a re-created
# directory would not be visible there.
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -delete
rm -f "$ROOT/dist/$NAME.plugin" "$ROOT/dist/$NAME.tar.gz" "$ROOT/dist/$NAME.zip"
mkdir -p "$OUT/vendor" "$OUT/licenses"
cp -R "$SRC/." "$OUT/"
# Shared modules (also used by the proxy): ABC helpers, worksheet layout, themes, generators, graphics, diagrams, check.
cp "$SHARED"/*.js "$OUT/js/"
if [[ -n "${PLUGIN_VERSION:-}" ]]; then
  node -e '
    const fs = require("fs"); const f = process.argv[1];
    const c = JSON.parse(fs.readFileSync(f, "utf8")); c.version = process.argv[2];
    fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
  ' "$OUT/config.json" "${PLUGIN_VERSION#v}"
fi
cp "$VENDOR/onlyoffice/plugins.js" "$VENDOR/onlyoffice/plugins-ui.js" "$OUT/vendor/"
cp "$VENDOR/abcjs/abcjs-basic-min.js" "$OUT/vendor/"
cp "$VENDOR/qrcode-generator/qrcode.js" "$OUT/vendor/qrcode.js"
cp "$VENDOR/dagre/dagre.min.js" "$OUT/vendor/dagre.min.js"
cp "$VENDOR/three/three.min.js" "$OUT/vendor/three.min.js"
cp "$ROOT/LICENSE" "$OUT/licenses/LICENSE-worksheet-assistant.txt"
cp "$VENDOR/abcjs/LICENSE.md" "$OUT/licenses/LICENSE-abcjs.txt"
cp "$VENDOR/qrcode-generator/LICENSE" "$OUT/licenses/LICENSE-qrcode-generator.txt"
cp "$VENDOR/dagre/LICENSE" "$OUT/licenses/LICENSE-dagre.txt"
cp "$VENDOR/three/LICENSE" "$OUT/licenses/LICENSE-three.txt"
cp "$VENDOR/onlyoffice/LICENSE" "$OUT/licenses/LICENSE-onlyoffice-plugin-sdk-AGPL-3.0.txt"
cp "$VENDOR/SOURCES.md" "$OUT/licenses/THIRD-PARTY.md"

# Sanity check: every local script/stylesheet referenced by index.html exists.
grep -oE '(src|href)="[^"]+"' "$OUT/index.html" | sed -E 's/^(src|href)="//; s/"$//' | while read -r ref; do
  [[ "$ref" =~ ^https?: ]] && continue
  [[ -f "$OUT/$ref" ]] || { echo "Missing file referenced by index.html: $ref" >&2; exit 1; }
done

echo "==> Packing dist/$NAME.plugin"
if command -v zip >/dev/null 2>&1; then
  (cd "$OUT" && zip -qr -X "../$NAME.plugin" .)
else
  python3 - "$OUT" "$ROOT/dist/$NAME.plugin" <<'PY'
import os, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(src):
        dirs.sort()
        for f in sorted(files):
            full = os.path.join(base, f)
            z.write(full, os.path.relpath(full, src))
PY
fi

echo "==> Packing dist/$NAME.tar.gz and dist/$NAME.zip"
tar -czf "$ROOT/dist/$NAME.tar.gz" -C "$ROOT/dist" "$NAME"
python3 - "$ROOT/dist" "$NAME" <<'PY'
import os, sys, zipfile
dist, name = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(os.path.join(dist, name + ".zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(os.path.join(dist, name)):
        dirs.sort()
        for f in sorted(files):
            full = os.path.join(base, f)
            z.write(full, os.path.relpath(full, dist))
PY

echo "==> Done"
du -sh "$OUT" "$ROOT/dist/$NAME.plugin" "$ROOT/dist/$NAME.tar.gz" "$ROOT/dist/$NAME.zip"
