const { BotConfig, ChangesModel }   = require('../models/models')
const { Template }                  = require('adaptivecards-templating');
const { getAhaClient }              = require('../lib/aha');
const { loadProducts }              = require('../lib/aha-async')

const Bot                           = require('ringcentral-chatbot-core/dist/models/Bot').default;
const subscriptionCardTemplate      = require('../adaptiveCards/subscriptionCard.json');
const authCardTemplate              = require('../adaptiveCards/authCard.json');
const setupSubscriptionCardTemplate = require('../adaptiveCards/setupSubscriptionCard.json');
const filterCardTemplate            = require('../adaptiveCards/filterCard.json');
const filterTypeCardTemplate        = require('../adaptiveCards/filterTypeCard.json');

const interactiveMessageHandler = async req => {
    const submitData = req.body.data;
    const cardId     = req.body.card.id;
    const bot        = await Bot.findByPk(submitData.botId);

    console.log(`=====incomingCardSubmit=====\n${JSON.stringify(req.body, null, 2)}`);
    
    // If I am authing for the first time, I need to stash the aha domain and create
    // a botConfig object
    if (submitData.actionType == "auth") {
	let botConfig = await BotConfig.findOne({
            where: { 'botId': submitData.botId, 'groupId': submitData.groupId }
	})
	if (!botConfig) {
            await BotConfig.create({
		'botId': submitData.botId,
		'groupId': submitData.groupId,
		'aha_domain': submitData.aha_domain
		// there is no token yet, so don't store it
	    })
	}
	console.log(`MESSAGING: providing developer with login url`)
	const cardData = {
            loginUrl: `https://${submitData.aha_domain}.aha.io/oauth/authorize?client_id=${process.env.AHA_CLIENT_ID}&redirect_uri=${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/oauth&response_type=code&state=${submitData.groupId}:${submitData.botId}:${req.body.user.id}`,
	    botId: submitData.botId,
	    groupId: submitData.groupId
	};
	const template = new Template(authCardTemplate);
	const card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	bot.sendAdaptiveCard( submitData.groupId, card);
	return
    }

    // if you have gotten this far, this means that the bot is fully setup, and an aha domain has
    // been stored for the bot. That means we can make calls to Aha! So, load the token and proceed.
    const botConfig = await BotConfig.findOne({
	where: { botId: submitData.botId, groupId: submitData.groupId }
    })
    let token = botConfig ? botConfig.token : undefined
    let aha = getAhaClient(token, botConfig.aha_domain)
    let cardData = {
        'botId': submitData.botId,
        'groupId': submitData.groupId
    }
    switch (submitData.actionType) {
    case 'select_filter_type': {
	console.log(`MESSAGING: selecting a filter type`);
	let template = new Template(filterTypeCardTemplate);
	let card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	bot.sendAdaptiveCard( submitData.groupId, card);
	break;
    }
    case 'set_filter': {
	console.log(`MESSAGING: selecting a filter type`);
	let template = new Template(filterCardTemplate);
	cardData['filterType'] = submitData.filter_type
	let card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	bot.sendAdaptiveCard( submitData.groupId, card);
	break;
    }
    case 'disconnect': {
        if (botConfig) {
	    console.log("DEBUG: destroying tokens in database")
	    await botConfig.destroy()
            await bot.sendMessage(submitData.groupId, {
		text: `You have just unlinked your Aha account. Say "hello" to me, and we can start fresh.`
	    })
        } else {
            await bot.sendMessage(submitData.groupId, {
		text: `It does not appear you have a current connection to Aha in this team. Say "hello" to me and we can get started.`
	    })
        }
	break
    }
    case 'select_workspace': {
	loadProducts( aha ).then( records => {
            console.log("DEBUG: product list is: ", records)
            // TODO - add HOWTO video to card
            let template = new Template(setupSubscriptionCardTemplate);
            cardData['products'] = records.products
            let card = template.expand({
		$root: cardData
            });
            console.log("DEBUG: card data:", cardData)
            console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
            bot.sendAdaptiveCard( submitData.groupId, card);
            return
	})
	break
    }
    case 'setup_subscription': {
	console.log(`MESSAGING: facilitating subscription process for ${submitData.product}`)
	let hookQs = `groupId=${submitData.groupId}&botId=${bot.id}`
	let buff = new Buffer(hookQs)
	let buffe = buff.toString('base64')
        let hookUrl = `${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/webhook/${buffe}`
	cardData['hookUrl'] = hookUrl
	cardData['ahaUrl'] = `https://${botConfig.aha_domain}.aha.io/settings/projects/${submitData.product}/integrations/new`
	const template = new Template(subscriptionCardTemplate);
	const card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	bot.sendAdaptiveCard( submitData.groupId, card);
	break
    }
    case 'update_idea': {
	// user updated an idea
	let update_data = {
	    name: submitData.idea_name,
	    description: submitData.idea_description,
	    workflow_status: submitData.idea_status,
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
	bot.rc.get(`/restapi/v1.0/account/${req.body.user.accountId}/extension/${req.body.user.extId}`).then( function( resp ) {
	    //let respj = resp.json()
	    console.log("MESSAGING: got poster info", resp)
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
