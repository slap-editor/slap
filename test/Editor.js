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
        sst.skip("should open a file with perms 000 correctly", function (ssst) {
          ssst.plan(1);
    
          var perms000File = 'fixtures/perms-000';
          fs.chmodSync(perms000File, '000'); // can't be checked in with 000 perms
          editor.open(perms000File).done(function () {
            ssst.equal(editor.textBuf.getText(), '');
          });
        });
        sst.end();
      });
      st.end();
    });
  };
};
