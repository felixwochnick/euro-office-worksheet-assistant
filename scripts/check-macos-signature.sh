#!/usr/bin/env bash
# Check the signature of the macOS app (release workflow), after scripts/build-desktop.mjs:
#
#   DEVELOPER_ID=true bash scripts/check-macos-signature.sh apps/desktop/src-tauri/target/<target>/release/bundle
#
# Always: the app and everything inside it verify, and the server program (Node.js) has its JIT entitlements
# for the hardened runtime. With DEVELOPER_ID=true (the release has the Apple secrets) the app must also carry
# the Developer ID signature and the stapled notarization ticket and pass Gatekeeper – otherwise the job fails
# and the release stays a draft.
set -euo pipefail

bundle="$1"
app="$(ls -d "$bundle"/macos/*.app | head -n 1)"
server="$app/Contents/MacOS/worksheet-assistant"
dmg="$(ls "$bundle"/dmg/*.dmg | head -n 1)"

codesign --verify --deep --strict --verbose=2 "$app"
info="$(codesign -dvvv "$app" 2>&1)"
grep -E '^(Identifier|Authority|TeamIdentifier|Timestamp|CodeDirectory)' <<<"$info" || true
if ! codesign -d --entitlements - "$server" 2>&1 | grep -q 'com.apple.security.cs.allow-jit'; then
  echo "::error::the server program has no JIT entitlement (it would crash under the hardened runtime)"
  exit 1
fi

if [ "${DEVELOPER_ID:-false}" != "true" ]; then
  echo "ad-hoc signature (no Developer ID certificate) – Gatekeeper will warn on the first start"
  exit 0
fi

if ! grep -q '^Authority=Developer ID Application' <<<"$info"; then
  echo "::error::the app is not signed with the Developer ID certificate"
  exit 1
fi
xcrun stapler validate "$app"
spctl --assess --type execute --verbose=4 "$app"
codesign --verify --verbose=2 "$dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "$dmg" ||
  echo "::warning::Gatekeeper does not accept the disk image itself (the app inside is notarized)"
echo "Developer ID signature, notarized and stapled"
