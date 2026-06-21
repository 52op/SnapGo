#!/bin/sh
set -e
cd "$(dirname "$0")"
echo "Building frontend..."
cd web && npm install > /dev/null 2>&1 && npm run build > /dev/null 2>&1 && cd ..
echo "Building SnapGo..."
go build -ldflags="-s -w" -o snapgo .
echo "Done: snapgo"
