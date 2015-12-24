var _ = require('lodash');
var lodash = require('lodash');
var blessed = require('blessed');
var Promise = require('bluebird');
var path = require('path');
var clap = require('node-clap');
var mkdirp = Promise.promisify(require('mkdirp'));

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Editor = require('editor-widget');

var fs = require('fs');

function Slap (opts) {
  var self = this;

  if (!(self instanceof Slap)) return new Slap(opts);

  if (!Slap.global) Slap.global = this;
  if (opts.screen && !opts.screen.slap) opts.screen.slap = self;
  BaseWidget.call(self, opts);

  self.panes = [];

  self.header = new Header({parent: self});

  self.fileBrowser = new FileBrowser({
    parent: self,
    top:    self.header.options.headerPosition === 'top'    ? 1 : 0,
    bottom: self.header.options.headerPosition === 'bottom' ? 1 : 0,
    left: 0
  });
  self.fileBrowser.focus();

  self.paneList = new PaneList({parent: self});
}
Slap.global = null;
Slap.prototype.__proto__ = BaseWidget.prototype;

Slap.prototype.paneForPath = function (panePath) {
  var self = this;
  var pane;
  panePath = util.resolvePath(panePath);
  self.panes.some(function (openPane) {
    if (openPane instanceof EditorPane && openPane.editor.textBuf.getPath() === panePath) {
      pane = openPane;
      return true;
    }
  });
  return pane;
};
Slap.prototype.getCurrentPane = function () {
  return this.panes[this.data.currentPane];
};
Slap.prototype.getPrevPane = function () {
  return this.panes[this.data.prevPane];
};
Slap.prototype.open = Promise.method(function (filePath, current) {
  var self = this;

  var pane = self.paneForPath(filePath);
  return Promise.resolve(pane)
    .then(function () {
      if (pane) return;
      if (fs.lstatSync(filePath).isDirectory()) throw _.merge(new Error('EISDIR: illegal operation on a directory, read'), {cause: {code: 'EISDIR'}});
      pane = new EditorPane({parent: self});
      return pane.editor.open(filePath);
    })
    .then(function () {
      if (current) pane.setCurrent();
      return pane;
    })
    .catch(function (err) {
      if (pane) pane.close();
      switch ((err.cause || err).code) {
        case 'EACCES':
          self.header.message(err.message, 'error');
          break;
        case 'EISDIR':
          self.fileBrowser.refresh(filePath, _.noop);
          self.fileBrowser.focus();
          break;
        default: throw err;
      }
    });
});

Slap.prototype.quit = function () {
  var self = this;
  var input = self.screen.program.input || {};
  if (typeof input.unref === 'function') input.unref();
  _.invoke(self.panes, 'detach');

  // in case the above logic doesn't exit the process, force quit
  setTimeout(function () { process.exit(0); }, 200).unref();

  return this;
};
Slap.prototype.help = function () {
  return this
    .open(path.join(__dirname, '..', '..', 'README.md'), true)
    .tap(function (pane) {
      var editor = pane.editor;
      editor.readOnly(true);
      editor.textBuf.scan(/^Usage/, function (match) {
        var start = match.range.start;
        editor.selection.setRange([start, start]);
        editor.scroll = start.translate([-editor.buffer.options.cursorPadding.top, 0]);
        editor._updateContent();
        match.stop();
      });
    });
};

Slap.prototype._stopKeyPropagation = function () {
  // FIXME: ugly hack to stop enter from last keypress from propagating too far
  var self = this;
  self.lockKeys = true;
  return Promise.delay(0).then(function () { self.lockKeys = false; });
};

Slap.prototype._initHandlers = function () {
  var self = this;
  var panes = self.panes;

  self.on('element keypress', function (el, ch, key) {
    var binding = self.resolveBinding(key);

    var logLine = "keypress " + key.full;
    if (key.full !== key.sequence) logLine += " [raw: " + JSON.stringify(key.sequence) + "]";
    var focused = {parent: self.screen.focused}, focusedBinding;
    while ((focused = focused.parent) && !(focusedBinding = BaseWidget.prototype.resolveBinding.call(focused, key)));
    if (focusedBinding) logLine += " (bound to "+focusedBinding+" on "+util.typeOf(focused) + ")";
    util.logger.silly(logLine);

    switch (binding) {
      case 'new': new EditorPane({parent: self}).setCurrent(); return false;
      case 'open':
        if (!self.fileBrowser.visible) {
          self.fileBrowser.show();
          panes.forEach(function (pane) {
            pane.left = self.fileBrowser.width;
            pane.editor._updateContent();
          });
        }
        self.fileBrowser.focus();
        return false;
      case 'nextPane': panes[util.mod(self.data.currentPane + 1, panes.length)].setCurrent(); return false;
      case 'prevPane': panes[util.mod(self.data.currentPane - 1, panes.length)].setCurrent(); return false;
      case 'togglePaneList':
        if (self.paneList !== self.getCurrentPane()) self.paneList.setCurrent();
        else self.paneList.close();
        return false;
      case 'toggleFileBrowser':
        self.fileBrowser.toggle();
        panes.forEach(function (pane) {
          pane.left = self.fileBrowser.visible ? self.fileBrowser.width : 0;
          pane.editor._updateContent();
        });
        return false;
      case 'toggleInsertMode': self.toggleInsertMode(); return false;
      case 'quit':
        if (!self._panesBlockingQuit) {
          var currentPane = self.getCurrentPane();
          if (currentPane) currentPane.close(); // ensures panes[0] doesn't steal focus
          self._panesBlockingQuit = panes.slice().filter(function (pane) {
            if (!pane.close()) {
              pane.once('close', function () {
                if (self._panesBlockingQuit) {
                  self._panesBlockingQuit.splice(self._panesBlockingQuit.indexOf(pane), 1);
                  if (self._panesBlockingQuit.length) {
                    self.getCurrentPane().saveAsCloseForm.show();
                  } else {
                    self.quit();
                  }
                }
              });
              pane.saveAsCloseForm.once('cancel', function () {
                self._panesBlockingQuit.forEach(function (blockingPane) { blockingPane.saveAsCloseForm.hide(); });
                self._panesBlockingQuit = null;
              });
              return true;
            }
          });
          var numPanesBlockingQuit = self._panesBlockingQuit.length;
          if (numPanesBlockingQuit > 1) {
            self.header.message(numPanesBlockingQuit + " unsaved file" + (numPanesBlockingQuit !== 1 ? "s" : "") + ", please save or discard", 'warning');
          } else if (!numPanesBlockingQuit) {
            self.quit();
          }
        }
        return false;
      case 'help': self.help(); return false;
    }
  });

  self.on('mouse', function (mouseData) { util.logger.silly("mouse", mouseData); });

  self.on('element focus', function (el) { el.setFront(); self.screen.render(); });

  ['element blur', 'element focus'].forEach(function (evt) {
    self.on(evt, function (el) {
      if (el._updateCursor) el._updateCursor();
    });
  });

  self.on('element show', function (el) { if (el instanceof Pane) self.header.render(); });

  ['resize', 'element focus'].forEach(function (evt) {
    self.on(evt, function () { self.screen.render(); });
  });

  self.on('element close', _.debounce(function (el, i) {
    if (!(el instanceof Pane)) return;

    var nextPane = self.panes[Math.min(i, panes.length - 1)];
    if (nextPane && nextPane.isAttached()) nextPane.setCurrent();
  }));

  self.ready.call('_initPlugins').done();

  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

Slap.prototype._initPlugins = function () {
  var self = this;

  return Slap.getUserDir().then(function (userDir) {
      return clap({
        val: self,
        module: require.main,
        keyword: 'slap-plugin',
        paths: [path.join(userDir, 'plugins')]
      });
    })
    .map(function (obj) {
      return obj.promise
        .then(function () { util.logger.info("loaded plugin "+obj.plugin); })
        .catch(function (err) { util.logger.error("failed loading plugin "+obj.plugin+": "+(err.stack || err)); });
    });
};

Slap.getUserDir = function () {
  var userDir = util.resolvePath('~/.' + require('../../package').name);
  return mkdirp(userDir).return(userDir);
};

module.exports = Slap;

// circular imports
var Header = require('./Header');
var FileBrowser = require('./FileBrowser');
var Pane = require('./Pane');
var EditorPane = require('./EditorPane');
var PaneList = require('./PaneList');
