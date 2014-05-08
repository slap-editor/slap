var blessed = require('blessed');
var _ = require('lazy.js');

var BaseDialog = require('./BaseDialog');

function UnsavedChangesDialog (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new UnsavedChangesDialog(opts);

  BaseDialog.call(self, _({
    content: "There are unsaved changes. Are you sure you want to quit?"
  }).merge(opts || {}).toObject());

  self.cancelButton = blessed.Button({
    content: "Cancel",
    mouse: true,
    input: true,
    bottom: 1,
    right: 1,
    shrink: true,
    padding: {left: 1, right: 1},
    style: {focus: {bg: 'blue'}, hover: {bg: 'blue'}}
  });

  var saveChangesButtonRight = self.padding.right + self.cancelButton.content.length + self.cancelButton.iwidth + 1;
  self.saveChangesButton = blessed.Button({
    content: "Save changes",
    mouse: true,
    input: true,
    bottom: 1,
    right: saveChangesButtonRight,
    shrink: true,
    padding: {left: 1, right: 1},
    style: {focus: {bg: 'green'}, hover: {bg: 'green'}}
  });

  var quitAnywayButtonRight = saveChangesButtonRight + self.saveChangesButton.content.length + self.saveChangesButton.iwidth + 1;
  self.quitAnywayButton = blessed.Button({
    content: "Quit anyway",
    mouse: true,
    input: true,
    bottom: 1,
    right: quitAnywayButtonRight,
    shrink: true,
    padding: {left: 1, right: 1},
    style: {focus: {bg: 'yellow'}, hover: {bg: 'yellow'}}
  });

  // Append in this order for proper tab cycle order
  self.append(self.quitAnywayButton);
  self.append(self.saveChangesButton);
  self.append(self.cancelButton);

  self.on('show', function () { self.cancelButton.focus(); });
  var saveAsForm = self.parent.saveAsForm;
  var quit = function () { self.parent.quit(); };
  self.saveChangesButton.on('press', function () {
    saveAsForm.show();
    saveAsForm.on('save', quit);
    saveAsForm.on('hide', saveAsForm.removeListener.bind(saveAsForm, 'save', quit));
  });
  self.quitAnywayButton.on('press', quit);
}
UnsavedChangesDialog.prototype.__proto__ = BaseDialog.prototype;

module.exports = UnsavedChangesDialog;
