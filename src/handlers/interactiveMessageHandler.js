const { BotConfig, ChangesModel } = require('../models/models')
const { Template }                = require('adaptivecards-templating');
const { getAhaClient }            = require('../lib/aha');

const Bot                         = require('ringcentral-chatbot-core/dist/models/Bot').default;
const subscriptionCardTemplate    = require('../adaptiveCards/subscriptionCard.json');
const authCardTemplate            = require('../adaptiveCards/authCard.json');

const interactiveMessageHandler = async req => {
    const submitData = req.body.data;
    const cardId     = req.body.card.id;

    console.log(`=====incomingCardSubmit=====\n${JSON.stringify(req.body, null, 2)}`);
    
    // If I am authing for the first time, I need to stash the aha domain and create
    // a botConfig object
    if (submitData.actionType == "auth") {
        await BotConfig.create({
	    'botId': submitData.botId,
	    'groupId': submitData.groupId,
	    'aha_domain': submitData.aha_domain
	    // there is no token yet, so don't store it
	})
	console.log(`MESSAGING: providing developer with login url`)
	const cardData = {
            loginUrl: `https://${submitData.aha_domain}.aha.io/oauth/authorize?client_id=${process.env.AHA_CLIENT_ID}&redirect_uri=${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/oauth&response_type=code&state=${submitData.groupId}:${submitData.botId}`,
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
    const bot = await Bot.findByPk(submitData.botId);
    switch (submitData.actionType) {
    case 'setup_subscription':
	console.log(`MESSAGING: facilitating subscription process for ${submitData.product}`)
	let hookQs = `groupId=${submitData.groupId}&botId=${bot.id}`
	let buff = new Buffer(hookQs)
	let buffe = buff.toString('base64')
        let hookUrl = `${process.env.RINGCENTRAL_CHATBOT_SERVER}/aha/webhook/${buffe}`
	const cardData = {
	    'botId': submitData.botId,
	    'groupId': submitData.groupId,
	    'hookUrl': hookUrl,
	    'ahaUrl': `https://${botConfig.aha_domain}.aha.io/settings/projects/${submitData.product}/integrations/new`
	};
	const template = new Template(subscriptionCardTemplate);
	const card = template.expand({
            $root: cardData
	});
	console.log("DEBUG: posting card to group "+submitData.groupId+":", card)
	bot.sendAdaptiveCard( submitData.groupId, card);
	break;
    case 'update_idea':
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
	break;

    case 'post_idea_comment':
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
	break;
    }
}

exports.interactiveMessageHandler = interactiveMessageHandler;
