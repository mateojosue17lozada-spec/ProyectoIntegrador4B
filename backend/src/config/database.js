const { Pool } = require("pg");
const dns = require("dns");
require("dotenv").config();


dns.setDefaultResultOrder("ipv4first");


const pool = new Pool({

    connectionString: process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});


module.exports = pool;