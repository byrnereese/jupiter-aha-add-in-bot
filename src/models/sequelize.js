const {Sequelize} = require('sequelize');

const sequelize = new Sequelize(
  process.env.RINGCENTRAL_CHATBOT_DATABASE_CONNECTION_URI,
  {
    define: {
      timestamps: true,
    },
    logging: false,
  }
);

exports.sequelize = sequelize;