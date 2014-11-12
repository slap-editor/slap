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
  self.refresh();
}
FileBrowser.prototype.__proto__ = blessed.FileManager.prototype;

FileBrowser.prototype._initHandlers = function () {
  var self = this;
  self.on('element mousedown', function (el) { self.focus(); });
  self.on('file', function (path) { self.slap.open(path, true).done(); });
  self.on('cancel', function () { self.slap.currentPane().focus(); });

  var originalSelectedStyle = self.style.selected;
  self.on('focus', function () {
    self.style.selected = self.style.originalSelected || originalSelectedStyle;
    self.screen.program.hideCursor();
  });
  function hideSelected () {
    self.style.originalSelected = self.style.selected;
    self.style.selected = self.style.item;
  };
  self.on('blur', hideSelected); hideSelected();

  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = FileBrowser;
