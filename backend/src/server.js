require("dotenv").config();


const app = require("./app");
const ensureSchema = require("./config/ensureSchema");
const validateEnv = require("./config/validateEnv");


const PORT = process.env.PORT || 3000;


const iniciarServidor = async () => {
    try {
        validateEnv();
        await ensureSchema();
        app.listen(PORT, () => {
            console.log(`Servidor corriendo puerto ${PORT}`);
        });
    } catch (error) {
        console.error("No se pudo iniciar el servidor:", error.message);
        process.exit(1);
    }
};

iniciarServidor();
