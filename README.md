![Screenshot](https://raw.githubusercontent.com/slap-editor/slap/master/screenshot.png)

slap :wave: [![Build Status](https://img.shields.io/travis/slap-editor/slap.svg)](https://travis-ci.org/slap-editor/slap) [![Donate](https://img.shields.io/gratipay/slap.svg)](https://gratipay.com/slap/)
====

slap is a Sublime-like terminal-based text editor that strives to make editing
from the terminal easier. It has:

* first-class mouse support (even over an SSH connection)
* a Sublime-like file sidebar
* double-click to select word, highlight other occurrences
* configurable Sublime-like [keybindings](#default-keybindings)[*](#some-keys-dont-work) (<kbd>Ctrl+S</kbd> save, <kbd>Ctrl+Z</kbd> undo, etc.)
* copying/pasting with OS clipboard support
* infinite undo/redo
* syntax highlighting for [100+ languages](https://github.com/isagalaev/highlight.js/tree/master/src/languages)
* bracket matching
* autoindentation
* heavily customizeable via [plugins](#plugins)
* ... many other features that will make you leave nano, vim, and emacs behind

Installation
------------

    $ curl -sL https://raw.githubusercontent.com/slap-editor/slap/master/install.sh | sh

If you already have [NodeJS](http://nodejs.org/download/) installed:

    $ sudo npm install slap -g

Usage
-----

    $ slap fish.c
    $ slap fish1.c fish2.c
    $ slap redfish/ # open dir
    $ slap # new file

### Default keybindings

* **Quit**: <kbd>Ctrl+Q</kbd>
* **Movement**: mouse or arrow keys and <kbd>PageUp/Down</kbd>/<kbd>Home</kbd>/<kbd>End</kbd>
  * <kbd>Shift</kbd> or click+drag to select, <kbd>Ctrl</kbd>/<kbd>Alt</kbd> to move faster
* **Save**: <kbd>Ctrl+S</kbd>
* **Undo**: <kbd>Ctrl+Z</kbd>, **redo**: <kbd>Ctrl+Y</kbd>
* **List open tabs**: <kbd>Ctrl+L</kbd>
* **Next/previous tab**: <kbd>Ctrl+Alt+PageUp/Down</kbd>
* **Close tab**: <kbd>Ctrl+W</kbd>
* **Find**: <kbd>Ctrl+F</kbd>
* **Go to line**: <kbd>Ctrl+G</kbd>
* **Go to matching bracket**: <kbd>Ctrl+]</kbd>
* **Open**: <kbd>Ctrl+O</kbd> (or click the filebrowser)
* **New file**: <kbd>Ctrl+N</kbd>

### Configuration

slap supports INI or JSON config files. You can put configuration [wherever rc can find it](https://github.com/dominictarr/rc#standards).
A mostly empty configuration file with some useful comments is created in [`~/.slap/config`](default-config.ini)
if an existing file isn't found.

Pass configuration via command line:

    $ slap --header.style.bg red file.c

### Plugins

Slap is fully customizeable and supports plugins written in JS. You can place
single JS files, or NodeJS packages, into `~/.slap/plugins/`.

To write your own plugin, a good starting point is
[slap-clipboard-plugin](https://github.com/slap-editor/slap-clipboard-plugin).
Please note that plugin packages must have `"keywords": ["slap-plugin"]` in
`package.json`.

OS support
----------

### OSX

iTerm2 supports the mouse and most keybindings out of the box. For optimal
Terminal.app usage, see [slap-Terminal.app-profile](https://github.com/slap-editor/slap-Terminal.app-profile).

### Linux

If you are using X.Org, ensure xclip is installed for OS clipboard support.

### Windows

Most terminal emulators in Windows do not support mouse events, PuTTY being a
notable exception. In Cygwin, slap crashes on startup due to
[joyent/node#6459](https://github.com/joyent/node/issues/6459).

[Issues](../../issues/new)
--------

Join us in [#slap on Freenode](http://webchat.freenode.net/?channels=slap) for
troubleshooting, theme/plugin/core development, or palm strike discussion of any
nature.

### Some keys don't work!

*NOTE: if you are using Terminal.app, see [slap-Terminal.app-profile](https://github.com/slap-editor/slap-Terminal.app-profile).*

Unfortunately most terminal emulators do not support certain keystrokes and as
such there is no way to handle them. These include `C-backspace`, `S-home/end`,
and `S-pageup/down`. Most of these actions have alternate keybindings, inspired
by emacs and other editors, but if you find one that doesn't work, please
[submit an issue](../../issues/new)!

### Slow on single cores, Raspberry Pi

slap is based on Github's [atom/text-buffer](https://github.com/atom/text-buffer),
and as such should be very performant, even with very large files.

Try `--editor.highlight false` or adding the following to `~/.slap/config`:

    [editor]
    highlight = false

If that doesn't improve performance, please run with `--perf.profile true` and
[submit an issue](../../issues/new) with the newly-created `v8.log` file.
