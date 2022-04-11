const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
const ahaTokens = sequelize.define('ahaTokens', {
//    userId:{
//        type: Sequelize.STRING,
//        primaryKey: true
//    },
    token:{
        type: Sequelize.STRING,
        primaryKey: true
    },
    groupId:{
        type: Sequelize.STRING
    },
    botId: {
        type: Sequelize.STRING
    }
},
{
    indexes: [
	{
	    unique: true,
	    fields: [ 'groupId', 'botId' ]
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

// Model for storing account config information
const accountConfig = sequelize.define('accountConfigModel', {
    accountId:{
        type: Sequelize.STRING,
        primaryKey: true
    },
    domain:{
        type: Sequelize.STRING
    }
});

exports.AhaTokens = ahaTokens;
exports.ChangesModel = changesModel;
exports.AccountConfig = accountConifg;
