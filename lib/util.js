var _ = require('lazy.js');
var extend = require('xtend');
var traverse = require('traverse');
var path = require('path');
var Promise = require('bluebird');
var mkdirp = Promise.promisify(require('mkdirp'));
var fs = require('fs');

var package = require('../package');

var boolStrings = {true: true, false: false};

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
        if (opt in boolStrings) return boolStrings[opt];

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
  
  extractCoordsFromPath: function (givenPath) {
    var regex = {
      
      // Determine pattern: [path_file_name_file_ext]:[X][:Y]
      findPath: new RegExp('^(.+\\..+\\D)(:\\d+:?\\d+?)$', 'g'),
      
      // Determine patern: [path]/[file_name].[file_ext]:[X][:Y]
      findCoords: new RegExp('^(.*\\/)?(\\w+)(\\.\\w*)?:(\\d+:?\\d+?)$', 'g')
    };
    var result = {
      extractable: false,
      cleanPath: null,
      coords: null
    };

    if (givenPath.match(regex.findPath)) {
      result.coords = givenPath.replace(regex.findCoords, '$4')
        .split(/:/g)
        .map(function (n) { return parseInt(n, 10); })
        .filter(Boolean);

      result.cleanPath = givenPath.replace(regex.findPath, '$1');

      try {
        result.extractable = fs.statSync(result.cleanPath).isFile();
      } catch (err) {
        result.extractable = false;
      }
    }
    
    return result;
  },

  getUserDir: function () {
    var userDir = util.resolvePath('~/.' + package.name);
    return mkdirp(userDir).return(userDir);
  },

  getBinding: function (bindings, key) {
    for (var name in bindings) {
      if (bindings.hasOwnProperty(name)) {
        var keyBindings = bindings[name];
        if (!keyBindings) continue;
        if (typeof keyBindings === 'string') keyBindings = [keyBindings];
        if (keyBindings.some(function (binding) { return binding === key.full || binding === key.sequence; }))
          return name;
      }
    }
  }
}).toObject();

module.exports = util;
