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
        // P0001 = RAISE EXCEPTION de un trigger (p. ej. el bloqueo legal de la
        // historia clinica). El mensaje del trigger es claro; se muestra tal cual
        // en vez de un 500 "error interno".
        if (error.code === "P0001") {
            return res.status(409).json({ mensaje: error.message.replace(/^.*?:\s*/, "") });
        }
        console.error(error);
        res.status(500).json({ mensaje: "Ocurrió un error interno" });
    }
};

module.exports = responder;
