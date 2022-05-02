const { BotConfig, ChangesModel } = require('../models/models')
const { getAhaClient, loadIdea, loadFeature, getAhaUrls } = require('../lib/aha');
const { continueSession }         = require('pg/lib/sasl');
const { Template }                = require('adaptivecards-templating');
const helloCardTemplate           = require('../adaptiveCards/helloCard.json');
const helpCardTemplate            = require('../adaptiveCards/helpCard.json');
const ideaCardTemplate            = require('../adaptiveCards/ideaCard.json');
const featureCardTemplate         = require('../adaptiveCards/featureCard.json');

const botHandler = async event => {
    console.log(event.type, 'event')
    switch (event.type) {
        case 'Message4Bot':
            await handleBotReceivedMessage(event)
            break
        case 'BotJoinGroup': // bot user joined a new group
            await handleBotJoiningGroup(event)
            break
        default:
            break
    }
}

const supportedCommands = [
    "mention",
    "hello",
    "goodbye",
    "help",
    "subscribe"
];

const handleBotJoiningGroup = async event => {
    console.log("DEBUG: received BotJoinGroup event: ", event)
    const { bot, group } = event
    if (group.type != "Everyone") {
	const template = new Template(helloCardTemplate);
	const cardData = {
	    botId: bot.id,
	    groupId: event.group.id
	};
	const card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card:", card)
	await bot.sendAdaptiveCard( group.id, card);
    } else {
	console.log("Skipping Everyone group")
    }
}

const unfurl = async ( botConfig, obj_type, obj_id ) => {
    const promise = new Promise( (resolve, reject) => {
	let token = botConfig ? botConfig.token : undefined
	let aha = getAhaClient(token, botConfig.aha_domain)
	const cardData = {
	    'botId': botConfig.botId,
	    'groupId': botConfig.groupId
	};
	switch (obj_type) {
	case 'ideas/ideas': {
	    loadIdea( aha, obj_id ).then( idea => {
		console.log("found idea: ", idea)
		idea.idea.created_at_fmt = new Date( idea.idea.created_at ).toDateString()
		if (idea.idea.created_by_user) {
		    cardData['created_by'] = idea.idea.created_by_user
		} if (idea.idea.created_by_portal_user) {
		    cardData['created_by'] = idea.idea.created_by_portal_user
		} else if (idea.idea.created_by_idea_user) {
		    cardData['created_by'] = idea.idea.created_by_idea_user
		}
		if (!cardData['created_by']['avatar_url']) {
		    cardData['created_by']['avatar_url'] = gravatar.url(cardData['created_by'].email);
		}
		cardData['idea'] = idea.idea
		const template = new Template(ideaCardTemplate);
		const card = template.expand({ $root: cardData });
		//console.log(JSON.stringify(card))
		resolve(card)
	    })
	    break
	}
	case 'features': {
	    loadFeature( aha, obj_id ).then( feature => {
		console.log("found feature: ", feature)
		feature.feature.created_at_fmt = new Date( feature.feature.created_at ).toDateString()
		cardData['feature'] = feature.feature
		if (feature.feature.created_by_user) {
		    cardData['created_by'] = feature.feature.created_by_user
		}
		cardData['facts_left'] = []
		cardData['facts_right'] = []
		if (feature.feature.assigned_to_user) {
		    cardData['facts_left'].push({ label: 'Assignee', value: feature.feature.assigned_to_user.name }) 
		}
		cardData['facts_left'].push({ label: 'Type', value: feature.feature.workflow_kind.name }) 
		cardData['facts_left'].push({ label: 'Status', value: feature.feature.workflow_status.name })

		if (feature.feature.release) {
		    cardData['facts_right'].push({ label: 'Release', value: `[${feature.feature.release.name}](${feature.feature.release.url}) on ${feature.feature.release.release_date}` }) 
		}
		if (feature.feature.master_feature) {
		    cardData['facts_right'].push({ label: 'Epic', value: `[${feature.feature.master_feature.name}](${feature.feature.master_feature.url})` })
		}
		const template = new Template(featureCardTemplate);
		const card = template.expand({ $root: cardData });
		console.log(JSON.stringify(card))
		resolve(card)
	    })
	    break
	}
	default: {
	    console.log(`Unknown object type: ${obj_type}`)
	    resolve(undefined)
	    break
	}
	}
    })
    return promise
}

const handleBotReceivedMessage = async event => {
    const { group, bot, text, userId } = event
    console.log( event )
    const botConfig = await BotConfig.findOne({
        where: { 'botId': bot.id, 'groupId': group.id }
    })
    console.log( "Message received: ", event.message.text )

    if (botConfig) {
	let aha_urls = getAhaUrls( botConfig.aha_domain, text )
	for (url of aha_urls) {
	    let obj_type = url[1]
	    let obj_id   = url[2]
	    console.log(`Loading ${obj_type} with id of ${obj_id}`)
	    unfurl( botConfig, obj_type, obj_id ).then( card => {
		if (card) {
		    bot.sendAdaptiveCard( group.id, card);
		}
	    })
	}
	const mention_re = new RegExp('^\\s*!\\[\\:Person\\]\\('+botConfig.botId+'\\)')
	if (!event.message.text.match( mention_re )) {
	    // the bot was not mentioned, so there is nothing to do
	    console.log("Bot was not mentioned. Ignoring message.")
	    return
	}
    }

    let command = text.split(' ')[0].toLowerCase()
    if (!supportedCommands.includes(command)) {
	console.log(`The command ${command} is not supported. Sending message to ${group.id}`)
        await bot.sendMessage(group.id, { text: `I am sorry, but that is not an instruction I understand.` })
	return;
    }
    
    // all commands below should be executable, even if aha_domain is not set
    if (text === "help") {
	const template = new Template(helpCardTemplate);
	const cardData = {
	    'botId': bot.id,
	    'groupId': group.id,
	    'connectedToAha': (botConfig && botConfig.token ? true : false)
	};
	const card = template.expand({ $root: cardData });
	console.log( JSON.stringify( card ) )
	await bot.sendAdaptiveCard( group.id, card);
        return
    } else if (text === 'mention') {
	console.log( event )
        await bot.sendMessage(group.id, { text: `Hello there. I am mentioning you: ![:Person](${userId}). Or a team: ![:Team](1124106246). Also all - ![:Team](-1). <a class='at_mention_compose' rel='{"id":-1}'>@Team</a>` })
    } else if (text === 'hello') {
        if (botConfig && botConfig.token) {
            await bot.sendMessage(group.id, { text: `It appears you already have an active connection to Aha in this team. To reconnect to Aha, say "goodbye" to me, then say "hello" again.` })
        } else {
            await handleBotJoiningGroup(event)
        }
	return
    } else if (text === 'goodbye') {
	// this is duplicated, other copy is in interactiveMessageHandler, consolidate
        if (botConfig) {
	    console.log("DEBUG: destroying tokens in database")
	    botConfig.destroy().then( () => {
		console.log("DEBUG: sending goodbye message")
		bot.sendMessage(group.id, {
		    text: `You have just unlinked your Aha account. Say "hello" to me, and we can start fresh.`
		})
	    })
        } else {
            bot.sendMessage(group.id, {
		text: `It does not appear you have a current connection to Aha in this team. Say "hello" to me and we can get started.`
	    })
        }
	return
    }

    // all commands below require that the aha_domain field has been set. 
    if (!botConfig || (botConfig && (!botConfig.aha_domain || botConfig.aha_domain == ""))) {
        await bot.sendMessage(group.id, { text: `The bot has been updated. You will need to reauthenticate. Please type the command "goodbye" and then "hello" to reauthenticate to Aha.` })
	return
    }
    
    let token = botConfig ? botConfig.token : undefined
    if (text.startsWith("subscribe")) {
        // TODO - persist in database that this group is subscribed to a product id
        if (token) {
            let found = text.match(/subscribe (.*)$/)
            let productCode = found[1]
            let aha = getAhaClient(token, botConfig.aha_domain)
            let server = process.env.RINGCENTRAL_CHATBOT_SERVER
	    let hookQs = `groupId=${group.id}&botId=${bot.id}`
	    let buff = new Buffer(hookQs)
	    let buffe = buff.toString('base64')
            let hookUrl = server + `/aha/webhook/${buffe}`
            let resp = aha.product.get(productCode, function (err, data, response) {
                bot.sendMessage(group.id, { text: `To receive updates in this Team from Aha:\n1. [Create a new Activity Webhook in Aha](https://${botConfig.aha_domain}.aha.io/settings/projects/${productCode}/integrations/new)\n2. In the Hook URL field, enter: ${hookUrl}\n3. Select the activities you would like to subscribe to.` })
            });
        } else {
            await bot.sendMessage(group.id, { text: `It does not appear you have a current connection to Aha in this team.` })
        }
    }
}

exports.botHandler = botHandler;
