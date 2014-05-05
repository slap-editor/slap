slap
====

CLI text editor for the masses

slap strives to make editing from the terminal easier. It has **mouse support**,
**Ctrl+C/X/V copy/cut/paste (configurable)**, **syntax highlighting for
[many languages](https://github.com/isagalaev/highlight.js/tree/master/src/languages)**,
and many other features that will make you leave nano, vim, and emacs behind.

Installation
------------

Make sure [NodeJS](http://nodejs.org/download/) is installed, then:

    $ sudo npm install -g slap

Usage
-----

    $ slap file.c

### Configuration

slap uses [rc](https://github.com/dominictarr/rc#standards) for configuration
management. See the default [configuration](slap.ini) for keybindings, styles,
etc. You can also pass options in via command line:

    $ slap --editor.tabSize 2 file.c

Issues
------

### Copying and pasting

Ensure xclip is installed.
