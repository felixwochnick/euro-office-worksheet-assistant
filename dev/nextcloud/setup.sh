#!/usr/bin/env bash
# Prepares the local dev Nextcloud (see docker-compose.yml) for proxy auth tests.
# Idempotent - safe to run again at any time.
#
#   ./setup.sh              create/update test user, reuse or create the OAuth2 client
#   ./setup.sh --recreate   additionally delete and recreate the OAuth2 client
#                           (new client id/secret; all tokens of the old client die)
#
# Result: ./oauth-client.env with NEXTCLOUD_OAUTH_CLIENT_ID / _SECRET (git-ignored).
set -euo pipefail
cd "$(dirname "$0")"

NC_URL="${NC_URL:-http://localhost:8091}"
TEST_USER="lehrer"
TEST_PASSWORD="lehrer-dev-password-123"
TEST_DISPLAY_NAME="Test Lehrer"
CLIENT_NAME="Arbeitsblatt-Assistent"
REDIRECT_URI="http://localhost:8787/oauth/callback"
ENV_FILE="oauth-client.env"

RECREATE=0
[[ "${1:-}" == "--recreate" ]] && RECREATE=1

dc() { docker compose -p nextcloud-dev "$@"; }
occ() { dc exec -T -u www-data nextcloud php occ "$@"; }
# Runs PHP code from stdin inside the container (as www-data), extra args -> $argv.
container_php() { dc exec -T -u www-data nextcloud php -- "$@"; }

# --- 1. Wait until the container has finished the auto-install -----------------
# Apache only starts after the entrypoint has installed Nextcloud and set the
# trusted domains, so a successful status.php with "installed":true means ready.
echo "Waiting for Nextcloud at $NC_URL ..."
for _ in $(seq 1 120); do
  if curl -fsS "$NC_URL/status.php" 2>/dev/null | grep -q '"installed":true'; then
    break
  fi
  sleep 2
done
curl -fsS "$NC_URL/status.php" | grep -q '"installed":true' \
  || { echo "Nextcloud did not come up (docker compose -p nextcloud-dev logs nextcloud)" >&2; exit 1; }
echo "Nextcloud is up: $(curl -fsS "$NC_URL/status.php")"

# --- 2. Test user ---------------------------------------------------------------
if occ user:info "$TEST_USER" >/dev/null 2>&1; then
  echo "User '$TEST_USER' exists - resetting its password to the known dev password."
  dc exec -T -u www-data -e OC_PASS="$TEST_PASSWORD" nextcloud \
    php occ user:resetpassword --password-from-env "$TEST_USER" >/dev/null
else
  echo "Creating user '$TEST_USER'."
  dc exec -T -u www-data -e OC_PASS="$TEST_PASSWORD" nextcloud \
    php occ user:add --password-from-env --display-name="$TEST_DISPLAY_NAME" "$TEST_USER" >/dev/null
fi

# --- 3. OAuth2 client -----------------------------------------------------------
# occ only offers oauth2:add-client / oauth2:delete-client <numeric id>, there is
# no list command, and the secret is stored as an HMAC (it cannot be read back).
# So we ask Nextcloud's ClientMapper directly which clients with our name exist
# and whether the id/secret in $ENV_FILE still match one of them.
OLD_ID=""; OLD_SECRET=""
if [[ -f "$ENV_FILE" ]]; then
  OLD_ID="$(sed -n 's/^NEXTCLOUD_OAUTH_CLIENT_ID=//p' "$ENV_FILE")"
  OLD_SECRET="$(sed -n 's/^NEXTCLOUD_OAUTH_CLIENT_SECRET=//p' "$ENV_FILE")"
fi

# Output: one line per client with our name: "<valid|stale> <numeric id>"
CLIENTS="$(container_php "$CLIENT_NAME" "$REDIRECT_URI" "$OLD_ID" "$OLD_SECRET" <<'PHP'
<?php
require_once '/var/www/html/lib/base.php';
\OCP\Server::get(\OCP\App\IAppManager::class)->loadApp('oauth2');
[, $name, $redirectUri, $clientId, $secret] = $argv;
$mapper = \OCP\Server::get(\OCA\OAuth2\Db\ClientMapper::class);
$crypto = \OCP\Server::get(\OCP\Security\ICrypto::class);
foreach ($mapper->getClients() as $client) {
	if ($client->getName() !== $name) {
		continue;
	}
	$valid = $clientId !== '' && $secret !== ''
		&& $client->getClientIdentifier() === $clientId
		&& $client->getRedirectUri() === $redirectUri
		&& hash_equals($client->getSecret(), bin2hex($crypto->calculateHMAC($secret)));
	echo ($valid ? 'valid' : 'stale') . ' ' . $client->getId() . "\n";
}
PHP
)"

if [[ $RECREATE -eq 0 ]] && grep -q '^valid ' <<<"$CLIENTS"; then
  echo "OAuth2 client '$CLIENT_NAME' from $ENV_FILE is still valid - reusing it."
  # Remove duplicates with the same name so the client list stays clean.
  for id in $(awk '$1 == "stale" { print $2 }' <<<"$CLIENTS"); do
    echo "Deleting stale duplicate OAuth2 client #$id."
    occ oauth2:delete-client "$id" >/dev/null
  done
else
  for id in $(awk '{ print $2 }' <<<"$CLIENTS"); do
    echo "Deleting OAuth2 client #$id ('$CLIENT_NAME')."
    occ oauth2:delete-client "$id" >/dev/null
  done
  echo "Creating OAuth2 client '$CLIENT_NAME' -> $REDIRECT_URI"
  # JSON: {"id":1,"name":"...","redirectUri":"...","clientId":"<64>","clientSecret":"<64>"}
  JSON="$(occ oauth2:add-client --output=json "$CLIENT_NAME" "$REDIRECT_URI")"
  read -r NEW_ID NEW_SECRET < <(dc exec -T nextcloud php -r \
    '$j = json_decode(stream_get_contents(STDIN), true); echo $j["clientId"], " ", $j["clientSecret"], "\n";' \
    <<<"$JSON")
  [[ ${#NEW_ID} -ge 32 && ${#NEW_SECRET} -ge 32 ]] || { echo "Unexpected add-client output: $JSON" >&2; exit 1; }
  umask 077
  cat > "$ENV_FILE" <<EOF
NEXTCLOUD_OAUTH_CLIENT_ID=$NEW_ID
NEXTCLOUD_OAUTH_CLIENT_SECRET=$NEW_SECRET
EOF
  echo "Wrote $(pwd)/$ENV_FILE"
fi

cat <<EOF

Done.
  Nextcloud:     $NC_URL   (admin / admin-dev-password-123)
  Test user:     $TEST_USER / $TEST_PASSWORD
  OAuth2 client: $(pwd)/$ENV_FILE
                 redirect URI $REDIRECT_URI
EOF
