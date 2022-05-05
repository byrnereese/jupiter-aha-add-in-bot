const { BotConfig, ChangesModel, GroupFilters }
                                    = require('../models/models')
const { getAhaClient, getAhaOAuth, ahaFieldMapping, loadIdea }
                                    = require('../lib/aha')
const { loadProducts }              = require('../lib/aha-async')
const Bot                           = require('ringcentral-chatbot-core/dist/models/Bot').default;
let   Queue                         = require('bull');
const querystring                   = require('querystring');
const { Template }                  = require('adaptivecards-templating');
const setupSubscriptionCardTemplate = require('../adaptiveCards/setupSubscriptionCard.json');
const { Op }                        = require("sequelize");

let REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let JOB_DELAY = process.env.AGGREGATION_DELAY || 1000;
let workQueue = new Queue('work', REDIS_URL);

const ahaOAuthHandler = async (req, res) => {
    const { state } = req.query
    //console.log("Received auth request for new bot install: ", req.query)
    //console.log("state = " + state)
    const [groupId, botId, userId] = state.split(':')
    console.log(`Requesting installation of bot (id:${botId}) into chat (id:${groupId}) by user (id:${userId})`)

    const bot = await Bot.findByPk(botId)
    // TODO - what if bot is null?
    console.log("bot: ", bot)

    // Bearer token in hand. Now let's stash it.
    const query = { groupId, botId }
    const botConfig = await BotConfig.findOne({ where: query })
    console.log(`Aha domain: ${botConfig.aha_domain}`)
    const ahaOAuth = getAhaOAuth( botConfig.aha_domain )
    const tokenUrl = `${process.env.RINGCENTRAL_CHATBOT_SERVER}${req.url}`;
    console.log(`Token URL: ${tokenUrl}`);
    const tokenResponse = await ahaOAuth.code.getToken(tokenUrl);
    const token = tokenResponse.data.access_token;
    console.log("Successfully obtained OAuth token")
    
    if (botConfig) {
        await botConfig.update({
            'token': token
        })
    } else {
	console.log("DEBUG: THIS SHOULD NEVER HAPPEN")
        await BotConfig.create({ ...query,
				 'token': token })
    }
    const cardData = {
	'botId': botId,
	'groupId': groupId
    };
    let aha = getAhaClient(token, botConfig.aha_domain)
    const products = await loadProducts(aha);
    console.log(`Returned from loadProducts with ${products.length} items`)
    const template = new Template(setupSubscriptionCardTemplate);
    cardData['products'] = products
    const card = template.expand({ $root: cardData });
    console.log("DEBUG: posting card to group " + groupId)
    bot.sendAdaptiveCard( groupId, card);
    return
}

const getLastPathItem = thePath => thePath.substring(thePath.lastIndexOf('/') + 1)

const execFilterOp = ( filter, matchedValue ) => {
    if (matchedValue) {
	console.log("Matched value: ", matchedValue)
	// Now you need to evaluate the operation
	console.log(`Evaluating "${filter.op}" op` )
	switch (filter.op) {
	case 'eq': {
	    if (matchedValue == filter.value) {
		console.log(`Does ${matchedValue} EQUAL ${filter.value}? Yes.` )
		return true
	    }
	    break
	}
	case 'ne': {false
	    if (matchedValue != filter.value) {
		console.log(`Does ${matchedValue} NOT EQUAL ${filter.value}? Yes.` )
		return true
	    }
	    break;
	}
	case 'contains': {
	    var re = new RegExp(filter.value, 'i');
	    if (matchedValue.match(re)) {
		console.log(`Does ${matchedValue} CONTAIN ${filter.value}? Yes.` )
		return true
	    }
	    break;
	}
	case 'not_contains': {
	    var re = new RegExp(filter.value, 'i');
	    if (!matchedValue.match(re)) {
		console.log(`Does ${matchedValue} NOT CONTAIN ${filter.value}? Yes.` )
		return true
	    }
	    break;
	}
	default: {
	    console.log(`UNKNOWN filter op: ${filter.op}` )
	}
	}
    }
    console.log("Return false from execFilterOp")
    return false
}

const evaluateFilter = ( botConfig, audit, filter ) => {
    console.log( `Evaluating ${audit.auditable_id} for filter: ${filter.field} ${filter.op} ${filter.value}` )
    let objDef = ahaFieldMapping[ filter.type ]
    if (objDef) { // fieldDef contains the field 
	//console.log( `Found filterType ${filter.type}` )
	//console.log( `Looking for field.fields.id === ${filter.field}` )
	let fieldDef = objDef.fields.filter( function(elem) {
	    //console.log( `Does ${elem.id} == ${filter.field}`)
	    return (elem.id == filter.field)
	})[0]; // fix this if you ever need to match multiple fields, unlikely
	if (fieldDef) {
	    console.log("Field def found: ", fieldDef)
	    if (fieldDef.type == "audit") {
		let matchedField = audit.changes.filter( function(elem) {
		    //console.log( `Does ${elem.field_name} == ${fieldDef.label}`)
		    return (elem.field_name === fieldDef.label)
		})
		if (matchedField && matchedField[0]) {
		    return execFilterOp( filter, matchedField[0].value )
		}
	    } else if (fieldDef.type == "object") {
		console.log(`Loading object of type ${filter.type}`)
		let token = botConfig ? botConfig.token : undefined
		let aha = getAhaClient(token, botConfig.aha_domain)
		if (filter.type == "ideas/idea") {
		    loadIdea( aha, audit.auditable_id ).then( idea => {
			console.log("Loaded idea: ", JSON.stringify(idea))
			if (filter.field == "categories") {
			    for (const cat of idea.idea.categories) {
				if ( execFilterOp( filter, cat.name ) ) { return true }
			    }
			    // TODO this is returning asynchronously after the function itself returns
			    return false
			}
		    })
		}
	    } else {
		console.log(`Unknown fieldDef.type: ${fieldDef.type}`)
	    }
	    // TODO
	}
    } else {
	console.log( "Invalid filter type" )
    }
    return true
}

const processAhaFilter = async ( botConfig, audit ) => {
    const promise = new Promise( (resolve, reject) => {
	// postgres types these as strings properly, but sqlite needs to cast them into ints, because
	// it is typeless and autodetects things that look like ints into integers no matter what
	let where = { 'botId'   : (process.env.USE_HEROKU_POSTGRES ? botConfig.botId   : { [Op.eq]: parseInt(botConfig.botId) }),
		      'groupId' : (process.env.USE_HEROKU_POSTGRES ? botConfig.groupId : { [Op.eq]: parseInt(botConfig.groupId) }),
		      'type'    : audit.auditable_type }
	console.log("Looking for filters that match: ", where)
	let sendMessage = false
	GroupFilters.findAll( { 'where': where }, { 'raw': true } ).then( (filters) => {
	    if (filters && filters.length > 0) {
		for (const filter of filters) {
		    console.log("Processing filter: ", filter )
		    /*
		    if (fieldDef.type == "object") {
			console.log(`Loading object of type ${filter.type}`)
			let token = botConfig ? botConfig.token : undefined
			let aha = getAhaClient(token, botConfig.aha_domain)
			if (filter.type == "ideas/idea") {
			    loadIdea( aha, audit.auditable_id ).then( idea => {
				console.log("Loaded idea: ", JSON.stringify(idea))
		    */
		    if ( evaluateFilter( botConfig, audit, filter ) ) {
			console.log("Returned from evaluateFilter as true. Message will be posted.")
			sendMessage = true
		    } else {
			console.log("Returned from evaluateFilter as false. No message will be posted.")
		    }
		}
		console.log("Done processing filters.")
		resolve( sendMessage )
	    } else {
		//console.log("No filters found.")
		// Resolve as true because with no filters in place, everything will
		// result in a message being sent.
		resolve( true )
	    }
	}).catch( (err) => {
	    console.log(`Error in processAhaFilter: ${err}`)
	});
    })
    return promise
}

const ahaWebhookHandler = async (req, res) => {
    let { webhookStr } = req.params;
    console.log('The encoded string is: ' + webhookStr);
    let buff = new Buffer(webhookStr, 'base64');
    let qs = buff.toString('ascii');
    const { groupId, botId } = querystring.parse(qs)
    if (typeof groupId === "undefined" || typeof botId === "undefined") {
        console.log("Received a webhook but the group and bot IDs were empty. Something is wrong.")
        // TODO - communicate this to the user so they can fix. 
        res.send('<!doctype><html><body>OK</body></html>')
        return
    }
    console.log(`Received webhook from Aha (group: ${groupId}, bot: ${botId})...`)

    console.log( "Webhook content:", req.body )
    let audit = req.body.audit
    let webhook_data = JSON.stringify(audit, null, 2);
    if (audit.description.includes('added custom field for')) {
        audit.interesting = false
    }

    const bot = await Bot.findByPk(botId)
    const botConfig = await BotConfig.findOne({ where: { 'botId': botId, 'groupId': groupId } })
    if (bot) {
        if (audit.interesting) {
	    processAhaFilter( botConfig, audit ).then( (sendMessage) => {
		if (sendMessage) {
		    console.log("No filters found, or filters present and match found. Message will be sent.")
		    let jobId = `${audit.audit_action}:${audit.auditable_id}:${audit.auditable_type}`;
		    if (audit.audit_action == "update") {
			// Aha is a really noisy webhook engine, sending lots of individual webhooks for
			// changes related to a single feature.
			// Our strategy is to create a background job that is delayed by n minutes. That
			// job will aggregate all the changes related to the same aha entity and post a
			// single card for those changes.
			
			// Step 1. Store the received change in the database.
			console.log(`Storing changes for ${audit.auditable_type}, id: ${audit.auditable_id}`)
			ChangesModel.create({
			    'ahaType' : audit.auditable_type,
			    'ahaId'   : audit.auditable_id,
			    'data'    : webhook_data
			}).then( (c) => {
			    // Step 2. Create a job if one does not already exist.
			    workQueue.getJob(jobId).then( (job) => {
				if (!job) {
				    console.log(`Creating job with delay of ${JOB_DELAY}ms: ${jobId}`);
				    workQueue.add({
					'group_id' : groupId,
					'bot_id'   : botId,
					'action'   : audit.audit_action,
					'aha_id'   : audit.auditable_id,
					'aha_type' : audit.auditable_type
				    },{
					'jobId'           : jobId,
					'delay'           : JOB_DELAY,
					'removeOnComplete': true
				    }).then( (job) => {
					console.log(`Job created: ${job.id}`);
				    })
				} else {
				    console.log(`Job already exists: ${job.id}. Skipping job creation.`);
				}
			    })
			})
			
		    } else if (audit.audit_action == "create") {
			console.log("WORKER: create action triggered. creating job...");
			workQueue.add({
			    'group_id' : groupId,
			    'bot_id'   : botId,
			    'action'   : audit.audit_action,
			    'aha_id'   : audit.auditable_id,
			    'aha_type' : audit.auditable_type,
			    'audit'    : audit
			},{
			    'jobId'           : jobId,
			    'removeOnComplete': true
			}).then( (job) => {
			    console.log(`Job created: ${job.id}`);
			})
		    }
		} else {
		    console.log("Webhook missed all filters. No message will be sent.");
		}
		console.log("Finished processing activity webhook from Aha")
	    })
        }
    }
}

// Comment from Da:
// This can be done easily with client-oauth2. Let me know when you want to do it. I can get this done in like 30min
/*
app.put('/aha/refresh-tokens', async (req, res) => {
    const services = await Service.findAll()
    for (const service of services) {
    aha.token(service.data.token)
    try {
        await rc.refresh()
    } catch (e) {
        console.error(e)
        if (e.data && /\btoken\b/i.test(e.data.message)) { // refresh token expired
        const bot = await Bot.findByPk(service.botId)
        await bot.sendMessage(service.groupId, { text: 'Authorization expired' })
        await sendAuthorizationLink({ id: service.groupId }, bot)
        await service.destroy()
        }
        continue
    }
    const token = rc.token()
    await service.update({
        data: {
        id: token.owner_id, token
        }
    })
    }
    res.send('')
})
*/

exports.ahaOAuthHandler = ahaOAuthHandler;
exports.ahaWebhookHandler = ahaWebhookHandler;
