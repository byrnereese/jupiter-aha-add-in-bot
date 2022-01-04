const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Aha Change coelescing
exports.AhaModel = sequelize.define('changesModel', {
    id: {
	type: DataTypes.INTEGER,
	autoIncrement: true,
	primaryKey: true
    },
    ahaType:{
        type: Sequelize.STRING
    },
    ahaId:{
        type: Sequelize.STRING
    },
    data: {
        type: Sequelize.TEXT
    }
});
