var _ = require('lodash');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Editor = require('editor-widget');

function Pane (opts) {
  var self = this;

  if (!(self instanceof Pane)) return new Pane(opts);

  BaseWidget.call(self, _.merge({
    top:    Slap.global.header.options.headerPosition === 'top'    ? 1 : 0,
    bottom: Slap.global.header.options.headerPosition === 'bottom' ? 1 : 0,
    left: 0,
    right: 0,
  }, Slap.global.options.pane, opts));
  self.left = Slap.global.fileBrowser.visible ? Slap.global.fileBrowser.width : 0;

  self.forms = self.forms || [];

  self.editor = new Editor(_.merge({
    parent: self,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }, Slap.global.options.editor, self.options.editor));

  self.findForm = new FindForm({parent: self});
  self.goLineForm = new GoLineForm({parent: self});
  self.saveAsForm = new SaveAsForm({parent: self});
  self.saveAsCloseForm = new SaveAsCloseForm({parent: self});

  if (!self.parent.panes) self.parent.panes = [];
  self.parent.panes.push(self);
}
Pane.prototype.__proto__ = BaseWidget.prototype;

Pane.prototype.setCurrent = function () {
  var self = this;
  var slap = self.screen.slap;
  var panes = slap.panes;
  var paneIndex = panes.indexOf(self);
  if (paneIndex === -1) { paneIndex = panes.length; panes.push(self); }
  self.ready
    .then(function () {
      if (!self.isAttached()) return;
      slap.data.currentPane = paneIndex;
      self.focus();
    })
    .done();
  return self;
};
Pane.prototype.close = function () {
  var self = this;
  self.detach();

  var slap = self.screen.slap;
  var paneIndex = slap.panes.indexOf(self);
  if (paneIndex !== -1) {
    slap.panes.splice(paneIndex, 1);
    if (slap.panes.length) slap.panes[Math.max(paneIndex - 1, 0)].setCurrent();
    else slap.fileBrowser.focus();
  }

  self.emit('close');
  return self;
};
Pane.prototype.requestClose = function () {
  var self = this;
  if (self.editor.textBuf.isModified()) {
    var parent = self.parent;
    var currentPaneSaveAsCloseForm = ((parent.panes || [])[parent.data.currentPane] || {}).saveAsCloseForm || {};
    if (currentPaneSaveAsCloseForm.visible) {
      currentPaneSaveAsCloseForm.once('hide', self.requestClose.bind(self));
    } else {
      self.setCurrent();
      self.saveAsCloseForm.show();
    }
    return false;
  } else {
    self.close();
    return true;
  }
};

Pane.prototype.save = function (path) {
  var self = this;
  var slap = self.screen.slap;
  var header = slap.header;
  var editor = self.editor;
  return editor.save(path, slap.fileBrowser.cwd)
    .tap(function () { header.message("saved to " + editor.textBuf.getPath(), 'success'); })
    .catch(function (err) {
      switch ((err.cause || err).code) {
        case 'EACCES': case 'EISDIR':
          header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
};

Pane.prototype._initHandlers = function () {
  var self = this;
  var editor = self.editor;
  self.on('element keypress', function (el, ch, key) {
    switch (self.resolveBinding(key)) {
      case 'save': if (!editor.readOnly()) editor.textBuf.getPath() ? self.save().done() : self.saveAsForm.show(); return false;
      case 'saveAs': if (!editor.readOnly()) self.saveAsForm.show(); return false;
      case 'close': self.requestClose(); return false;
      case 'find': self.findForm.show(); return false;
      case 'goLine': self.goLineForm.show(); return false;
    }
  });

  self.on('focus', function () {
    self.setFront();
    var formHasFocus = false;
    var visibleForms = self.forms.filter(function (form) {
      formHasFocus = formHasFocus || form.hasFocus(true);
      return form.visible;
    });
    if (!formHasFocus && visibleForms.length) visibleForms[0].focus();
  });

  self.on('close', function () { self.screen.slap.header.message(null); });
  editor.on('insertMode', function () { self.screen.slap.header.render(); });
  ['onDidChange', 'onDidChangePath'].forEach(function (prop) {
    editor.textBuf[prop](function () { self.screen.slap.header.render(); });
  });

  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

module.exports = Pane;

var Slap = require('./Slap');
var SaveAsForm = require('./SaveAsForm');
var SaveAsCloseForm = require('./SaveAsCloseForm');
var FindForm = require('./FindForm');
var GoLineForm = require('./GoLineForm');
