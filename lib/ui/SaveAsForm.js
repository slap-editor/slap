var blessed = require('blessed');
var _ = require('lazy.js');

var BaseForm = require('./BaseForm');
var Field = require('./Field');

var markup = require('../markup');

SaveAsForm._label = " save as: ";
function SaveAsForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new SaveAsForm(opts);

  BaseForm.call(self, _({
    field: {left: SaveAsForm._label.length}
  }).merge(opts || {}).toObject());

  self.saveLabel = new blessed.Box({
    parent: self,
    tags: true,
    content: markup(SaveAsForm._label, opts.style),
    top: 0,
    height: 1,
    left: 0,
    width: SaveAsForm._label.length
  });

  self.pathField = new Field(_(opts.field || {}).merge({
    parent: self,
    top: 0,
    left: SaveAsForm._label.length,
    right: 0
  }).toObject());

  self.on('show', function () {
    self.pathField
      .text(self.parent.path() || '')
      .cursor({x: Infinity, y: 0})
      .focus();
  });
  self.on('submit', function () {
    self.parent.save(self.pathField.text()).done(function (newPath) {
      if (newPath) self.emit('save', newPath);
    });
  });
}
SaveAsForm.prototype.__proto__ = BaseForm.prototype;

module.exports = SaveAsForm;
