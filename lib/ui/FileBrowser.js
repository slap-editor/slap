var blessed = require('blessed');
var _ = require('lazy.js');

var util = require('../util');

function FileBrowser (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FileBrowser(opts);

  blessed.FileManager.call(self, _({
    keys: true,
    mouse: true
  }).merge(opts || {}).toObject());
  self.refresh();

  self.on('element mousedown', function (el) { self.focus(); });

  var originalSelectedStyle = self.style.selected;
  self.on('focus', function () {
    self.style.selected = self.style.originalSelected || originalSelectedStyle;
  });
  function hideSelected () {
    self.style.originalSelected = self.style.selected;
    self.style.selected = self.style.item;
  };
  self.on('blur', hideSelected); hideSelected();
}
FileBrowser.prototype.__proto__ = blessed.FileManager.prototype;

module.exports = FileBrowser;
