#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
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

  cli({input: input, output: output})
    .tap(require('./Editor')(t))
    .done(function (slap) {
      t.test("should create an instance of slap", function (st) {
        st.plan(1);

        st.ok(slap instanceof Slap);
      });
      slap.quit();
    });
});
