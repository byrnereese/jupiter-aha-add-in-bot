// @ts-ignore
const { Sequelize } = require('sequelize');

let config;
if (process.env.USE_HEROKU_POSTGRES) {
  config =
  {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false
      }
    }
  }
}
else {
  config =
  {
    dialect: 'postgres',
    logging: (process.env.SEQUELIZE_LOGGING_ENABLED ? console.log : false)
  }
}

const sequelize = new Sequelize(
  process.env.RINGCENTRAL_CHATBOT_DATABASE_CONNECTION_URI,
  config
)

exports.sequelize = sequelize;
