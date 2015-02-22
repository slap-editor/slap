var Promise = require('bluebird');
var blessed = require('blessed');
var _ = require('lazy.js');
var Point = require('text-buffer/lib/point');

var Slap = require('./Slap');

var util = require('../util');

function BaseElement (opts) {
  var self = this;

  if (!(self instanceof blessed.Node)) return new BaseElement(opts);

  opts = _(Slap.global.options.element).merge(opts || {}).toObject();
  if (!('slap' in opts)) opts.slap = Slap.global;
  if (!('parent' in opts)) opts.parent = opts.slap;
  if (self instanceof BaseElement) blessed.Box.call(self, opts); // this should not be called if an element inherits from built-in blessed classes
  if (self.parent instanceof Pane) self.pane = self.parent;
  self.slap = opts.slap;
  self.focusable = opts.focusable;

  self.ready = util.nextTick()
    .then(function () { return self._initHandlers(); })
    .return(self);
}
BaseElement.prototype.__proto__ = blessed.Box.prototype;

BaseElement.prototype.walkDepthFirst = function (direction, after, fn) {
  if (arguments.length === 2) fn = after;
  var children = this.children.slice();
  if (direction === -1) children.reverse();
  if (after) children = children.slice(children.indexOf(after) + 1);
  return children.some(function (child) {
    return fn.apply(child, arguments) || BaseElement.prototype.walkDepthFirst.call(child, direction, fn);
  });
};
BaseElement.prototype.focusFirst = function (direction, after) {
  return this.walkDepthFirst(direction, after, function () {
    if (this.visible && this.focusable) {
      this.focus();
      return true;
    }
  });
};
BaseElement.prototype._focusDirection = function (direction) {
  var self = this;
  var descendantParent;
  var descendant = self.screen.focused;
  while (descendant.hasAncestor(self)) {
    descendantParent = descendant.parent;
    if (BaseElement.prototype.focusFirst.call(descendantParent, direction, descendant)) return self;
    descendant = descendantParent;
  }
  if (!self.focusFirst(direction)) throw new Error("no focusable descendant");
  return self;
};
BaseElement.prototype.focusNext = function () {
  return this._focusDirection(1);
};
BaseElement.prototype.focusPrev = function () {
  return this._focusDirection(-1);
};
BaseElement.prototype.focus = function () {
  if (!this.hasFocus()) return blessed.Box.prototype.focus.apply(this, arguments);
  return this;
};
BaseElement.prototype.isAttached = function () {
  return this.hasAncestor(this.screen);
};
BaseElement.prototype.hasFocus = function (asChild) {
  var self = this;
  var focused = self.screen.focused;
  return focused.visible && (focused === self || focused.hasAncestor(self) || (asChild && self.hasAncestor(focused)));
};

BaseElement.prototype.pos = function () {
  return new Point(this.top + this.itop, this.left + this.ileft);
};
BaseElement.prototype.size = function () {
  if (!this.isAttached()) return new Point(0, 0); // hack
  return new Point(this.height - this.iheight, this.width - this.iwidth);
};

BaseElement.prototype.shrinkWidth = function () { return this.content.length + this.iwidth; };

BaseElement.prototype._initHandlers = function () {
  var self = this;
  self.on('focus', function () {
    logger.debug('focus', util.typeOf(self));
    if (!self.focusable) self.focusNext();
  });
  self.on('blur', function () { logger.debug('blur', util.typeOf(self)); });
  self.on('show', function () { self.setFront(); });
  self.on('keypress', _.noop); // 'element keypress' doesn't work correctly without this
  self.on('element keypress', function (el, ch, key) {
    switch (util.getBinding(self.options.bindings, key)) {
      case 'hide': self.hide(); return false;
      case 'focusNext': self.focusNext(); return false;
      case 'focusPrev': self.focusPrev(); return false;
    }
  });
};

module.exports = BaseElement;

var Pane = require('./Pane'); // circular import
