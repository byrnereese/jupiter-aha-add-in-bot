const { AhaTokens, ChangesModel } = require('../models/models')
const { getAhaClient }    = require('../lib/aha');
const { getOAuthApp }     = require('../lib/oauth');
const { continueSession } = require('pg/lib/sasl');

const { Template } = require('adaptivecards-templating');
const gettingStartedCardTemplate = require('../adaptiveCards/gettingStartedCard.json');

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
    const template = new Template(gettingStartedCardTemplate);
    const cardData = {
        loginUrl: `https://${process.env.AHA_SUBDOMAIN}.aha.io/oauth/authorize?client_id=${process.env.AHA_CLIENT_ID}&redirect_uri=${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/oauth&response_type=code&state=${group.id}:${bot.id}`
    };
    const card = template.expand({
        $root: cardData
    });
    console.log("DEBUG: posting card:", card)
    await bot.sendAdaptiveCard( group.id, card);
}

const handleBotReceivedMessage = async event => {
    const { group, bot, text, userId } = event
    const ahaTokens = await AhaTokens.findOne({
        where: {
            'botId': bot.id, 'groupId': group.id
        }
    })

    if (text === "help") {
        await bot.sendMessage(group.id, { text: `Here are the commands I am able to respond to:\n* **hello** - restart the setup process in this team\n* **goodbye** - disconnect from your Aha account\n* **subscribe <product ID>** - pass in the three letter product id and get directions on how to start receiving notifications for changes in that product` })
        return
    }

    let token = ahaTokens ? ahaTokens.token : undefined
    if (text === 'hello') {
        if (token) {
            await bot.sendMessage(group.id, { text: `It appears you already have an active connection to Aha in this team.` })
        } else {
            await handleBotJoiningGroup(event)
        }

    } else if (text === 'goodbye') {
        if (token) {
	    console.log("DEBUG: destroying tokens in database")
	    await ahaTokens.destroy()
            await bot.sendMessage(group.id, { text: `You have just unlinked your Aha account. Say "hello" to me, and we can start fresh.` })
        } else {
            await bot.sendMessage(group.id, { text: `It does not appear you have a current connection to Aha in this team. Say "hello" to me and we can get started.` })
        }

    } else if (text.startsWith("subscribe")) {
        // TODO - persist in database that this group is subscribed to a product id
        if (token) {
            let found = text.match(/subscribe (.*)$/)
            let productCode = found[1]
            let aha = getAhaClient(token)
            let server = process.env.RINGCENTRAL_CHATBOT_SERVER
            let hookUrl = server + `/aha/webhook?groupId=${group.id}&botId=${bot.id}`
            let resp = aha.product.get(productCode, function (err, data, response) {
                bot.sendMessage(group.id, { text: `To receive updates in this Team from Aha:\n1. [Create a new Activity Webhook in Aha](https://${process.env.AHA_SUBDOMAIN}.aha.io/settings/projects/${productCode}/integrations/new)\n2. In the Hook URL field, enter: ${hookUrl}\n3. Select the activities you would like to subscribe to.` })
            });
        } else {
            await bot.sendMessage(group.id, { text: `It does not appear you have a current connection to Aha in this team.` })
        }
    }
}

exports.botHandler = botHandler;
