const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
exports.AhaTokens = sequelize.define('ahaTokens', {
    token:{
        type: Sequelize.STRING,
        primaryKey: true
    },
    groupId:{
        type: Sequelize.STRING
    },
    botId: {
        type: Sequelize.STRING
    },
    {
	indexes: [
	    {
		unique: true,
		fields: [ 'groupId', 'botId' ]
	    }
	    ]
    }
});
