var blessed = require('blessed');
var _ = require('lodash');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');

function FileBrowser (opts) {
  var self = this;

  if (!(self instanceof FileBrowser)) return new FileBrowser(opts);

  opts = _.merge({
    keys: true,
    mouse: true,
    focusable: true
  }, Slap.global.options.fileBrowser, opts);
  BaseWidget.blessed.FileManager.call(self, opts);
  BaseWidget.call(self, opts);

  self.refresh();
  self.data.selectedStyle = self.style.selected;
  self.data.itemStyle = self.style.item;
}
FileBrowser.prototype.__proto__ = BaseWidget.blessed.FileManager.prototype;

FileBrowser.prototype._initHandlers = function () {
  var self = this;
  var slap = self.screen.slap;
  self.on('element mousedown', function (el) { self.focus(); });
  self.on('file', function (path) { slap.open(path, true).done(); });
  self.on('cancel', function () {
    var currentPane = slap.getCurrentPane();
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
