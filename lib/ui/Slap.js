var _ = require('lazy.js');
var lodash = require('lodash');
var blessed = require('blessed');
var Promise = require('bluebird');
var path = require('path');
var npm = require('npm');
var fs = require('fs');

var util = require('../util');

function Slap (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Slap(opts);

  if (!Slap.global) Slap.global = this;
  blessed.Screen.call(self, opts);
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

  self.render = lodash.throttle(function () {
    return blessed.Screen.prototype.render.apply(self, arguments);
  }, self.options.perf.renderThrottle);
}
Slap.prototype.__proto__ = blessed.Screen.prototype;
Slap.global = null;

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
  pane = pane || new Pane();
  return pane.editor.open(filePath)
    .then(function () {
      if (current) pane.setCurrent();
      return pane;
    })
    .catch(function (err) {
      pane.close();
      switch ((err.cause || err).code) {
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
  require('../highlight/client').call('kill').done();
  setTimeout(function () { process.exit(0); }, 20); // FIXME: hack for I/O flush
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

  self.on('keypress', function (ch, key) {
    var binding = util.getBinding(self.options.bindings, key);

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
      logger.silly(logLine + " (bound to " + bindingInfo + ")");
    } else {
      logger.silly(logLine);
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

  self.on('mouse', function (mouseData) { logger.silly("mouse", mouseData); });

  ['element blur', 'element focus'].forEach(function (evt) {
    self.on(evt, function (el) {
      if (el._updateCursor) el._updateCursor();
    });
  });

  self.on('element show', function (el) { if (el instanceof Pane) self.header.render(); });

  ['resize', 'element focus', 'insertMode'].forEach(function (evt) {
    self.on(evt, function () { self.render(); });
  });

  Promise.map([
    Promise.promisify(npm.load, npm)({global: true, depth: 1, loglevel: 'silent'})
      .then(function () { return Promise.promisify(npm.commands.ls, npm)([], true); })
      .spread(function (ls) {
        var deps = ((ls.dependencies || {}).slap || {}).dependencies || {};
        return Object.keys(deps).filter(function (dep) {
          return (deps[dep].keywords || []).indexOf('slap-plugin') !== -1;
        });
      }),
    self.ready
      .then(util.getUserDir).then(function (userDir) {
        var pluginsDir = path.join(userDir, 'plugins');
        return fs.readdirAsync(pluginsDir).map(function (file) {
          return path.join(pluginsDir, file);
        });
      })
      .catch(function () { return []; }),
  ], function (plugins) {
    return plugins.reduce(function (result, pkg) {
      try {
        result[pkg] = require(pkg)(self);
        logger.info("loaded plugin:", pkg);
      } catch (e) {
        logger.error("couldn't load plugin '"+pkg+"':", e.stack || e);
        result[pkg] = e;
      }
      return result;
    }, {});
  })
    .catch(logger.error)
    .done();

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = Slap;

// circular imports
var BaseElement = require('./BaseElement');
var Header = require('./Header');
var FileBrowser = require('./FileBrowser');
var Pane = require('./Pane');
