module.exports = (error, req, res, next) => { // eslint-disable-line no-unused-vars
    const statuses = { "23505": 409, "23503": 409, "23502": 400, "23514": 400, "22P02": 400 };
    const status = error.status || statuses[error.code] || 500;
    let message = error.message;
    if (error.code === "23505") message = "El registro ya existe";
    if (error.code === "23503") message = "La operación afecta registros relacionados";
    if (["23502", "23514", "22P02"].includes(error.code)) message = "Datos incompletos o inválidos";

    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, error);
    }

    res.status(status).json({
        mensaje: status >= 500 ? "Ocurrió un error interno" : message
    });
};
