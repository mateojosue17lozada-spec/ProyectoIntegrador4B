const enviarRecuperacion = async ({ correo, nombre, token }) => {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
    const base = process.env.FRONTEND_URL || "http://localhost:5173";
    const enlace = `${base}/recuperar?token=${encodeURIComponent(token)}`;
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [correo],
            subject: "Recuperacion de contrasena",
            html: `<p>Hola ${nombre},</p><p>Utiliza el siguiente enlace para cambiar tu contrasena:</p><p><a href="${enlace}">Restablecer contrasena</a></p><p>El enlace vence en 30 minutos.</p>`
        })
    });
    if (!response.ok) throw new Error("No se pudo enviar el correo de recuperacion");
    return true;
};
module.exports = enviarRecuperacion;
