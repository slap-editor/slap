var fork = require('child_process').fork;
var path = require('path');

var buckets = 0;
function getBucket () { return buckets++; }

var client;
function initClient () {
  var oldMessageListeners = client ? client.listeners('message') : [];
  client = fork(path.join(__dirname, 'server.js'), {silent: false});
  client.getBucket = getBucket;
  client.on('exit', initClient);
  oldMessageListeners.forEach(client.on.bind(client, 'message'));
}
initClient();

module.exports = client;
