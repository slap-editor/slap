var _ = require('lodash');

var util = require('slap-util');

var BaseWidget = require('base-widget');

Pane.prototype.__proto__ = BaseWidget.prototype;
function Pane (opts) {
  var self = this;

  if (!(self instanceof Pane)) return new Pane(opts);

  BaseWidget.call(self, _.merge({
    top:    Slap.global.header.options.headerPosition === 'top'    ? 1 : 0,
    bottom: Slap.global.header.options.headerPosition === 'bottom' ? 1 : 0,
    left: 0,
    right: 0,
  }, Slap.global.options.pane, opts));
  self.left = Slap.global.fileBrowser.visible ? Slap.global.fileBrowser.width : 0;

  if (!self.parent.panes) self.parent.panes = [];
  self.parent.panes.push(self);
}

Pane.prototype.setCurrent = function () {
  var self = this;
  var slap = self.screen.slap;
  var panes = slap.panes;
  var paneIndex = panes.indexOf(self);
  if (paneIndex === -1) { paneIndex = panes.length; panes.push(self); }
  self.ready
    .then(function () {
      if (!self.isAttached()) return;
      slap.data.currentPane = paneIndex;
      self.focus();
    })
    .done();
  return self;
};
Pane.prototype.close = function () {
  var self = this;
  self.detach();

  var slap = self.screen.slap;
  var paneIndex = slap.panes.indexOf(self);
  if (paneIndex !== -1) {
    slap.panes.splice(paneIndex, 1);
    if (slap.panes.length) slap.panes[Math.max(paneIndex - 1, 0)].setCurrent();
    else slap.fileBrowser.focus();
  }

  self.emit('close');
  return true;
};

Pane.prototype._initHandlers = function () {
  var self = this;

  self.on('close', function () { self.screen.slap.header.message(null); });

  return BaseWidget.prototype._initHandlers.apply(self, arguments);
};

module.exports = Pane;

var Slap = require('./Slap');
