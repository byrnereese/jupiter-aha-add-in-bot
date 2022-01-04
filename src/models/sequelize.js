const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.RINGCENTRAL_CHATBOT_DATABASE_CONNECTION_URI,
    {
	dialect: 'postgres',
	protocol: 'postgres',
	dialectOptions: {
	    ssl: {
		rejectUnauthorized: false
	    }
	},
	pool: {
	    max: 5,
	    min: 0,
	    acquire: 30000,
	    idle: 10000
	}
    }
);

exports.sequelize = sequelize;
