#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var Promise = require('bluebird');
var through2 = require('through2');
var fs = require('fs');

var cli = require('../lib/cli');
var Slap = require('../lib/ui/Slap');

test("cli", function (t) {
  var input = through2();
  input.setRawMode = function () {};
  input.isTTY = true;

  var output = through2();
  output.isTTY = true;

  Promise.using(cli({input: input, output: output}), function (slap) {
    t.test("should create an instance of slap", function (st) {
      st.plan(1);

      st.ok(slap instanceof Slap);
    });

    require('./Editor')(t)(slap);

    return new Promise(function (resolve) { t.on('end', resolve); });
  }).done();
});
