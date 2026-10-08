const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Despacha un correo formal al cliente con los datos de cotización inyectados.
 * @param {string} destino - Correo electrónico del cliente.
 * @param {string} nombreCliente - Nombre del destinatario.
 * @param {string} producto - Producto cotizado.
 * @param {number} precioFinal - Precio calculado con el margen de ganancia.
 */
const enviarCorreoPropuesta = async (destino, nombreCliente, producto, precioFinal) => {
    try {
        const opcionesCorreo = {
            from: `"Departamento Comercial" <${process.env.EMAIL_USER}>`,
            to: destino,
            subject: `📌 Presupuesto Oficial: ${producto}`,
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background-color: #1a73e8; color: white; padding: 24px; text-align: center;">
                        <h2 style="margin: 0; font-size: 24px;">Propuesta Comercial</h2>
                    </div>
                    <div style="padding: 24px; color: #333; line-height: 1.6;">
                        <p style="font-size: 16px;">¡Hola, <strong>${nombreCliente}</strong>!</p>
                        <p>Atendiendo a tu amable solicitud, te presentamos la cotización formal detallada para tu requerimiento:</p>
                        
                        <div style="background-color: #f8f9fa; border-left: 4px solid #1a73e8; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 6px 0; color: #666;"><strong>Concepto / Detalle:</strong></td>
                                    <td style="padding: 6px 0; text-align: right;">${producto}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #666;"><strong>Precio Final (Neto):</strong></td>
                                    <td style="padding: 6px 0; text-align: right; color: #1a73e8; font-size: 18px;"><strong>$${precioFinal.toFixed(2)}</strong></td>
                                </tr>
                            </table>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">* Los precios publicados incluyen los costos logísticos operativos del mercado actual.</p>
                        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 24px 0;">
                        <p style="margin-bottom: 0;">Quedamos totalmente a tu disposición para formalizar la orden o aclarar cualquier duda técnica.</p>
                        <p style="margin-top: 5px;">Saludos cordiales,</p>
                        <p style="color: #1a73e8; font-weight: bold; margin: 0;">Tu Sistema Inteligente de Ventas</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(opcionesCorreo);
        console.log(`📧 [NODEMAILER]: Correo enviado con éxito a [${destino}]. ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ [NODEMAILER ERROR]: Error despachando correo:', error.message);
        throw error;
    }
};

module.exports = { enviarCorreoPropuesta };
