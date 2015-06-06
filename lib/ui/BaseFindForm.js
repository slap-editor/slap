var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseForm = require('./BaseForm');
var Field = require('editor-widget').Field;

var util = require('slap-util');

function BaseFindForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseFindForm(opts);

  BaseForm.call(self, _({
      prevEditorState: {}
    })
    .merge(Slap.global.options.form.baseFind || {})
    .merge(opts || {})
    .toObject());

  self.findField = new Field(_({
    parent: self,
    top: 0,
    left: 0,
    right: 0
  }).merge(self.options.findField || {}).toObject());
}
BaseFindForm.prototype.__proto__ = BaseForm.prototype;

BaseFindForm.prototype.find = function (text, direction) {
  var self = this;
  self.slap.header.message(null);
  if (text) self.emit('find', text, direction);
  else self.resetEditor();
  return self;
};
BaseFindForm.prototype.resetEditor = function () {
  var self = this;
  var prevEditorState = self.options.prevEditorState;
  var editor = self.pane.editor;
  if (prevEditorState.selection) editor.selection.setRange(prevEditorState.selection);
  if (prevEditorState.scroll) { editor.scroll = prevEditorState.scroll; editor._updateContent(); }
};

BaseFindForm.prototype._initHandlers = function () {
  var self = this;
  var textBuf = self.findField.textBuf;
  var prevEditorState = self.options.prevEditorState;
  self.on('show', function () {
    var editor = self.pane.editor;
    if (!prevEditorState.selection) prevEditorState.selection = editor.selection.getRange();
    if (!prevEditorState.scroll) prevEditorState.scroll = editor.scroll;
    self.findField.focus();
    self.find(textBuf.getText());
  });
  self.on('hide', function () {
    if (_(self.pane.forms).pluck('visible').compact().none()) {
      prevEditorState.selection = null;
      prevEditorState.scroll = null;
    }
  });

  textBuf.on('changed', function () { self.find(textBuf.getText()); });
  self.findField.on('keypress', function (ch, key) {
    var text = textBuf.getText();
    switch (util.getBinding(self.options.bindings, key)) {
      case 'next': self.find(text, 1); return false;
      case 'prev': self.find(text, -1); return false;
    };
  });

  return BaseForm.prototype._initHandlers.apply(self, arguments);
};

module.exports = BaseFindForm;
