const Aha = require('aha-io')
const { getOAuthApp } = require('./oauth')

const getAhaClient = function (token, domain) {
    return new Aha({
        token: token,
        subdomain: domain
    });
}

const ahaOAuth = getOAuthApp();

exports.getAhaClient = getAhaClient;
exports.ahaOAuth = ahaOAuth;
