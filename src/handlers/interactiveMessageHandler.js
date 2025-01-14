const { BotConfig, GroupFilters, ChangesModel }
                                    = require('../models/models')
const { getAhaClient, ahaFieldMapping }
                                    = require('../lib/aha');
const { Template }                  = require('adaptivecards-templating');
const { loadProducts }              = require('../lib/aha-async')

const Bot                           = require('ringcentral-chatbot-core/dist/models/Bot').default;
const subscriptionCardTemplate      = require('../adaptiveCards/subscriptionCard.json');
const authCardTemplate              = require('../adaptiveCards/authCard.json');
const helloCardTemplate             = require('../adaptiveCards/helloCard.json');
const setupSubscriptionCardTemplate = require('../adaptiveCards/setupSubscriptionCard.json');
const filterCardTemplate            = require('../adaptiveCards/filterCard.json');
const filterTypeCardTemplate        = require('../adaptiveCards/filterTypeCard.json');
const listFiltersCardTemplate       = require('../adaptiveCards/listFiltersCard.json');

const handleHelloAction = (cardData) => {
    const promise = new Promise( (resolve, reject) => {
	const template = new Template(helloCardTemplate);
	const card = template.expand({ $root: cardData });
	resolve( card )
    })
    return promise
}

const handleAuthAction = (config, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	cardData['loginUrl'] = `https://${config.aha_domain}.aha.io/oauth/authorize?client_id=${process.env.AHA_CLIENT_ID}&redirect_uri=${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/oauth&response_type=code&state=${cardData.groupId}:${cardData.botId}:${cardData.userId}`
	const template = new Template(authCardTemplate);
	const card = template.expand({ $root: cardData });
	resolve( card )
    })
    return promise
}

const handleSelectFilterTypeAction = (cardData) => {
    const promise = new Promise( (resolve, reject) => {
	let template = new Template(filterTypeCardTemplate);
	cardData['objects'] = Object.keys(ahaFieldMapping).map(
	    (key) => ({'id': key, 'label': ahaFieldMapping[key]['label']})
	);
	let card = template.expand({ $root: cardData });
	resolve( card )
    })
    return promise
}

const handleSetFilterAction = (submitData, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	let template = new Template(filterCardTemplate);
	let fields = ahaFieldMapping[ submitData.filter_type ]['fields']
	cardData['fields'] = fields
	cardData['operations'] = [
            { "label": "equals",            "opcode": "eq" }
            ,{ "label": "not equals",       "opcode": "ne" }
            ,{ "label": "contains",         "opcode": "contains" }
            ,{ "label": "does not contain", "opcode": "not_contains" }
	];
	    
	GroupFilters.findOne({
            where: { 'botId': submitData.botId, 'groupId': submitData.groupId, 'type': submitData.filter_type },
	    raw: true
	}).then( (filter) => {
	    if (filter) {
		cardData['filter'] = filter
	    } else {
		cardData['filter'] = {
		    type: submitData.filter_type,
		    op: '',
		    field: '',
		    value: '',
		} 
	    }
	    let card = template.expand({ $root: cardData });
	    resolve( card )
	}).catch( (err) => {
	    console.log("ERROR: GroupFilter error: ", err)
	})
    })
    return promise
}

const handleListFiltersAction = (submitData, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	GroupFilters.findAll({
	    where: { 'botId': submitData.botId, 'groupId': submitData.groupId },
	    raw: true
	}).then( (filters) => {
	    cardData['filters'] = filters
	    console.log("filters: ", filters)
	    let template = new Template(listFiltersCardTemplate);
	    let card = template.expand({ $root: cardData })
	    resolve( card )
	})
    })
    return promise
}

async function updateOrCreate (model, where, newItem) {
    // First try to find the record
   const foundItem = await model.findOne({where});
   if (!foundItem) {
        // Item not found, create a new one
        const item = await model.create(newItem)
        return  {item, created: true};
    }
    // Found an item, update it
    const item = await model.update(newItem, {where});
    return {item, created: false};
}

const handleSaveFilterAction = (submitData, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	const where = {
	    'botId':   submitData.botId,
	    'groupId': submitData.groupId,
	    'type':    submitData.filter_type
	};
	console.log("Looking for filter with this criteria: ", where)
	const newObj = {
	    'botId':   submitData.botId,
	    'groupId': submitData.groupId,
	    'type':    submitData.filter_type,
	    'field': submitData.filter_field,
	    'op':    submitData.filter_op,
	    'value': submitData.filter_value
	};
	console.log("Updating filter with these values: ", newObj)
	updateOrCreate( GroupFilters, where, newObj  ).then( (filter, is_new) => {
	    cardData['filterId'] = filter.id
	    handleListFiltersAction( submitData, cardData ).then( (card) => {
		resolve(card)
	    })
	}).catch( (err) => {
	    console.log( err )
	})
    })
    return promise
}

const handleDeleteFilterAction = (submitData, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	GroupFilters.findOne({ 'id':   submitData.filterId }).then( (filter) => {
	    filter.destroy().then( () => {
		handleListFiltersAction( submitData, cardData ).then( (card) => {
		    resolve(card)
		})
	    })
	}).catch( (err) => {
	    console.log( err )
	})
    })
    return promise
}

const handleSelectWorkspaceAction = (aha, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	loadProducts( aha ).then( products => {
            cardData['products'] = products
            let template = new Template(setupSubscriptionCardTemplate);
            let card = template.expand({ $root: cardData });
            resolve(card)
	})
    })
    return promise
}

const handleSetupSubscriptionAction = (config, submitData, cardData) => {
    const promise = new Promise( (resolve, reject) => {
	console.log(`MESSAGING: facilitating subscription process for ${submitData.product}`)
	let hookQs = `groupId=${submitData.groupId}&botId=${submitData.botId}`
	//console.log(`MESSAGING: encoding querystring: ${hookQs}`)
	let buff = new Buffer(hookQs)
	let buffe = buff.toString('base64')
	//console.log(`MESSAGING: encoded querystring is ${buffe}`)
        let hookUrl = `${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/webhook/${buffe}`
	cardData['hookUrl'] = hookUrl
	cardData['ahaUrl'] = `https://${config.aha_domain}.aha.io/settings/projects/${submitData.product}/integrations/new`
	const template = new Template(subscriptionCardTemplate);
	const card = template.expand({ $root: cardData });
	resolve( card )
    })
    return promise
}

const buildDialog = function( title, size, card ) {
    let dialog = {
	"type": "dialog",
	"dialog": {
	    "title": title,
	    "size": size,
	    "iconUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/2048px-Instagram_icon.png",
	    "card": card
	}
    }
    return dialog
}

const interactiveMessageHandler = async (req,res) => {
    console.log(`=====incomingCardSubmit=====\n${JSON.stringify(req.body, null, 2)}`);
    // TODO - implement flow - if user submitting card has not authed with Aha,
    //        prompt them to login and store aha token for the user
    // Q: are extension IDs globally unique? I doubt it. 
    // TODO - do we need the bot Id in submitData? Does the webhook contain that info?
    const submitData = req.body.data;
    const cardId     = req.body.card.id;
    const bot        = await Bot.findByPk(submitData.botId); 
    // TODO - we have the cardId, so let's replace cards as we go through flows
    
    // If I am authing for the first time, I need to stash the aha domain and create
    // a botConfig object
    let cardData = {
        'botId': submitData.botId,
        'groupId': submitData.groupId,
	'userId': req.body.user.id
    }
    //console.log(`cardData=`,cardData)
    let botConfig = await BotConfig.findOne({
        where: { 'botId': submitData.botId, 'groupId': submitData.groupId }
    })
    // if you have gotten this far, this means that the bot is fully setup, and an aha domain has
    // been stored for the bot. That means we can make calls to Aha! So, load the token and proceed.
    switch (submitData.actionType) {
    case 'auth': {
	if (!botConfig) {
	    console.log("DEBUG: botConfig is not set. Initializing...")
            botConfig = await BotConfig.create({
		'botId': submitData.botId,
		'groupId': submitData.groupId,
		'aha_domain': submitData.aha_domain
		// there is no token yet, so don't store it, just store the domain
	    })
	}
	if (!botConfig.aha_domain) {
	    console.log("DEBUG: botConfig is set, but aha_domain is not. Initializing...")
	    botConfig.aha_domain = submitData.aha_domain
	    await botConfig.save()
	}
	handleAuthAction( botConfig, cardData ).then( card => {
	    console.log(`DEBUG: posting auth dialog:`, card)
	    let dialog = buildDialog('Connect to Aha','Medium', card)
	    res.setHeader('Content-Type', 'application/json');
	    res.end(JSON.stringify(dialog))
	    //console.log(`DEBUG: sending auth card:`, card)
	    //bot.sendAdaptiveCard( submitData.groupId, card);
	})
	break;
    }
    case 'hello': {
	console.log(`MESSAGING: prompting user to enter Aha domain for auth`);
	handleHelloAction( cardData ).then( card => {
	    //console.log("DEBUG: posting card to group "+submitData.groupId+":", JSON.stringify(card))
	    //bot.sendAdaptiveCard( submitData.groupId, card);
	    /*
	    let dialog = {
		"type": "dialog",
		"dialog": {
		    "title": "iFrame (2) Dialog Example",
		    "size": "Medium",
		    "iconUrl": "https://www.kindpng.com/picc/m/255-2554719_a-generic-square-placeholder-image-with-rounded-corners.png",
		    "iframeUrl": "https://www.google.com"
		}
	    };
	    */
	    console.log(`DEBUG: opening hello dialog with card: `, card)
	    let dialog = buildDialog('Connect to Aha','Medium', card)
	    res.status(200);
	    res.setHeader('Content-Type', 'application/json');
	    //console.log( JSON.stringify(dialog) )
	    res.end( JSON.stringify(dialog) )
	})
	break;
    }
    case 'disconnect': {
        if (botConfig) {
	    console.log("DEBUG: destroying tokens in database")
	    botConfig.destroy().then( () => {
		bot.sendMessage(submitData.groupId, {
		    text: `You have just unlinked your Aha account. Say "hello" to me, and we can start fresh.`
		})
	    })
        } else {
            bot.sendMessage(submitData.groupId, {
		text: `It does not appear you have a current connection to Aha in this team. Say "hello" to me and we can get started.`
	    })
        }
	break
    }
    case 'select_filter_type': {
	console.log(`MESSAGING: selecting a filter type`);
	handleSelectFilterTypeAction( cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	    bot.sendAdaptiveCard( submitData.groupId, card);
	})
	break;
    }
    case 'set_filter': {
	console.log(`MESSAGING: setting up a filter for ${submitData.filter_type}`);
	handleSetFilterAction( submitData, cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	    bot.sendAdaptiveCard( submitData.groupId, card);
	})
	break;
    }
    case 'save_filter': {
	console.log(`MESSAGING: saving filter for ${submitData.filter_type}`);
	handleSaveFilterAction( submitData, cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", JSON.stringify(card))
	    bot.sendAdaptiveCard( submitData.groupId, card);
	});
	break;
    }
    case 'delete_filter': {
	console.log(`MESSAGING: deleting filter for ${submitData.filterId}`);
	handleDeleteFilterAction( submitData, cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", JSON.stringify(card))
	    bot.sendAdaptiveCard( submitData.groupId, card);
	});
	break;
    }
    case 'list_filters': {
	console.log(`MESSAGING: listing filters`);
	handleListFiltersAction( submitData, cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", JSON.stringify(card))
	    bot.sendAdaptiveCard( submitData.groupId, card);
	});
	break;
    }
    case 'select_workspace': {
	let token = botConfig ? botConfig.token : undefined
	let aha = getAhaClient(token, botConfig.aha_domain)
	//console.log(cardData)
	handleSelectWorkspaceAction( aha, cardData ).then( card => {
            console.log("DEBUG: posting card to group "+submitData.groupId+":", JSON.stringify(card))
            bot.sendAdaptiveCard( submitData.groupId, card);
	}).catch( err => {
	    console.log("Something went wrong: ",err)
	})
	break
    }
    case 'setup_subscription': {
	handleSetupSubscriptionAction( botConfig, submitData, cardData ).then( card => {
	    console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	    bot.sendAdaptiveCard( submitData.groupId, card);
	})
	break
    }
    case 'update_idea': {
	// user updated an idea
	let token = botConfig ? botConfig.token : undefined
	let aha = getAhaClient(token, botConfig.aha_domain)
	let update_data = {
	    name: submitData.idea_name,
	    description: submitData.idea_description,
	    workflow_status: submitData.idea_status,
	    visibility: submitData.idea_visibility,
	    categories: submitData.idea_category
	}
	console.log(`MESSAGING: updating ${submitData.ideaId}:`, update_data)
        aha.idea.update(submitData.ideaId, update_data, function (err, data, response) {
	    console.log(`MESSAGING: updated idea`)
	});
	break
    }
    case 'post_idea_comment': {
	// user updated an idea
	let token = botConfig ? botConfig.token : undefined
	let aha = getAhaClient(token, botConfig.aha_domain)
	bot.rc.get(`/restapi/v1.0/account/${req.body.user.accountId}/extension/${req.body.user.extId}`).then( function( resp ) {
	    if (submitData.comment_privacy == "public") {
		let comment = {
		    body: submitData.comment_text,
		    email: resp.data.contact.email
		}
		console.log(`MESSAGING: posting public comment ${submitData.ideaId}:`, comment)
		aha.idea.addPublicComment(submitData.ideaId, comment, function (err, data, response) {
		    console.log(`MESSAGING: posted public comment to idea`)
		});
	    } else {
		let poster = resp.data.contact.firstName + " " + resp.data.contact.lastName
		let comment_body = submitData.comment_text + "<p><i>Comment posted by AhaBot on behalf of " + poster + "</i></p>"
		let comment = {
		    body: comment_body,
		    user: resp.data.contact.email
		}
		console.log(`MESSAGING: posting private comment ${submitData.ideaId}:`, comment)
		aha.idea.addPrivateComment(submitData.ideaId, comment, function (err, data, response) {
		    console.log(`MESSAGING: posted private comment to idea`)
		});
	    }
	});
	break
    }
    }
}

exports.interactiveMessageHandler = interactiveMessageHandler;
