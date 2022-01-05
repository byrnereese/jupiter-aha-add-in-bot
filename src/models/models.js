const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
const ahaModel = sequelize.define('ahaModel', {
    userId:{
        type: Sequelize.STRING,
        primaryKey: true
    },
    token:{
        type: Sequelize.STRING
    },
    groupId:{
        type: Sequelize.STRING
    },
    botId: {
        type: Sequelize.STRING
    }
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

exports.AhaModel = ahaModel;
exports.ChangesModel = changesModel;
