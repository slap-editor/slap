var blessed = require('blessed');
var _ = require('lazy.js');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');

function FileBrowser (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FileBrowser(opts);

  opts = _(Slap.global.options.fileBrowser).merge({
    focusable: true
  }).merge(opts || {}).toObject();
  BaseWidget.call(self, opts);
  blessed.FileManager.call(self, _({
    keys: true,
    mouse: true
  }).merge(opts).toObject());
  self.refresh();
  self.data.selectedStyle = self.style.selected;
  self.data.itemStyle = self.style.item;
}
FileBrowser.prototype.__proto__ = blessed.FileManager.prototype;

FileBrowser.prototype._initHandlers = function () {
  var self = this;
  self.on('element mousedown', function (el) { self.focus(); });
  self.on('file', function (path) { Slap.global.open(path, true).done(); });
  self.on('cancel', function () {
    var slap = Slap.global;
    var currentPane = slap.panes[slap.data.currentPane];
    if (currentPane) currentPane.focus();
  });

  self.on('focus', function () {
    self.style.selected = self.data.selectedStyle;
    self.screen.program.hideCursor();
  });
  self.on('blur', function () {
    self.style.selected = self.data.itemStyle;
  });

  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

module.exports = FileBrowser;
