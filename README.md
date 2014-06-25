![Screenshot](https://raw.githubusercontent.com/slap-editor/slap/master/screenshot.png)

✋ slap
======

slap is a Sublime-like terminal-based text editor that strives to make editing
from the terminal easier. It has:

* first-class mouse support
* GUI editor-like [keybindings](https://github.com/slap-editor/slap/blob/master/slap.ini#L33)[*](#some-keys-dont-work)
* copying/pasting with OS clipboard support
* undo/redo
* syntax highlighting for [many languages](https://github.com/isagalaev/highlight.js/tree/master/src/languages)
* a Sublime-like file sidebar
* select word to highlight other occurrences; double-click to select word
* easy-to-use finding with regex support
* bracket matching
* ... many other features that will make you leave nano, vim, and emacs behind

Installation
------------

Make sure [NodeJS](http://nodejs.org/download/) is installed, then:

    $ sudo npm install -g slap

Usage
-----

    $ slap file.c

### Configuration

Copy some or all of the default [configuration](slap.ini) to `~/.slaprc` to
change keybindings, styles, etc. You can also pass options in via command line:

    $ slap --editor.tabSize 2 file.c

[Issues](https://github.com/slap-editor/slap/issues)
--------

### Some keys don't work!

Unfortunately most terminal emulators do not support certain keystrokes and as
such there is no way to handle them. These include `C-backspace`, `S-home/end`,
`C-S-up/down`, and `S-pageup/down`. These actions have alternate keybindings,
inspired by emacs and other editors.

### Windows support

Most terminal emulators in Windows do not support mouse events, PuTTY being a
notable exception. Currently slap does not work in Cygwin due to
[joyent/node#6459](https://github.com/joyent/node/issues/6459).

### Copying and pasting

If you are using Linux or X.Org, ensure xclip is installed.
