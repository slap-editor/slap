#!/usr/bin/env node
/*global require, global*/

var test = require('tape');
var Promise = require('bluebird');
var util = require('base-widget/spec/util');
global.Promise = Promise; // FIXME: for pathwatcher

var cli = require('../lib/cli');
var Slap = require('../lib/ui/Slap');

test("cli", function (t) {
  Promise.using(cli({screen: util.screenFactory()}), function (slap) {
    t.test("should create an instance of slap", function (st) {
      st.plan(1);

      st.ok(slap instanceof Slap);
    });

    return new Promise(function (resolve) { t.on('end', resolve); });
  }).done();
});
