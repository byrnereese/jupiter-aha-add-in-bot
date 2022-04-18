const { BotConfig, ChangesModel } = require('../models/models')
const { getAhaClient }            = require('../lib/aha');
const { continueSession }         = require('pg/lib/sasl');
const { Template }                = require('adaptivecards-templating');
const gettingStartedCardTemplate  = require('../adaptiveCards/gettingStartedCard.json');
const helpCardTemplate            = require('../adaptiveCards/helpCard.json');

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

const handleBotJoiningGroup = async event => {
    console.log("DEBUG: received BotJoinGroup event: ", event)
    const { bot, group } = event
    if (group.type != "Everyone") {
	const template = new Template(gettingStartedCardTemplate);
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

const handleBotReceivedMessage = async event => {
    const { group, bot, text, userId } = event
    const botConfig = await BotConfig.findOne({
        where: { 'botId': bot.id, 'groupId': group.id }
    })

    // all commands below should be executable, even if aha_domain is not set
    if (text === "help") {
	const template = new Template(helpCardTemplate);
	const cardData = {
	    'botId': bot.id,
	    'groupId': group.id
	};
	const card = template.expand({ $root: cardData });
	console.log("DEBUG: posting help card:", card)
	await bot.sendAdaptiveCard( group.id, card);
        return
    } else if (text === 'hello') {
        if (botConfig && botConfig.token) {
            await bot.sendMessage(group.id, { text: `It appears you already have an active connection to Aha in this team. To reconnect to Aha, say "goodbye" to me, then say "hello" again.` })
        } else {
            await handleBotJoiningGroup(event)
        }
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
