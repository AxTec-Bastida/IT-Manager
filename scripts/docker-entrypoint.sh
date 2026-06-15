#!/bin/sh
set -eu

mkdir -p \
  /app/prisma \
  /app/uploads/assets/thumbs \
  /app/uploads/stock/thumbs \
  /app/uploads/facturas \
  /app/uploads/maps \
  /app/backups \
  /app/logs

if [ -d /app/prisma-template ]; then
  cp -f /app/prisma-template/schema.prisma /app/prisma/schema.prisma
  if [ -d /app/prisma-template/migrations ]; then
    mkdir -p /app/prisma/migrations
    cp -R /app/prisma-template/migrations/. /app/prisma/migrations/
  fi
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma generate --schema=/app/prisma/schema.prisma
  npx prisma migrate deploy --schema=/app/prisma/schema.prisma
fi

exec "$@"
