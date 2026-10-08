const Cliente = require('../models/Cliente');
const Cotizacion = require('../models/Cotizacion');
const Notificacion = require('../models/Notificacion'); // Importar el nuevo esquema
const { analizarMensajeCotizacion } = require('../services/geminiService');
const { enviarNotificacionPushGlobal } = require('../routes/notipushRoutes');
const getWhatsappClient = require('../config/whatsapp');  // Trae el cliente activo de whatsapp-web.js
const { enviarCorreoPropuesta } = require('../services/mailService'); // Trae tu Nodemailer



// Enviar la propuesta manual con ganancia calculada (Llamado desde la ruta HTTP de Angular)
const enviarPropuestaManual = async (req, res) => {
    const {
        cotizacionId,
        porcentajeGanancia,
        precioCostoSeleccionado,
        nombreProveedorSeleccionado,
        canalEnvio // Puede ser 'whatsapp' o 'correo'
    } = req.body;

    try {
        // 1. Validar que la cotización exista y traer los datos del cliente
        const cotizacion = await Cotizacion.findById(cotizacionId).populate('clienteId');
        if (!cotizacion) {
            return res.status(404).json({ ok: false, msg: 'La cotización solicitada no existe.' });
        }

        const cliente = cotizacion.clienteId;

        // 2. Calcular matemáticamente el precio de venta final con el margen
        const margen = parseFloat(porcentajeGanancia);
        const costo = parseFloat(precioCostoSeleccionado);
        const precioFinalVenta = costo * (1 + (margen / 100));

        // --- CANAL DE ENVÍO: WHATSAPP ---
        if (canalEnvio === 'whatsapp') {
            if (!cliente.telefono) {
                return res.status(400).json({ ok: false, msg: 'Este cliente no posee un número de teléfono registrado.' });
            }

            const clientWs = getWhatsappClient();
            if (!clientWs) {
                return res.status(500).json({ ok: false, msg: 'La pasarela de WhatsApp no está disponible en este momento.' });
            }

            // Formatear el ID de WhatsApp según el estándar requerido (elimina el '+' si existe)
            const chatId = `${cliente.telefono.replace(/\D/g, '')}@c.us`;

            // Plantilla de WhatsApp comercial, directa y con emojis para mejor conversión
            const plantillaWhatsapp =
                `¡Hola, *${cliente.nombre}*! 👋🌟\n\n` +
                `Te saludamos de tu plataforma de servicios. Con gusto te compartimos el presupuesto formal para tu solicitud de *${cotizacion.productoSolicitado}*:\n\n` +
                `📦 *Detalle:* ${cotizacion.productoSolicitado}\n` +
                `💰 *Precio Total Neto:* $${precioFinalVenta.toFixed(2)}\n\n` +
                `Quedamos totalmente atentos a tus comentarios para procesar tu orden de inmediato. ¡Que tengas un excelente día! 🚀`;

            // Enviar a través de Puppeteer de forma nativa
            await clientWs.sendMessage(chatId, plantillaWhatsapp);
            console.log(`💬 [WHATSAPP MANUAL]: Propuesta enviada con éxito a ${cliente.telefono}`);
        }

        // --- CANAL DE ENVÍO: CORREO (GMAIL) ---
        else if (canalEnvio === 'correo') {
            if (!cliente.correo) {
                return res.status(400).json({ ok: false, msg: 'Este cliente no posee un correo electrónico registrado.' });
            }

            // Invoca a tu servicio Nodemailer inyectando la plantilla HTML
            await enviarCorreoPropuesta(
                cliente.correo,
                cliente.nombre,
                cotizacion.productoSolicitado,
                precioFinalVenta
            );
            console.log(`📧 [GMAIL MANUAL]: Propuesta enviada con éxito a ${cliente.correo}`);
        }

        else {
            return res.status(400).json({ ok: false, msg: 'Canal de envío no válido configurado.' });
        }

        // 3. Persistir en MongoDB los cambios aplicados y marcar la cotización como ENVIADA
        cotizacion.porcentajeGanancia = margen;
        cotizacion.precioFinalVenta = precioFinalVenta;
        cotizacion.estado = 'enviado';
        await cotizacion.save();

        // 4. Notificar a Angular por WebSockets que la fila se actualizó para removerla o cambiarle el color
        req.io.emit('cotizacion-enviada-exito', {
            cotizacionId: cotizacion._id,
            estado: cotizacion.estado,
            precioFinalVenta: cotizacion.precioFinalVenta
        });

        return res.status(200).json({
            ok: true,
            msg: `Propuesta enviada y registrada con éxito por ${canalEnvio}.`,
            precioFinalVenta
        });

    } catch (error) {
        console.error('❌ [ERROR ENVIAR PROPUESTA]:', error.message);
        return res.status(500).json({
            ok: false,
            msg: 'Error crítico interno al procesar el envío de la propuesta.',
            error: error.message
        });
    }
};
// Procesar el mensaje entrante (esta función la llamará el evento de WhatsApp)

const procesarSolicitudEntrante = async (payload, io) => {
    const { nombreCliente, telefono, correo, mensajeOriginal, canalEntrada } = payload;

    try {
        // 1. 🧠 LLAMAR A GEMINI para procesar y limpiar el texto crudo en segundo plano
        console.log('🧠 [IA]: Enviando mensaje a Gemini para extracción...');
        const analisisIA = await analizarMensajeCotizacion(mensajeOriginal);

        // Si Gemini logró extraer un nombre real dentro del texto, lo priorizamos sobre el apodo de WhatsApp
        const nombreFinal = analisisIA.nombreExtraido.trim() !== '' ? analisisIA.nombreExtraido : nombreCliente;

        // 2. CRM: Buscar o crear cliente actualizando con los datos finos de la IA (como la Empresa)
        let cliente = null;
        if (telefono) {
            cliente = await Cliente.findOne({ telefono });
        } else if (correo) {
            cliente = await Cliente.findOne({ correo });
        }

        if (!cliente) {
            cliente = new Cliente({
                nombre: nombreFinal,
                telefono: telefono || undefined,
                correo: correo || undefined,
                empresa: analisisIA.empresa // Guardamos la empresa que detectó Gemini
            });
            await cliente.save();
        } else {
            // Si el cliente ya existía pero no tenía empresa registrada y Gemini la encontró, la actualizamos
            if (cliente.empresa === 'Particular' && analisisIA.empresa !== 'Particular') {
                cliente.empresa = analisisIA.empresa;
                await cliente.save();
            }
        }

        // 3. Crear la cotización en MongoDB con el producto real e impecable
        const nuevaCotizacion = new Cotizacion({
            clienteId: cliente._id,
            productoSolicitado: analisisIA.productoFormateado, // El producto ya procesado y limpio
            canalEntrada: canalEntrada,
            estado: 'pendiente_analisis'
        });
        await nuevaCotizacion.save();

        // 1. Persistir la alerta en MongoDB para la campana de Angular
        const alertaHistorica = new Notificacion({
            titulo: '📦 Nueva Cotización Lista',
            mensaje: `${cliente.nombre} (${canalEntrada}) solicitó: ${nuevaCotizacion.productoSolicitado}`,
            tipo: 'ANALISIS_COMPLETADO',
            referenciaCotizacionId: nuevaCotizacion._id
        });
        await alertaHistorica.save();

        // 2. Avisar a Angular por Sockets enviando tanto la cotización como la notificación de la campana
        req.io.emit('nueva-solicitud-entrante', payloadFrontend);
        req.io.emit('nueva-notificacion-campana', alertaHistorica); // <-- Escuchas esto en la campana de Angular

        // 3. Disparar banner flotante al Sistema Operativo
        await enviarNotificacionPushGlobal(alertaHistorica.titulo, alertaHistorica.mensaje, '/cotizaciones');

        // 4. Formatear la data final limpia para Angular
        const dataParaFrontend = {
            cotizacionId: nuevaCotizacion._id,
            cliente: {
                id: cliente._id,
                nombre: cliente.nombre,
                empresa: cliente.empresa,
                telefono: cliente.telefono,
                correo: cliente.correo
            },
            productoSolicitado: nuevaCotizacion.productoSolicitado,
            mensajeOriginal,
            canalEntrada,
            estado: nuevaCotizacion.estado,
            fecha: nuevaCotizacion.fechaSolicitud
        };

        // 🔥 Emitir el evento de Socket.io listo para que Angular dibuje la fila con los datos procesados
        io.emit('nueva-solicitud-entrante', dataParaFrontend);
        // 🔥 Disparar notificación push al sistema operativo del usuario
        const tituloNoti = `📦 Nueva Cotización Lista`;
        const cuerpoNoti = `${cliente.nombre} (${canalEntrada}) solicitó: ${nuevaCotizacion.productoSolicitado}`;

        enviarNotificacionPushGlobal(tituloNoti, cuerpoNoti, '/cotizaciones');

        return dataParaFrontend;

    } catch (error) {
        console.error('❌ [CONTROLADOR]: Error al procesar solicitud entrante:', error);
    }
};

const obtenerHistorialCotizaciones = async (req, res) => {
    try {
        // Buscamos todas las cotizaciones y ordenamos por las más recientes primero
        // .populate('clienteId') extrae de forma automática los datos de la ficha CRM asociada
        const cotizaciones = await Cotizacion.find()
            .populate('clienteId')
            .sort({ fechaSolicitud: -1 });

        return res.status(200).json({
            ok: true,
            total: cotizaciones.length,
            cotizaciones
        });
    } catch (error) {
        console.error('❌ [HISTORIAL COTIZACIONES ERROR]:', error.message);
        return res.status(500).json({
            ok: false,
            msg: 'Error interno en el servidor al intentar recuperar el historial de presupuestos.'
        });
    }
};

const obtenerCotizacionesPorCliente = async (req, res) => {
    try {
        const { clienteId } = req.params;

        // Buscamos solo las cotizaciones vinculadas a este cliente específico
        const cotizaciones = await Cotizacion.find({ clienteId })
            .populate('clienteId')
            .sort({ fechaSolicitud: -1 });

        return res.status(200).json({
            ok: true,
            total: cotizaciones.length,
            cotizaciones
        });
    } catch (error) {
        console.error('❌ [COTIZACIONES CLIENTE ERROR]:', error.message);
        return res.status(500).json({
            ok: false,
            msg: 'Error interno al recuperar las cotizaciones del cliente.'
        });
    }
};


const obtenerClientePorCotizacion = async (req, res) => {
    try {
        const { cotId } = req.params;

        // Buscamos la cotización y extraemos el cliente populado de forma automática
        const cotizacion = await Cotizacion.findById(cotId).populate('clienteId');
        
        if (!cotizacion) {
            return res.status(404).json({ ok: false, msg: 'La cotización solicitada no existe.' });
        }

        return res.status(200).json({
            ok: true,
            cliente: cotizacion.clienteId // Retorna la ficha completa del CRM lista para el modal
        });
    } catch (error) {
        console.error('❌ [BUSCAR POR COTIZACION ERROR]:', error.message);
        return res.status(500).json({
            ok: false,
            msg: 'Error interno en el servidor al buscar el cliente.'
        });
    }
};

module.exports = {
    procesarSolicitudEntrante,
    enviarPropuestaManual,
    obtenerHistorialCotizaciones,
    obtenerCotizacionesPorCliente,
    obtenerClientePorCotizacion
};
