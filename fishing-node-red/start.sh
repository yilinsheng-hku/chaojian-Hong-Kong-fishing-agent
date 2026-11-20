#!/bin/sh
# Install the flow and settings baked into the image whenever they change.
# The previous /data copy is kept as a timestamped backup, so editor changes are
# never silently lost; they can be re-imported from /data/backups/.
set -e
STAMP_FILE=/data/.fishing-image-sum
current=$(cat /opt/fishing/flows.json /opt/fishing/settings.js | cksum | cut -d' ' -f1)
installed=$(cat "$STAMP_FILE" 2>/dev/null || true)
if [ "$current" != "$installed" ]; then
  if [ -f /data/flows.json ]; then
    mkdir -p /data/backups
    stamp=$(date +%Y%m%d-%H%M%S)
    cp /data/flows.json "/data/backups/flows-$stamp.json"
    echo "fishing: previous flow saved to /data/backups/flows-$stamp.json"
  fi
  cp /opt/fishing/flows.json /data/flows.json
  cp /opt/fishing/settings.js /data/settings.js
  echo "$current" > "$STAMP_FILE"
  echo "fishing: installed flow from image ($current)"
fi
exec /usr/src/node-red/entrypoint.sh "$@"
