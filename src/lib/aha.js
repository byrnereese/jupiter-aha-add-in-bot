const Aha          = require('aha-io')
const ClientOAuth2 = require('client-oauth2');

const ahaIdeaVisibilityMapping = {
    'Not visible in portals': 'aha',
    'Visible to creator': 'creator',
    'Visible to internal users': 'employee',
    'Visible to all': 'public'
}

const ahaFieldMapping = {
    'ideas/idea': {
	'label': 'Ideas',
	'fields': [
	    { 'id': 'name', 'label': 'Name' }
	    ,{ 'id': 'description', 'label': 'Description' }
	    ,{ 'id': 'categories', 'label': 'Categories' }
	    ,{ 'id': 'workflow_status', 'label': 'Workflow status' }
	    ,{ 'id': 'workspace', 'label': 'Workspace' }
	    ,{ 'id': 'creator', 'label': 'Creator' }
	    ,{ 'id': 'visibility', 'label': 'Visibility' }
	    ,{ 'id': 'votes', 'label': 'Votes' }
	]
    },
    /*
    'ideas/idea_comment': {
	'label': 'Idea comment (public)',
	'fields': {
	}
    },
    'comment': {
	'label': 'Idea comment (private)',
	'fields': {
	}
    },
    */
    'features': {
	'label': 'Features',
	'fields': [
	    { 'id': 'name', 'label': 'Name' }
	    ,{ 'id': 'workflow_status', 'label': 'Workflow status' }
	    ,{ 'id': 'creator', 'label': 'Created by user' }
	    ,{ 'id': 'release', 'label': 'Release' }
	    ,{ 'id': 'workspace', 'label': 'Workspace' }
	    ,{ 'id': 'type', 'label': 'Type' }
	]
    },
    'epic': {
	'label': 'Master Features/Epics',
	'fields': [
	    { 'id': 'name', 'label': 'Name' }
	    ,{ 'id': 'workflow_status', 'label': 'Workflow status' }
	    ,{ 'id': 'workspace', 'label': 'Workspace' }
	    ,{ 'id': 'description', 'label': 'Description' }
	    ,{ 'id': 'release', 'label': 'Release' }
	]
    }
};

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

exports.getAhaClient    = getAhaClient;
exports.getAhaOAuth     = getAhaOAuth;
exports.ahaFieldMapping = ahaFieldMapping;
exports.ahaIdeaVisibilityMapping = ahaIdeaVisibilityMapping;
