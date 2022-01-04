const { extendApp } = require('ringcentral-chatbot-core');
const express       = require('express');
const axios         = require('axios');
let Queue           = require('bull');

const { botHandler }   = require('./handlers/botHandler');
const { AhaModel }     = require('./models/ahaModel');
const { ChangesModel } = require('./models/changesModel')
const { ahaOAuthHandler, ahaWebhookHandler } = require('./handlers/ahaHandler');

let PORT = process.env.PORT || '5000';
let REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let workQueue = new Queue('work', REDIS_URL);

const skills = [];
const botConfig = {
    adminRoute: '/admin', // optional
    botRoute: '/bot', // optional
    models: { // optional
        AhaModel,
        ChangesModel
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

// You can listen to global events to get notified when jobs are processed
workQueue.on('global:completed', (jobId, result) => {
  console.log(`Job (${jobId}) completed with result ${result}`);
});

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
