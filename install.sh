#!/bin/sh

set -e

is_executable () {
  command -v "$1" >/dev/null 2>&1
}

errcho () {
  >&2 echo "$@"
}

echo "# Installing slap..."

if ! (is_executable npm && is_executable node && is_executable git); then
  if is_executable brew; then
    brew install node git
  elif is_executable port; then
    port install nodejs git
  elif is_executable apt-get; then
    wget -qO- https://deb.nodesource.com/setup | sudo bash - # Adds NodeSource repository to dpkg
    sudo apt-get install -y nodejs git
  elif is_executable yum; then
    curl -sL https://rpm.nodesource.com/setup | bash - # Adds NodeSource repository to yum
    sudo yum install -y nodejs git
  elif is_executable emerge; then
    emerge nodejs git
  elif is_executable pacman; then
    pacman -S nodejs npm git
  else
    errcho "Couldn't determine OS. Please install NodeJS manually, then run this script again."
    errcho "Visit https://github.com/joyent/node/wiki/installing-node.js-via-package-manager for instructions on how to install NodeJS on your OS."
    exit 1
  fi
fi

is_executable python2 && PYTHON='python2'
maybe_sudo="$([ -w "$(npm get prefix)/lib/node_modules" ] || echo 'sudo')"
$maybe_sudo npm install -g slap
