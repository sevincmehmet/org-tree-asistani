#!/usr/bin/env bash
# İki agent'ı (org_asistani + calisan_asistani) ADK sunucusuyla başlatır.
#   ./calistir.sh        -> api_server (React arayüzü için, port 8000)
#   ./calistir.sh web    -> ADK'nın kendi geliştirici arayüzü (adk web, port 8000)
#   ORG_DEBUG=2,3 ./calistir.sh debug  -> api_server + debugpy (5678); VS Code: "Org: 🔌 Çalışan sunucuya bağlan"
set -euo pipefail
cd "$(dirname "$0")"

# Python: PYTHON değişkeni > projedeki .venv > yandaki jollin-asistani ortamı > sistemdeki python3
if [ -z "${PYTHON:-}" ]; then
  for aday in .venv/bin/python ../jollin-asistani/.venv/bin/python; do
    [ -x "$aday" ] && PYTHON=$aday && break
  done
  PYTHON=${PYTHON:-python3}
fi
KOMUT=api_server
if [ "${1:-}" = "web" ]; then
  KOMUT=web
fi
if [ "${1:-}" = "debug" ]; then
  # Debugger bağlanmasa da sunucu çalışır; bağlanınca breakpoint()/🔴 duraklar VS Code'da durur.
  exec "$PYTHON" -m debugpy --listen 127.0.0.1:5678 -m google.adk.cli api_server --allow_origins=http://localhost:5173 --port 8000 --no-reload .
fi

exec "$PYTHON" -m google.adk.cli "$KOMUT" --allow_origins=http://localhost:5173 --port 8000 .
