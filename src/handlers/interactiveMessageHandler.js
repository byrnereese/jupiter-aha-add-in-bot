const { AhaTokens, ChangesModel } = require('../models/models')
const { Template }               = require('adaptivecards-templating');
const { getAhaClient }           = require('../lib/aha');

const Bot                    = require('ringcentral-chatbot-core/dist/models/Bot').default;
const sampleTextCardTemplate = require('../adaptiveCards/sampleTextCard.json');

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
	    let comment = {
		body: submitData.comment_text,
		email: resp.data.contact.email
	    }
	    console.log(`MESSAGING: posting comment ${submitData.ideaId}:`, comment)
            aha.idea.addPublicComment(submitData.ideaId, comment, function (err, data, response) {
		console.log(`MESSAGING: posted public comment to idea`)
	    });
	});
	break;
	
    case 'update':
	// test hander - ignore this for now
        const template = new Template(sampleTextCardTemplate);
        const cardData = {
            title: 'Updated',
            text: 'This card has been updated.'
        };
        const card = template.expand({
            $root: cardData
        });
        await bot.updateAdaptiveCard(cardId, card);
        break;
    }
}

exports.interactiveMessageHandler = interactiveMessageHandler;
