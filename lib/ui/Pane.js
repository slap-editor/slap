var blessed = require('blessed');
var _ = require('lazy.js');

var BaseElement = require('./BaseElement');

var util = require('../util');

function Pane (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new Pane(opts);

  BaseElement.call(self, _({
      hidden: true,
      top: 1,
      left: 0,
      right: 0,
      bottom: 0
    })
    .merge(Slap.global.options.pane || {})
    .merge(opts || {})
    .toObject());
  self.left = self.slap.fileBrowser.visible ? self.slap.fileBrowser.width : 0;

  self.forms = self.forms || [];

  self.editor = self.options.editor || new Editor({
    parent: self,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  });

  self.findForm = new FindForm({parent: self});
  self.goLineForm = new GoLineForm({parent: self});
  self.saveAsForm = new SaveAsForm({parent: self});
  self.saveAsCloseForm = new SaveAsCloseForm({parent: self});
}
Pane.prototype.__proto__ = BaseElement.prototype;

Pane.prototype.close = function () {
  var self = this;
  var slap = self.slap;
  var paneIndex = slap._paneIndex(self);
  self.detach();
  slap.panes.splice(paneIndex, 1);
  if (slap.panes.length) {
    slap.currentPane(Math.max(paneIndex - 1, 0));
  } else {
    slap.fileBrowser.focus();
  }
  self.emit('close');
  return self;
};
Pane.prototype.requestClose = function () {
  var self = this;
  if (self.editor.isUnsaved()) {
    var currentPaneSaveAsCloseForm = self.slap.currentPane().saveAsCloseForm;
    if (currentPaneSaveAsCloseForm.visible) {
      currentPaneSaveAsCloseForm.once('hide', self.requestClose.bind(self));
    } else {
      self.slap.currentPane(self);
      self.saveAsCloseForm.show();
    }
    return false;
  } else {
    self.close();
    return true;
  }
};

Pane.prototype._initHandlers = function () {
  var self = this;
  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'save': self.editor.path() ? self.editor.save().done() : self.saveAsForm.show(); return false;
      case 'saveAs': self.saveAsForm.show(); return false;
      case 'close': self.requestClose(); return false;
      case 'find': self.findForm.show(); return false;
      case 'goLine': self.goLineForm.show(); return false;
    }
  });

  self.on('show', function () {
    self.setFront();
    self.focus();
  });
  self.on('focus', function () {
    var formHasFocus = false;
    var visibleForms = self.forms.filter(function (form) {
      formHasFocus = formHasFocus || form.hasFocus(true);
      return form.visible;
    });
    if (!formHasFocus && visibleForms.length) visibleForms[0].focus();
  });

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = Pane;

var Slap = require('./Slap');
var Editor = require('./Editor');
var SaveAsForm = require('./SaveAsForm');
var SaveAsCloseForm = require('./SaveAsCloseForm');
var FindForm = require('./FindForm');
var GoLineForm = require('./GoLineForm');
