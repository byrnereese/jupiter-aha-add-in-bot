const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
exports.GroupFilters = sequelize.define('groupFilters', {
    groupId:{ type: Sequelize.STRING },
    botId: { type: Sequelize.STRING },
    type: { type: Sequelize.STRING },
    op: { type: Sequelize.STRING },
    value: { type: Sequelize.STRING }
},
{
    indexes: [
	{
	    unique: true,
	    fields: [ 'groupId', 'botId' ]
	},
	{
	    unique: false,
	    fields: [ 'groupId','token','type' ]
	}
    ]
});


