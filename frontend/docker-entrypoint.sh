#!/bin/sh
set -eu

# Firebase web settings are public, and the bundle is built once per image.
# Writing them from the container environment at start-up lets a production
# deployment configure Firebase from its .env without rebuilding the image.
root="${WEB_ROOT:-/usr/share/nginx/html}"

# Accept both the Vite names and plain FIREBASE_* names, so a deployment that
# filled the compose .env without the VITE_ prefix still works.
api_key="${VITE_FIREBASE_API_KEY:-${FIREBASE_API_KEY:-}}"
auth_domain="${VITE_FIREBASE_AUTH_DOMAIN:-${FIREBASE_AUTH_DOMAIN:-}}"
database_url="${VITE_FIREBASE_DATABASE_URL:-${FIREBASE_DATABASE_URL:-}}"
project_id="${VITE_FIREBASE_PROJECT_ID:-${FIREBASE_PROJECT_ID:-}}"
storage_bucket="${VITE_FIREBASE_STORAGE_BUCKET:-${FIREBASE_STORAGE_BUCKET:-}}"
sender_id="${VITE_FIREBASE_MESSAGING_SENDER_ID:-${FIREBASE_MESSAGING_SENDER_ID:-}}"
app_id="${VITE_FIREBASE_APP_ID:-${FIREBASE_APP_ID:-}}"
use_emulator="${VITE_USE_FIREBASE_EMULATOR:-${USE_FIREBASE_EMULATOR:-}}"

escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

write_config() {
  cat > "$root/config.js" <<EOF
window.__NINT_CONFIG__ = {
  apiKey: "$(escape "$api_key")",
  authDomain: "$(escape "$auth_domain")",
  databaseURL: "$(escape "$database_url")",
  projectId: "$(escape "$project_id")",
  storageBucket: "$(escape "$storage_bucket")",
  messagingSenderId: "$(escape "$sender_id")",
  appId: "$(escape "$app_id")",
  useEmulator: "$(escape "$use_emulator")"
};
EOF
}

if [ -d "$root" ]; then
  write_config
  if [ -n "$api_key" ]; then
    printf '[config] Firebase apiKey set, projectId=%s, databaseURL=%s\n' "${project_id:-<empty>}" "${database_url:-<empty>}"
  else
    printf '[config] Firebase apiKey is empty: no VITE_FIREBASE_API_KEY or FIREBASE_API_KEY reached this container.\n'
  fi
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec nginx -g 'daemon off;'
