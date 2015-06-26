var _ = require('lodash');

var BaseWidget = require('base-widget');
var Field = require('editor-widget').Field;
var Slap = require('./Slap');
var BaseForm = require('./BaseForm');

SaveAsForm._label = " save as: ";
function SaveAsForm (opts) {
  var self = this;

  if (!(self instanceof SaveAsForm)) return new SaveAsForm(opts);

  BaseForm.call(self, _.merge({
    field: {left: SaveAsForm._label.length}
  }, Slap.global.options.form.saveAs, opts));

  self.saveAsLabel = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    content: SaveAsForm._label,
    top: 0,
    height: 1,
    left: 0,
    width: SaveAsForm._label.length,
    style: self.options.style
  }, self.options.saveAsLabel));

  self.pathField = new Field(_.merge({
    parent: self,
    top: 0,
    left: SaveAsForm._label.length,
    right: 0
  }, Slap.global.options.editor, Slap.global.options.field, self.options.pathField));
}
SaveAsForm.prototype.__proto__ = BaseForm.prototype;

SaveAsForm.prototype._initHandlers = function () {
  var self = this;
  self.on('show', function () {
    self.pathField.textBuf.setText(self.pane.editor.textBuf.getPath() || '');
    self.pathField.selection.setHeadPosition([0, Infinity]);
    self.pathField.focus();
  });
  self.on('submit', function () {
    var path = self.pathField.textBuf.getText();
    if (!path) {
      self.screen.slap.header.message("couldn't save, no filename passed", 'error');
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
