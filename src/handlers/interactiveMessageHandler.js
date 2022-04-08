const { AhaTokens, ChangesModel } = require('../models/models')
const { Template }               = require('adaptivecards-templating');
const { getAhaClient }           = require('../lib/aha');

const Bot                        = require('ringcentral-chatbot-core/dist/models/Bot').default;
const subscriptionCardTemplate   = require('../adaptiveCards/subscriptionCard.json');

const interactiveMessageHandler = async req => {
    const submitData = req.body.data;
    const cardId     = req.body.card.id;

    const ahaTokens = await AhaTokens.findOne({
	where: {
	    botId: submitData.botId, groupId: submitData.groupId
	}
    })
    let token = ahaTokens ? ahaTokens.token : undefined
    let aha = getAhaClient(token)
    
    console.log(`=====incomingCardSubmit=====\n${JSON.stringify(req.body, null, 2)}`);

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
	    'ahaUrl': `https://${process.env.AHA_SUBDOMAIN}.aha.io/settings/projects/${submitData.product}/integrations/new`
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
		let comment = {
		    body: submitData.comment_text,
		    user: {
			email: resp.data.contact.email
		    }
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
