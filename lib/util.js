var _ = require('lazy.js');
var extend = require('xtend');

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
    switch (({}).toString.call(opts).slice(8, -1)) {
      default: return opts;
      case 'Array': return opts.map(util.parseOpts);
      case 'Object':
        return _(opts).pairs().map(function (pair) {
          return [pair[0], util.parseOpts(pair[1])];
        }).toObject();
      case 'String':
        var number = Number(opts);
        return opts && number === number // opts.length && !isNaN(number)
          ? number
          : opts;
    }
  }
}).toObject();

module.exports = util;
