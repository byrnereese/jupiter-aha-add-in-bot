const ClientOAuth2 = require('client-oauth2');

// oauthApp strategy is default to 'code' which use credentials to get accessCode,
// then exchange for accessToken and refreshToken.
// To change to other strategies, please refer to:
// https://github.com/mulesoft-labs/js-client-oauth2
function getOAuthApp(domain){
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

exports.getOAuthApp = getOAuthApp;
