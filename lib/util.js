var _ = require('lazy.js');
var extend = require('xtend');
var traverse = require('traverse');

var util = _(require('util')).merge({
  clone: extend,
  extend: extend,

  toArray: function (obj) { return [].slice.call(obj); },

  getterSetter: function (name, getter, setter) {
    getter = getter || _.identity;
    setter = setter || _.identity;
    return function () {
      if (arguments.length) {
        var newVal = setter.apply(this, arguments);
        this.data[name] = newVal;
        this.emit && this.emit(name, getter.call(this, newVal));
        return this;
      } else {
        return getter.call(this, this.data[name]);
      }
    };
  },

  getBinding: function (bindings, key) {
    return _(bindings)
      .map(function (keyBindings, name) {
        keyBindings = typeof keyBindings !== 'string' ? keyBindings : [keyBindings];
        if (_(keyBindings).contains(key.full)) return name;
      })
      .compact()
      .first();
  },

  parseOpts: function (opts) {
    return traverse(opts).map(function (opt) {
      if (opt && typeof opt === 'string') {
        var number = Number(opt);
        if (number === number) return number; // if (!isNaN(number))
      }
      return opt;
    });
  },

  shrinkWidth: function (el) {
    return el.content.length + el.iwidth;
  }
}).toObject();

module.exports = util;
