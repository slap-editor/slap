var _ = require('lazy.js');
var extend = require('xtend');
var traverse = require('traverse');
var path = require('path');
var Promise = require('bluebird');
var mkdirp = Promise.promisify(require('mkdirp'));

var package = require('../package');

var util = _(require('util')).merge({
  clone: extend,
  extend: extend,

  toArray: function (obj) { return [].slice.call(obj); },

  mod: function (n, m) { return ((n % m) + m) % m; },

  typeOf: function (val) {
    return (val.__proto__.constructor.toString().match(/\w+\s+(\w+)/) || [])[1];
  },

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

  parseOpts: function (opts) {
    return traverse(opts).map(function (opt) {
      if (opt && typeof opt === 'string') {
        var number = Number(opt);
        if (number === number) return number; // if (!isNaN(number))
      }
      return opt;
    });
  },

  resolvePath: function (givenPath) {
    if (!givenPath) givenPath = '';
    if (givenPath[0] === '~') {
      givenPath = path.join(process.platform !== 'win32'
        ? process.env.HOME
        : process.env.USERPROFILE
      , givenPath.slice(1));
    }
    return path.resolve.apply(null, [].slice.call(arguments, 1).concat([givenPath]));
  },

  getUserDir: function () {
    var userDir = util.resolvePath('~/.' + package.name);
    return mkdirp(userDir).return(userDir);
  },

  getBinding: function (bindings, key) {
    return _(bindings)
      .map(function (keyBindings, name) {
        keyBindings = _(typeof keyBindings !== 'string' ? keyBindings : [keyBindings]);
        if ([key.full, key.sequence].some(keyBindings.contains.bind(keyBindings)))
          return name;
      })
      .compact()
      .first();
  }
}).toObject();

module.exports = util;
