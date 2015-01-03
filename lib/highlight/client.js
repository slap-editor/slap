var fork = require('child_process').fork;
var path = require('path');
var minimist = require('rc/node_modules/minimist');

var buckets = 0;
function getBucket () { return buckets++; }

var forkOpts = {silent: false};
if (minimist(process.execArgv).debug) forkOpts.execArgv = ['--debug=5859'];

var client;
function initClient () {
  var oldMessageListeners = client ? client.listeners('message') : [];
  client = fork(path.join(__dirname, 'server.js'), forkOpts);
  client.getBucket = getBucket;
  client.setMaxListeners(100);
  client.on('exit', initClient);
  oldMessageListeners.forEach(client.on.bind(client, 'message'));
}
initClient();

module.exports = client;
