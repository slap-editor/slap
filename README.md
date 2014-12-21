![Screenshot](https://raw.githubusercontent.com/slap-editor/slap/master/screenshot.png)

✋ slap
======

slap is a Sublime-like terminal-based text editor that strives to make editing
from the terminal easier. It has:

* first-class mouse support
* GUI editor-like [keybindings](https://github.com/slap-editor/slap/blob/master/slap.ini#L43)[*](#some-keys-dont-work)
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

Make sure an up-to-date version of [NodeJS](http://nodejs.org/download/) is installed, then:

    $ sudo npm install -g slap

Note: Some operating systems ship a version of NodeJS which might be too old. Please make sure to visit [Node's official installation guide](https://github.com/joyent/node/wiki/installing-node.js-via-package-manager).

If `npm install -g slap` doesn't work, try using HTTP instead of HTTPS:

    $ npm config set registry http://registry.npmjs.org/

Usage
-----

    $ slap file.c

### Configuration

Copy some or all of the default [configuration](slap.ini) to `~/.slaprc` to
change keybindings, styles, etc. You can also pass options in via command line:

    $ slap --logger.level debug file.c

OS support
----------

### OSX

iTerm2 works best. Terminal.app does not support some default keybindings but
mouse support works well with the [MouseTerm](https://bitheap.org/mouseterm/)
[SIMBL](http://www.culater.net/software/SIMBL/SIMBL.php) plugin.

### Linux

If you are using X.Org, ensure xclip is installed for OS clipboard support.

### Windows

Most terminal emulators in Windows do not support mouse events, PuTTY being a
notable exception. In Cygwin, slap crashes on startup due to
[joyent/node#6459](https://github.com/joyent/node/issues/6459).

[Issues](https://github.com/slap-editor/slap/issues/new)
--------

Join us in [#slap on Freenode](http://webchat.freenode.net/?channels=slap) for
troubleshooting, theme/plugin/core development, or palm strike discussion of any
nature.

### Some keys don't work!

Unfortunately most terminal emulators do not support certain keystrokes and as
such there is no way to handle them. These include `C-backspace`, `S-home/end`,
and `S-pageup/down`. Most of these actions have alternate keybindings, inspired
by emacs and other editors, but if you find one that doesn't work, please submit
an [issue](https://github.com/slap-editor/slap/issues/new)!
