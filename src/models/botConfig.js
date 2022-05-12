const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
exports.BotConfig = sequelize.define('botConfig', {
    token:      { type: Sequelize.STRING },
    groupId:    { type: Sequelize.STRING },
    botId:      { type: Sequelize.STRING },
    aha_domain: { type: Sequelize.STRING }
},
{
    indexes: [
	{
	    unique: true,
	    fields: [ 'groupId', 'botId' ]
	},
	{
	    unique: false,
	    fields: [ 'groupId', 'aha_domain' ]
	},
	{
	    unique: true,
	    fields: [ 'token' ]
	}
    ]
});
