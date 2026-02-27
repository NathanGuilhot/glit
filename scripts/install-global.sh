#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Building app..."
npm run package

echo "→ Linking glit globally..."
npm link

echo "✓ Done — run 'glit' from any directory"
