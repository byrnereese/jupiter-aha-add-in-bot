const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
exports.AhaModel = sequelize.define('ahaModel', {
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
