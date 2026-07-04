const responderError = (res, error, fallback = "No se pudo completar la operacion") => {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    if (error.code === "23505") {
        const campo = error.constraint?.includes("cedula") ? "cedula" : "dato unico";
        return res.status(409).json({ mensaje: `Ya existe un registro con esa ${campo}` });
    }
    if (error.code === "23503") {
        return res.status(409).json({ mensaje: "El registro esta relacionado con otros datos y no puede eliminarse" });
    }
    if (["23502", "23514", "22P02"].includes(error.code)) {
        return res.status(400).json({ mensaje: error.detail || "Datos incompletos o invalidos" });
    }
    return res.status(500).json({ mensaje: fallback });
};

module.exports = responderError;
