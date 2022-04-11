const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

exports AccountConfig = sequelize.define('accountConfigModel', {
    accountId:{
        type: Sequelize.STRING,
        primaryKey: true
    },
    domain:{
        type: Sequelize.STRING
    }
});
