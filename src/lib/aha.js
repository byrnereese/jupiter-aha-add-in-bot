const Aha = require('aha-io')
const { getOAuthApp } = require('./oauth')

const getAhaClient = function (token) {
    return new Aha({
        token: token,
        subdomain: process.env.AHA_SUBDOMAIN
    });
}

const ahaOAuth = getOAuthApp();

exports.getAhaClient = getAhaClient;
exports.ahaOAuth = ahaOAuth;
