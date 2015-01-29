var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseForm = require('./BaseForm');
var Field = require('./Field');

var util = require('../util');

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
BaseFindForm.prototype.resetMatches = function () {
  var self = this;
  self.pane.editor.data.matches = self.options.prevEditorState.matches;
  return self;
};
BaseFindForm.prototype.resetEditor = function () {
  var self = this;
  var prevEditorState = self.options.prevEditorState;
  var editor = self.pane.editor;
  if (prevEditorState.selection) editor.selection.setRange(prevEditorState.selection);
  if (prevEditorState.scroll) { editor.scroll = prevEditorState.scroll; editor._updateContent(); }
  return self.resetMatches();
};

BaseFindForm.prototype._initHandlers = function () {
  var self = this;
  var textBuf = self.findField.textBuf;
  var prevEditorState = self.options.prevEditorState;
  self.on('show', function () {
    var editor = self.pane.editor;
    if (!prevEditorState.selection) prevEditorState.selection = editor.selection.getRange();
    if (!prevEditorState.scroll) prevEditorState.scroll = editor.scroll;
    if (!prevEditorState.matches) prevEditorState.matches = editor.data.matches;
    self.findField.focus();
    self.find(textBuf.getText());
  });
  self.on('hide', function () {
    self.resetMatches();
    if (_(self.pane.forms).pluck('visible').compact().none()) {
      prevEditorState.selection = null;
      prevEditorState.scroll = null;
      prevEditorState.matches = null;
    }
  });
  self.on('cancel', function () { self.resetEditor(); });

  self.findField.submit = function (value) {
    // do not trigger submit event
    if (!value) self.hide();
  };
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
