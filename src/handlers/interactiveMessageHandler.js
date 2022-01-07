const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { Template } = require('adaptivecards-templating');
const sampleTextCardTemplate = require('../adaptiveCards/sampleTextCard.json');
const interactiveMessageHandler = async req => {
    const submitData = req.body.data;
    const cardId = req.body.card.id;
    console.log(`=====incomingCardSubmit=====\n${JSON.stringify(req.body, null, 2)}`);
    const bot = await Bot.findByPk(submitData.botId);
    switch (submitData.actionType) {
        case 'update':
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