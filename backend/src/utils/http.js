const responder = (handler, status = 200) => async (req, res) => {
    try {
        const data = await handler(req);
        res.status(status).json(data);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ mensaje: error.message });
        if (error.code === "23505") return res.status(409).json({ mensaje: "El registro ya existe" });
        if (error.code === "23503") return res.status(409).json({ mensaje: "La operacion afecta registros relacionados" });
        if (["23502","23514","22P02"].includes(error.code)) {
            return res.status(400).json({ mensaje: error.detail || "Datos incompletos o invalidos" });
        }
        console.error(error);
        res.status(400).json({ mensaje: error.message || "No se pudo completar la operacion" });
    }
};

module.exports = responder;
