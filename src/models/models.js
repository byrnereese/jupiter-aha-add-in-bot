const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
const botConfig = sequelize.define('botConfig', {
    token:{
        type: Sequelize.STRING
    },
    groupId:{
        type: Sequelize.STRING
    },
    botId: {
        type: Sequelize.STRING
    },
    aha_domain: {
        type: Sequelize.STRING
    }
},
{
    indexes: [
	{
	    unique: true,
	    fields: [ 'groupId', 'botId' ]
	},
	{
	    unique: true,
	    fields: [ 'token' ]
	}
    ]
});

// Model for Aha Change coelescing
const changesModel = sequelize.define('changesModel', {
    ahaType:{
        type: Sequelize.STRING
    },
    ahaId:{
        type: Sequelize.STRING
    },
    data: {
        type: Sequelize.TEXT
    }
  },{
    indexes: [
	{
	    name: 'jobId',
	    fields: ['ahaType','ahaId']
	}
    ]
});

exports.BotConfig = botConfig;
exports.ChangesModel = changesModel;
