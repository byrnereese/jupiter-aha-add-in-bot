const Aha             = require('aha-io')
const ClientOAuth2    = require('client-oauth2');
const turnDownService = require('turndown');
const turnDown        = new turnDownService();

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
	    { 'id': 'name', 'label': 'Name', 'type': 'audit' }
	    ,{ 'id': 'description', 'label': 'Description', 'type': 'audit' }
	    ,{ 'id': 'categories', 'label': 'Categories', 'type': 'object' }
	    ,{ 'id': 'workflow_status', 'label': 'Workflow status', 'type': 'audit' }
	    ,{ 'id': 'workspace', 'label': 'Workspace', 'type': 'audit' }
	    ,{ 'id': 'creator', 'label': 'Creator', 'type': 'audit' }
	    ,{ 'id': 'visibility', 'label': 'Visibility', 'type': 'audit' }
	    ,{ 'id': 'votes', 'label': 'Votes', 'type': 'audit' }
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

const loadIdea = ( aha, ideaId ) => {
    console.log(`WORKER: loading idea ${ideaId}`)
    const promise = new Promise( (resolve, reject) => {
        aha.idea.get(ideaId, function (err, data, response) {
	    if (data.idea && data.idea.description) {
		let desc = turnDown.turndown( data.idea.description.body )
		desc = desc.replace(/\s \s/g,"")
		desc = desc.replace(/\n\n/g,"\n")
		data.idea.description["body_nohtml"] = desc
	    }
            resolve( data )
        })
    })
    //console.log("WORKER: returning from loadIdea")
    return promise
}

const loadFeature = ( aha, featureId ) => {
    console.log(`WORKER: loading feature ${featureId}`)
    const promise = new Promise( (resolve, reject) => {
        aha.feature.get(featureId, function (err, data, response) {
	    console.log("DEBUG: turningdown feature:",data)
	    let desc = turnDown.turndown( data.feature.description.body )
	    desc = desc.replace(/\s \s/g,"")
	    desc = desc.replace(/\n\n/g,"\n")
	    data.feature.description["body_nohtml"] = desc
            resolve( data )
        })
    })
    //console.log("WORKER: returning from loadFeature")
    return promise
}

function uniq(a) {
   return Array.from(new Set(a));
}
function getAhaUrls( text ) {
    const link_pattern = '^https?://([^\\.]*)\\.aha.io/(.+)/((\\w+\-)+\\d+)$'
    const aha_link_re = new RegExp(link_pattern);
    const geturl_re = new RegExp(
	"((ftp|http|https|gopher|mailto|nezws|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*;/?:~-]))"
	,"g"
    )
    let aha_urls = []
    if (urls = text.match( geturl_re, 'gi')) {
	urls = uniq(urls)
	for (url of urls) {
	    if (matches = url.match( aha_link_re )) {
		aha_urls.push( matches )
	    }
	}
    }
    return aha_urls
}

exports.getAhaUrls      = getAhaUrls;
exports.loadIdea        = loadIdea;
exports.loadFeature     = loadFeature;
exports.getAhaClient    = getAhaClient;
exports.getAhaOAuth     = getAhaOAuth;
exports.ahaFieldMapping = ahaFieldMapping;
exports.ahaIdeaVisibilityMapping = ahaIdeaVisibilityMapping;
