#!/bin/sh
set -e

export HOMEBREW_NO_INSTALL_CLEANUP=TRUE

# Install Node 24 LTS
brew install node@24
brew link node@24 --force

# Install CocoaPods
brew install cocoapods

# Install JS dependencies
cd /Volumes/workspace/repository
npm install

# Generate GraphQL types (*.generated.ts are gitignored; schema.graphql is the
# committed source of truth). codegen:schema skips the network pull when the API
# is unreachable and falls back to the committed schema.
npm run codegen

# Install iOS pod dependencies
cd ios
pod install