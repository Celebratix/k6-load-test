#!/bin/bash
# This script generates TypeScript API clients from OpenAPI specifications.

cd "${0%/*}"   # move to current directory, so execution is always relative to this file
set -o errexit # Exit on error

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 https://api.celebratix.io https://jpi.celebratix.io"
  exit 1
fi

npx openapi-ts -i $1/swagger/v2/swagger.json   -o src/api/generated/v2   -c legacy/fetch --name AppClientV2   &
npx openapi-ts -i $1/swagger/Shop/swagger.json -o src/api/generated/shop -c legacy/fetch --name AppClientShop &
npx openapi-ts -i $2/swagger/swagger.json      -o src/api/generated/jpi  -c legacy/fetch --name AppClientJpi  &

# Wait for all background processes to finish
wait

echo Done
