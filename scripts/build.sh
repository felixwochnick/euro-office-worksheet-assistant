#!/usr/bin/env bash
# Build the Euro-Office plugin.
#
#   scripts/build.sh                  build dist/music-notation/ and dist/music-notation.plugin
#   scripts/build.sh --update-vendor  re-download abcjs and the ONLYOFFICE v1 SDK files into vendor/
#                                     (versions below), then build
#
# Output:
#   dist/music-notation/          plugin folder – copy into .../documentserver/sdkjs-plugins/
#   dist/music-notation.plugin    ZIP with config.json at the root (for plugin managers)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="music-notation"
OUT="$ROOT/dist/$NAME"
VENDOR="$ROOT/vendor"

ABCJS_VERSION="${ABCJS_VERSION:-6.7.2}"
# Pinned commit of https://github.com/ONLYOFFICE/onlyoffice.github.io (sdkjs-plugins/v1)
ONLYOFFICE_REF="${ONLYOFFICE_REF:-94927418d89373a647b99100a40cc57d08da44e2}"

update_vendor() {
  echo "==> Downloading vendor files"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  mkdir -p "$VENDOR/onlyoffice" "$VENDOR/abcjs"
  local base="https://raw.githubusercontent.com/ONLYOFFICE/onlyoffice.github.io/$ONLYOFFICE_REF"
  curl -fsSL -o "$VENDOR/onlyoffice/plugins.js" "$base/sdkjs-plugins/v1/plugins.js"
  curl -fsSL -o "$VENDOR/onlyoffice/plugins-ui.js" "$base/sdkjs-plugins/v1/plugins-ui.js"
  curl -fsSL -o "$VENDOR/onlyoffice/LICENSE" "$base/LICENSE"
  (cd "$tmp" && npm pack "abcjs@$ABCJS_VERSION" --silent >/dev/null && tar xzf "abcjs-$ABCJS_VERSION.tgz")
  cp "$tmp/package/dist/abcjs-basic-min.js" "$tmp/package/dist/abcjs-basic-min.js.LICENSE" "$tmp/package/LICENSE.md" "$VENDOR/abcjs/"
  (cd "$VENDOR" && sha256sum onlyoffice/plugins.js onlyoffice/plugins-ui.js abcjs/abcjs-basic-min.js > SHA256SUMS)
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
' "$ROOT/plugin/config.json"

echo "==> Building $OUT"
# Empty the folder instead of deleting it: it may be bind-mounted into a
# Document Server container (deploy/, dev/eurooffice/), and a re-created
# directory would not be visible there.
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -delete
rm -f "$ROOT/dist/$NAME.plugin"
mkdir -p "$OUT/vendor" "$OUT/licenses"
cp -R "$ROOT/plugin/." "$OUT/"
cp "$ROOT/shared/abc-tools.js" "$OUT/js/abc-tools.js"
cp "$VENDOR/onlyoffice/plugins.js" "$VENDOR/onlyoffice/plugins-ui.js" "$OUT/vendor/"
cp "$VENDOR/abcjs/abcjs-basic-min.js" "$OUT/vendor/"
cp "$ROOT/LICENSE" "$OUT/licenses/LICENSE-music-notation-plugin.txt"
cp "$VENDOR/abcjs/LICENSE.md" "$OUT/licenses/LICENSE-abcjs.txt"
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

echo "==> Done"
du -sh "$OUT" "$ROOT/dist/$NAME.plugin"
