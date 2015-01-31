var blessed = require('blessed');
var _ = require('lazy.js');
var Point = require('text-buffer/lib/point');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');
var BaseForm = require('./BaseForm');
var Field = require('./Field');

SaveAsForm._label = " save as: ";
function SaveAsForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new SaveAsForm(opts);

  BaseForm.call(self, _(Slap.global.options.form.saveAs)
    .merge({
      field: {left: SaveAsForm._label.length}
    })
    .merge(opts || {})
    .toObject());

  self.saveAsLabel = new BaseElement(_({
      parent: self,
      tags: true,
      content: SaveAsForm._label,
      top: 0,
      height: 1,
      left: 0,
      width: SaveAsForm._label.length,
      style: self.options.style
    })
    .merge(self.options.saveAsLabel || {})
    .toObject());

  self.pathField = new Field(_({
      parent: self,
      top: 0,
      left: SaveAsForm._label.length,
      right: 0
    })
    .merge(self.options.pathField || {})
    .toObject());
}
SaveAsForm.prototype.__proto__ = BaseForm.prototype;

SaveAsForm.prototype._initHandlers = function () {
  var self = this;
  self.on('show', function () {
    self.pathField.textBuf.setText(self.pane.editor.textBuf.getPath() || '');
    self.pathField.selection.setHeadPosition(new Point(0, Infinity));
    self.pathField.focus();
  });
  self.on('submit', function () {
    var path = self.pathField.textBuf.getText();
    if (!path) {
      self.slap.header.message("couldn't save, no filename passed", 'error');
      return;
    }
    self.pane.editor.save(path).done(function (newPath) {
      if (newPath) {
        self.hide();
        self.emit('save', newPath);
      }
    });
  });
  return BaseForm.prototype._initHandlers.apply(self, arguments);
}

module.exports = SaveAsForm;
