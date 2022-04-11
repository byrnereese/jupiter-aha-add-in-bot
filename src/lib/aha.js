const Aha = require('aha-io')
const { getOAuthApp } = require('./oauth')

const getAhaClient = function (token, domain) {
    return new Aha({
        token: token,
        subdomain: domain
    });
}

const getAhaOAuth = function ( domain ) {
    getOAuthApp(domain);
}

exports.getAhaClient = getAhaClient;
exports.getAhaOAuth  = getAhaOAuth;
