var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');

var util = require('../util');

function FileBrowser (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FileBrowser(opts);

  opts = _(Slap.global.options.fileBrowser).merge({
    focusable: true
  }).merge(opts || {}).toObject();
  BaseElement.call(self, opts);
  blessed.FileManager.call(self, _({
    keys: true,
    mouse: true
  }).merge(opts).toObject());

  // Add hover text to filenames that are too long for the panel:
  self.on('refresh', function() {
    for (var i = 0; i < self.items.length; i++) {
      if (self.items[i].getText().length > self.items[i].width) {
        self.items[i].setHover(self.items[i].getContent());
      } else {
        self.items[i].removeHover();
      }
    }
  });

  self.refresh();
  self.data.selectedStyle = self.style.selected;
  self.data.itemStyle = self.style.item;
}
FileBrowser.prototype.__proto__ = blessed.FileManager.prototype;

FileBrowser.prototype._initHandlers = function () {
  var self = this;
  self.on('element mousedown', function (el) { self.focus(); });
  self.on('file', function (path) { self.slap.open(path, true).done(); });
  self.on('cancel', function () {
    var slap = self.slap;
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

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = FileBrowser;
