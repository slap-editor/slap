var fork = require('child_process').fork;
var path = require('path');
var minimist = require('rc/node_modules/minimist');
var getRandomPort = require('get-random-port');
var Promise = require('bluebird');

var init = Promise.resolve();
var opts = minimist(process.execArgv);
var forkOpts = {silent: false};
if (['debug', 'debug-brk'].some(function (opt) { return opt in opts; })) {
  init = init
	  .then(getRandomPort)
	  .then(function (port) { forkOpts.execArgv = ['--debug=' + port]; });
}

var client;
function initClient () {
  var oldMessageListeners = client ? client.listeners('message') : [];
  client = fork(path.join(__dirname, 'server.js'), forkOpts);
  client.setMaxListeners(100);
  client.on('exit', initClient);
  oldMessageListeners.forEach(client.on.bind(client, 'message'));
  return client;
}

init = init.then(initClient);

module.exports = init;

var buckets = 0;
module.exports.getBucket = function () { return buckets++; };
