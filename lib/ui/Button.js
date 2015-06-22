var blessed = require('blessed');
var _ = require('lazy.js');

var util = require('slap-util');

var BaseWidget = require('base-widget');
var Slap = require('./Slap');

function Button (opts) {
  var self = this;

  if (!(self instanceof Button)) return new Button(opts);

  opts = _(Slap.global.options.button).merge({
    mouse: true,
    focusable: true,
    shrink: true,
    padding: {left: 1, right: 1}
  }).merge(opts || {}).toObject();
  opts.style.focus = opts.style.hover;
  BaseWidget.blessed.Button.call(self, opts);
  BaseWidget.call(self, opts);
}
Button.prototype.__proto__ = BaseWidget.blessed.Button.prototype;
Button.prototype._initHandlers = function () {
  var self = this;
  self.on('keypress', function (ch, key) {
    if (key.name === 'enter') self.screen.slap._stopKeyPropagation().done(); // FIXME: hack
  });
  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

module.exports = Button;
