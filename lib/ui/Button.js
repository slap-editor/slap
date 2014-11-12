var blessed = require('blessed');
var _ = require('lazy.js');

var Slap = require('./Slap');
var BaseElement = require('./BaseElement');

var util = require('../util');

function Button (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new FileBrowser(opts);

  opts = _(Slap.global.options.button).merge({
    mouse: true,
    focusable: true,
    shrink: true,
    padding: {left: 1, right: 1}
  }).merge(opts || {}).toObject();
  opts.style.focus = opts.style.hover;
  blessed.Button.call(self, opts);
  BaseElement.call(self, opts);
}
Button.prototype.__proto__ = blessed.Button.prototype;
Button.prototype._initHandlers = function () {
  var self = this;
  self.on('keypress', function (ch, key) { if (key.name === 'enter') self.slap._stopKeyPropagation(); }); // FIXME: hack
  return BaseElement.prototype._initHandlers.apply(self, arguments);
};

module.exports = Button;
