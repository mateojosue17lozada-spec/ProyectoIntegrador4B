require("dotenv").config();
const email = require("../utils/email");

email.verificarConfiguracion()
    .then(({ user, service }) => {
        console.log(`Correo configurado correctamente: ${user} (${service})`);
    })
    .catch((error) => {
        console.error(`Configuración de correo inválida: ${error.message}`);
        process.exitCode = 1;
    });
