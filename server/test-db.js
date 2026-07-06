const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client
  .connect()
  .then(() => {
    console.log("Connected!");
    return client.end();
  })
  .catch((err) => {
    console.error(err);
  });
