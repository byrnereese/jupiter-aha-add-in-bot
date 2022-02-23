
/**
 * lambda file
 */
const serverlessHTTP = require('serverless-http');
const { app } = require('./index');

exports.app = serverlessHTTP(app);

