#!/bin/sh
set -eu

# Firebase web settings are public, and the bundle is built once per image.
# Writing them from the container environment at start-up lets a production
# deployment configure Firebase from its .env without rebuilding the image.
root="${WEB_ROOT:-/usr/share/nginx/html}"

escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

write_config() {
  cat > "$root/config.js" <<EOF
window.__NINT_CONFIG__ = {
  apiKey: "$(escape "${VITE_FIREBASE_API_KEY:-}")",
  authDomain: "$(escape "${VITE_FIREBASE_AUTH_DOMAIN:-}")",
  databaseURL: "$(escape "${VITE_FIREBASE_DATABASE_URL:-}")",
  projectId: "$(escape "${VITE_FIREBASE_PROJECT_ID:-}")",
  storageBucket: "$(escape "${VITE_FIREBASE_STORAGE_BUCKET:-}")",
  messagingSenderId: "$(escape "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}")",
  appId: "$(escape "${VITE_FIREBASE_APP_ID:-}")",
  useEmulator: "$(escape "${VITE_USE_FIREBASE_EMULATOR:-}")"
};
EOF
}

if [ -d "$root" ]; then
  write_config
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec nginx -g 'daemon off;'
