#!/usr/bin/env node
/*global require, global*/

var fs = require('fs');

var Pane = require('../lib/ui/Pane');

module.exports = function (t) {
  return function (slap) {
    t.test("Editor", function (st) {
      var pane = new Pane();
      var editor = pane.editor;

      st.test(".open", function (sst) {
        sst.test("should open a file with perms 000 correctly", function (ssst) {
          ssst.plan(1);

          var perms000File = '/Users/dan/stuff/slap/test/fixtures/perms-000';

          // can't be checked in with 000 perms
          var originalPerms = (fs.statSync(perms000File).mode.toString(8).match(/[0-7]{3}$/) || [])[0] || '644';
          fs.chmodSync(perms000File, '000');

          editor.open(perms000File)
            .then(function () {
              ssst.equal(editor.textBuf.getText(), '');
            })
            .finally(function () { fs.chmodSync(perms000File, originalPerms); })
            .done();
        });
        sst.end();
      });
      st.end();
    });
  };
};
