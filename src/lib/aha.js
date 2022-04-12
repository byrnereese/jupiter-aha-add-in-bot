const Aha          = require('aha-io')
const ClientOAuth2 = require('client-oauth2');

const getAhaClient = function (token, domain) {
    return new Aha({
        token: token,
        subdomain: domain
    });
}

const getAhaOAuth = function ( domain ) {
    var ahaAuth = new ClientOAuth2({
	clientId:         process.env.AHA_CLIENT_ID,
	clientSecret:     process.env.AHA_CLIENT_SECRET,
	redirectUri:      `${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/oauth`,
	accessTokenUri:   `https://${domain}.aha.io/oauth/token`,
	authorizationUri: `https://${domain}.aha.io/oauth/authorize?client_id=${process.env.AHA_CLIENT_ID}&redirect_uri=${process.env.RINGCENTRAL_CHATBOT_SERVER}/bot/oauth&response_type=code`,
	scopes: ''
    });
    return ahaAuth
}

exports.getAhaClient = getAhaClient;
exports.getAhaOAuth  = getAhaOAuth;
