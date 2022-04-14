const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for storing filtering preferences
exports.GroupFilters = sequelize.define('groupFilters', {
    groupId: { type: Sequelize.STRING },
    botId:   { type: Sequelize.STRING },
    type:    { type: Sequelize.STRING },
    field:   { type: Sequelize.STRING },
    op:      { type: Sequelize.STRING },
    value:   { type: Sequelize.STRING }
},
{
    indexes: [
	{
	    unique: false,
	    fields: [ 'groupId', 'botId' ]
	},
	{
	    unique: true,
	    fields: [ 'groupId','botId','type' ]
	}
    ]
});


