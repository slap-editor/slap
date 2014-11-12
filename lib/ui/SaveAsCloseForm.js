var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var SaveAsForm = require('./SaveAsForm');
var Button = require('./Button');

var markup = require('../markup');

function SaveAsCloseForm (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new SaveAsCloseForm(opts);

  SaveAsForm.call(self, _(Slap.global.options.saveAsCloseForm).merge(opts || {}).toObject());

  self.discardChangesButton = new Button(_({
      parent: self,
      content: "Discard changes",
      top: 0,
      right: 0
    })
    .merge(Slap.global.options.button.warning || {})
    .merge(self.options.discardChangesButton || {})
    .toObject());
}
SaveAsCloseForm.prototype.__proto__ = SaveAsForm.prototype;

SaveAsCloseForm.prototype._initHandlers = function () {
  var self = this;
  self.on('show', function () { self.slap.header.message("unsaved changes, please save or discard", 'warning'); });
  self.on('save', function () { self.pane.close(); });
  self.on('discardChanges', function () { self.pane.close(); });
  self.discardChangesButton.on('press', function () { self.emit('discardChanges'); });
  return SaveAsForm.prototype._initHandlers.apply(self, arguments);
}

module.exports = SaveAsCloseForm;
