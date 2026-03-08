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

# Install iOS pod dependencies
cd ios
pod install