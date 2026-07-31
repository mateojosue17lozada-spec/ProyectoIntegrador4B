const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const contenidoRecuperacion = ({ nombre, token }) => {
    const base = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const enlace = `${base}/recuperar?token=${encodeURIComponent(token)}`;
    const nombreSeguro = escapeHtml(nombre || "usuario");

    return {
        enlace,
        subject: "Restablece tu contraseña - Óptica Integral",
        text: `Hola ${nombre || "usuario"}. Restablece tu contraseña desde ${enlace}. El enlace vence en 30 minutos. Si no solicitaste este cambio, ignora este mensaje.`,
        html: `
        <div style="background:#f2f7f8;padding:32px 16px;font-family:Arial,sans-serif;color:#173447">
          <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce8ec;border-radius:16px;overflow:hidden">
            <div style="background:#08263b;padding:24px 28px;color:#fff">
              <div style="font-size:20px;font-weight:700">Óptica Integral</div>
              <div style="font-size:12px;color:#a9c7d4;margin-top:4px">Seguridad de cuenta</div>
            </div>
            <div style="padding:30px 28px">
              <h1 style="font-size:22px;margin:0 0 14px">Restablece tu contraseña</h1>
              <p style="line-height:1.6">Hola ${nombreSeguro}, recibimos una solicitud para cambiar tu contraseña.</p>
              <p style="margin:26px 0;text-align:center">
                <a href="${enlace}" style="display:inline-block;background:#087f75;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700">Crear nueva contraseña</a>
              </p>
              <p style="font-size:13px;line-height:1.6;color:#607681">Este enlace es de un solo uso y vence en 30 minutos. Si no solicitaste el cambio, puedes ignorar este correo.</p>
            </div>
          </div>
        </div>`
    };
};

const enviarConGmail = async ({ correo, contenido }) => {
    const user = String(process.env.EMAIL_USER || "").trim();
    const password = String(process.env.EMAIL_APP_PASSWORD || "").replace(/\s/g, "");
    if (!user || !password) return false;

    const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        auth: { user, pass: password }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || `Óptica Integral <${user}>`,
        to: correo,
        subject: contenido.subject,
        text: contenido.text,
        html: contenido.html
    });
    return true;
};

const enviarConResend = async ({ correo, contenido }) => {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [correo],
            subject: contenido.subject,
            text: contenido.text,
            html: contenido.html
        })
    });
    if (!response.ok) throw new Error("No se pudo enviar el correo de recuperación");
    return true;
};

const enviarRecuperacion = async ({ correo, nombre, token }) => {
    if (process.env.NODE_ENV === "test") return true;
    const contenido = contenidoRecuperacion({ nombre, token });
    try {
        if (await enviarConGmail({ correo, contenido })) return true;
        return await enviarConResend({ correo, contenido });
    } catch (error) {
        console.error("Error enviando recuperación:", error.message);
        throw Object.assign(new Error("No se pudo enviar el correo de recuperación"), { status: 502 });
    }
};

enviarRecuperacion.verificarConfiguracion = async () => {
    const user = String(process.env.EMAIL_USER || "").trim();
    const password = String(process.env.EMAIL_APP_PASSWORD || "").replace(/\s/g, "");
    if (!user || !password) {
        throw new Error("Configure EMAIL_USER y EMAIL_APP_PASSWORD en backend/.env");
    }
    const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        auth: { user, pass: password }
    });
    await transporter.verify();
    return { user, service: process.env.SMTP_SERVICE || "gmail" };
};

module.exports = enviarRecuperacion;
