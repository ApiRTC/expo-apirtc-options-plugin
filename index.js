const { withPlugin } = require('./build/withPlugin');

module.exports = function (config, props) {
  return withPlugin(config, props);
};