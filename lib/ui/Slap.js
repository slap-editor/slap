var _ = require('lazy.js');
var lodash = require('lodash');
var blessed = require('blessed');
var Promise = require('bluebird');
var path = require('path');
var clap = require('node-clap');
var mkdirp = Promise.promisify(require('mkdirp'));

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Editor = require('editor-widget');

function Slap (opts) {
  var self = this;

  if (!(self instanceof BaseWidget)) return new Slap(opts);

  if (!Slap.global) Slap.global = this;
  if (opts.screen && !opts.screen.slap) opts.screen.slap = self;
  BaseWidget.call(self, opts);

  self.panes = [];

  self.header = new Header({parent: self});

  self.fileBrowser = new FileBrowser({
    parent: self,
    top:    self.header.options.headerPosition === 'top'    ? 1 : 0,
    bottom: self.header.options.headerPosition === 'bottom' ? 1 : 0,
    left: 0,
  });
  self.fileBrowser.focus();
}
Slap.global = null;
Slap.prototype.__proto__ = BaseWidget.prototype;

Slap.prototype.paneForPath = function (panePath) {
  var self = this;
  var pane;
  panePath = util.resolvePath(panePath);
  self.panes.some(function (openPane) {
    if (openPane.editor.textBuf.getPath() === panePath) {
      pane = openPane;
      return true;
    }
  });
  return pane;
};
Slap.prototype.open = Promise.method(function (filePath, current) {
  var self = this;

  var pane = self.paneForPath(filePath);
  pane = pane || new Pane({parent: self});
  return pane.editor.open(filePath)
    .then(function () {
      if (current) pane.setCurrent();
      return pane;
    })
    .catch(function (err) {
      pane.close();
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
  var quit = Promise.resolve();

  if (Editor.highlightClient) quit = quit
    .then(Editor.highlightClient)
    .then(function (client) {
      if (!client) return;
      client.dontRespawn = true;
      self.panes.forEach(function (pane) { pane.editor.detach(); });
    });

  quit
    .delay(20) // FIXME: .delay(20) hack for I/O flush
    .then(function () { process.exit(0); });

  // this.program.input.removeAllListeners();

  return this;
};
Slap.prototype.help = function () {
  return this
    .open(path.join(__dirname, '../../slap.ini'), true)
    .tap(function (pane) { pane.editor.readOnly(true); });
};

Slap.prototype._stopKeyPropagation = function () {
  // FIXME: ugly hack to stop enter from last keypress from propagating too far
  var self = this;
  self.lockKeys = true;
  return Promise.delay(0).then(function () { self.lockKeys = false; });
};

Slap.prototype._initHandlers = function () {
  var self = this;

  self.on('element keypress', function (el, ch, key) {
    var binding = self.resolveBinding(key);

    var logLine = "keypress " + key.full;
    if (key.full !== key.sequence) logLine += " [raw: " + JSON.stringify(key.sequence) + "]";
    var focused = {parent: self.screen.focused}, focusedBinding;
    while ((focused = focused.parent) && !(focusedBinding = BaseWidget.prototype.resolveBinding.call(focused, key)));
    if (focusedBinding) logLine += " (bound to "+focusedBinding+" on "+util.typeOf(focused) + ")";
    util.logger.silly(logLine);

    switch (binding) {
      case 'new': new Pane({parent: self}).setCurrent(); return false;
      case 'open':
        if (!self.fileBrowser.visible) {
          self.fileBrowser.show();
          self.panes.forEach(function (pane) {
            pane.left = self.fileBrowser.width;
            pane.editor._updateContent();
          });
        }
        self.fileBrowser.focus();
        return false;
      case 'nextPane': self.panes[util.mod(self.data.currentPane + 1, self.panes.length)].setCurrent(); return false;
      case 'prevPane': self.panes[util.mod(self.data.currentPane - 1, self.panes.length)].setCurrent(); return false;
      case 'toggleFileBrowser':
        self.fileBrowser.toggle();
        self.panes.forEach(function (pane) {
          pane.left = self.fileBrowser.visible ? self.fileBrowser.width : 0;
          pane.editor._updateContent();
        });
        return false;
      case 'toggleInsertMode': self.toggleInsertMode(); return false;
      case 'quit':
        if (!self._panesBlockingQuit) {
          var currentPane = self.panes[self.data.currentPane];
          if (currentPane) currentPane.requestClose(); // ensures self.panes[0] doesn't steal focus
          self._panesBlockingQuit = self.panes.slice().filter(function (pane) {
            if (!pane.requestClose()) {
              pane.once('close', function () {
                if (self._panesBlockingQuit) {
                  var paneIndex = self._panesBlockingQuit.indexOf(pane);
                  self._panesBlockingQuit.splice(paneIndex, 1);
                  if (self._panesBlockingQuit.length) {
                    self.panes[self.data.currentPane].saveAsCloseForm.show();
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

  ['element blur', 'element focus'].forEach(function (evt) {
    self.on(evt, function (el) {
      if (el._updateCursor) el._updateCursor();
    });
  });

  self.on('element show', function (el) { if (el instanceof Pane) self.header.render(); });

  ['resize', 'element focus'].forEach(function (evt) {
    self.on(evt, function () { self.render(); });
  });

  return self._initPlugins().then(function () {
    return BaseWidget.prototype._initHandlers.apply(self, arguments);
  });
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
