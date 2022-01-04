const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Aha Change coelescing
exports.ChangesModel = sequelize.define('changesModel', {
/*
    id: {
	type: Sequelize.INTEGER,
	autoIncrement: true,
	primaryKey: true
    },
*/
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
