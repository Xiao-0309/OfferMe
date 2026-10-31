#!/bin/zsh
set -e
cd "${0:A:h}"
if [[ -d "release/mac-arm64/OfferMe.app" ]]; then
  open "release/mac-arm64/OfferMe.app"
elif [[ -d node_modules ]]; then
  npm run build
  npm start
else
  print 'Run npm ci in this directory before launching OfferMe.'
  exit 1
fi
