const { extendApp } = require('ringcentral-chatbot-core');
const express = require('express');
const axios = require('axios');
const { botHandler } = require('./handlers/botHandler');
const { AhaModel } = require('./models/ahaModel');

const { ahaOAuthHandler, ahaWebhookHandler } = require('./handlers/ahaHandler');

const skills = [];
const botConfig = {
    adminRoute: '/admin', // optional
    botRoute: '/bot', // optional
    models: { // optional
        AhaModel
    }
}

const app = express();
extendApp(app, skills, botHandler, botConfig);
app.listen(process.env.PORT || process.env.RINGCENTRAL_CHATBOT_EXPRESS_PORT);

console.log('server running...');
console.log(`bot oauth uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${botConfig.botRoute}/oauth`);

setInterval(() => {
    axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/admin/maintain`, undefined, {
        auth: {
            username: process.env.RINGCENTRAL_CHATBOT_ADMIN_USERNAME,
            password: process.env.RINGCENTRAL_CHATBOT_ADMIN_PASSWORD
        }
    })
    axios.put(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/ringcentral/refresh-tokens`)
}, 86400000)

app.get('/aha/oauth', async (req, res) => {
    try {
        await ahaOAuthHandler(req, res);
    }
    catch (e) {
        console.error(e);
    }
    res.status(200);
	res.send('<!doctype><html><body><script>close()</script></body></html>')
})

app.post('/aha/webhook', async (req, res) => {
    try {
        await ahaWebhookHandler(req, res);
    }
    catch (e) {
        console.error(e);
    }
    res.status(200);
	res.send('<!doctype><html><body><script>close()</script></body></html>')
})


// const cardRoute = '/interactive-messages';
// app.post(cardRoute, async (req, res) => {
//     try {
//         await cardHandler(req);
//     }
//     catch (e) {
//         console.log(e);
//     }

//     res.status(200);
//     res.json('OK');
// });
// console.log(`card interactive message uri: ${process.env.RINGCENTRAL_CHATBOT_SERVER}${cardRoute}`);
