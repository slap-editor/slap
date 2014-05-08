var blessed = require('blessed');
var _ = require('lazy.js');

var BaseForm = require('./BaseForm');
var Field = require('./Field');

var util = require('../util');

function BaseFindForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseFindForm(opts);

  BaseForm.call(self, opts);
  var prevEditorState = self.options.prevEditorState;
  self.on('show', function () {
    if (!prevEditorState.selection) prevEditorState.selection = self.parent.editor.select();
    if (!prevEditorState.scroll) prevEditorState.scroll = self.parent.editor.scroll();
    if (!prevEditorState.matches) prevEditorState.matches = self.parent.editor.data.matches;
    self.findField.focus();
    self.find(self.findField.text());
  });
  self.on('hide', function () {
    if (!self.findField.text()) self.resetEditor();
    else self.resetMatches();

    if (self.otherForms.pluck('visible').compact().none()) {
      prevEditorState.selection = null;
      prevEditorState.scroll = null;
      prevEditorState.matches = null;
    }
  });

  self.findField = new Field(_({
    parent: self,
    top: 0,
    left: 0,
    right: 0
  }).merge(opts.field || {}).merge(opts.findField || {}).toObject());
  self.findField.submit = function (value) {
    // do not trigger submit event
    if (!value) self.hide();
  };
  self.findField.on('text', function (text) { self.find(text); });
  self.findField.on('keypress', function (ch, key) {
    var text = self.findField.text();
    switch (util.getBinding(self.options.bindings, key)) {
      case 'next': self.find(text, 1); break;
      case 'prev': self.find(text, -1); break;
    };
  });
}
BaseFindForm.prototype.__proto__ = BaseForm.prototype;

BaseFindForm.prototype.find = function (text, direction) {
  var self = this;
  self.parent.header.message(null);
  if (text) self.emit('find', text, direction);
  else self.resetEditor();
  return self;
};
BaseFindForm.prototype.resetMatches = function () {
  var self = this;
  self.parent.editor.data.matches = self.options.prevEditorState.matches;
  return self;
};
BaseFindForm.prototype.resetEditor = function () {
  var self = this;
  var prevEditorState = self.options.prevEditorState;
  var editor = self.parent.editor;
  if (prevEditorState.selection) editor.select(prevEditorState.selection);
  if (prevEditorState.scroll) editor.scroll(prevEditorState.scroll);
  return self.resetMatches();
};

module.exports = BaseFindForm;
