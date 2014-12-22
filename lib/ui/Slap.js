var _ = require('lazy.js');
var lodash = require('lodash');
var blessed = require('blessed');
var Promise = require('bluebird');
var path = require('path');
var exec = require('child_process').exec;
var latestVersion = require('latest-version');
var semver = require('semver');

var util = require('../util');
var package = require('../../package');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Slap(opts);

  if (!Slap.global) Slap.global = this;
  blessed.Screen.call(self, _(opts).merge({handleUncaughtExceptions: false}).toObject());
  BaseElement.call(self, opts);

  self.panes = [];

  self.header = new Header();

  self.fileBrowser = new FileBrowser({
    parent: self,
    top:    self.header.options.headerPosition === 'top'    ? 1 : 0,
    bottom: self.header.options.headerPosition === 'bottom' ? 1 : 0,
    left: 0,
  });
  self.fileBrowser.focus();

  self.toggleInsertMode();
}
Slap.prototype.__proto__ = blessed.Screen.prototype;
Slap.global = null;

Slap.prototype.paneForPath = function (panePath) {
  var self = this;
  var pane;
  panePath = util.resolvePath(panePath);
  self.panes.some(function (openPane) {
    if (openPane.editor.path() === panePath) {
      pane = openPane;
      return true;
    }
  });
  return pane;
};
Slap.prototype.open = Promise.method(function (filePath, current) {
  var self = this;

  var pane = self.paneForPath(filePath);
  pane = pane || new Pane();
  return pane.editor.open(filePath)
    .then(function () {
      if (current) pane.setCurrent();
      return pane;
    })
    .catch(function (err) {
      switch ((err.cause || {}).code) {
        case 'EISDIR':
          self.fileBrowser.refresh(filePath, _.noop);
          self.fileBrowser.focus();
          break;
        default: throw err;
      }
    });
});

Slap.prototype.insertMode = util.getterSetter('insertMode', null, Boolean);
Slap.prototype.toggleInsertMode = function () { return this.insertMode(!this.insertMode()); };

Slap.prototype.quit = function () {
  setTimeout(function () { process.exit(0); }, 20); // FIXME: hack for I/O flush
  // this.program.input.removeAllListeners();
  // require('../highlight/client').disconnect();

  return this;
};
Slap.prototype.help = function () {
  return this
    .open(path.join(__dirname, '../../slap.ini'), true)
    .tap(function (pane) { pane.editor.readOnly(true); });
};

Slap.prototype.update = function () {
  var self = this;
  var name = package.name;
  latestVersion(name, function (err, npmVersion) {
    if (!err && semver.gt(npmVersion, package.version)) self.header.message("newer version available!", 'info');
  });

  var updateCmd = 'npm update -g --loglevel silent '+name;
  var result = exec(updateCmd + ' || sudo -n ' + updateCmd, function (err) {
    if (err) logger.warn("auto-update failed, please run `sudo npm update -g "+name+"`");
  });
  result.unref();
  return result;
};

Slap.prototype._stopKeyPropagation = function () {
  // FIXME: ugly hack to stop enter from last keypress from propagating too far
  var self = this;
  self.lockKeys = true;
  process.nextTick(function () { self.lockKeys = false; });
  return self;
};

Slap.prototype._initHandlers = function () {
  var self = this;

  self.on('keypress', function (ch, key) {
    var binding = util.getBinding(self.options.bindings, key);

    if (key.action !== 'mousemove') {
      if (key.name === 'mouse') {
        logger.debug("mouse", key);
      } else {
        var logLine = "keypress " + key.full;
        if (key.full !== key.sequence) logLine += " [raw: " + JSON.stringify(key.sequence) + "]";
        var bindingInfo;
        if (binding) {
          bindingInfo = binding + " on " + util.typeOf(self);
        } else {
          var focusedBinding = util.getBinding(((self.focused || {}).options || {}).bindings, key);
          if (focusedBinding) bindingInfo = focusedBinding + " on " + util.typeOf(self.focused);
        }
        if (bindingInfo) {
          logger.verbose(logLine + " (bound to " + bindingInfo + ")");
        } else {
          logger.debug(logLine);
        }
      }
    } else {
      logger.silly("mousemove", key);
    }

    switch (binding) {
      case 'new': new Pane().setCurrent(); return false;
      case 'open':
        if (!self.fileBrowser.visible) {
          self.fileBrowser.show();
          self.panes.forEach(function (pane) { pane.left = self.fileBrowser.width; });
        }
        self.fileBrowser.focus();
        return false;
      case 'nextPane': self.panes[util.mod(self.data.currentPane + 1, self.panes.length)].setCurrent(); return false;
      case 'prevPane': self.panes[util.mod(self.data.currentPane - 1, self.panes.length)].setCurrent(); return false;
      case 'toggleFileBrowser':
        self.fileBrowser.toggle();
        self.panes.forEach(function (pane) { pane.left = self.fileBrowser.visible ? self.fileBrowser.width : 0; });
        self.render();
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

  ['element blur', 'element focus'].forEach(function (evt) {
    self.on(evt, function (el) {
      if (el._updateCursor) el._updateCursor();
    });
  });

  self.on('element show', function (el) { if (el instanceof Pane) self.header.render(); });

  ['resize', 'element focus', 'insertMode'].forEach(function (evt) {
    self.on(evt, function () { self.render(); });
  });

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

Slap.prototype.render = lodash.throttle(function () {
  return blessed.Screen.prototype.render.apply(this, arguments);
}, 33);

module.exports = Slap;

// circular imports
var BaseElement = require('./BaseElement');
var Header = require('./Header');
var FileBrowser = require('./FileBrowser');
var Pane = require('./Pane');
