const Cliente = require('../models/Cliente');
const Cotizacion = require('../models/Cotizacion');
const Notificacion = require('../models/Notificacion'); // Importar el nuevo esquema
const getWhatsappClient = require('../config/whatsapp');  // Trae el cliente activo de whatsapp-web.js
const { enviarNotificacionPushGlobal } = require('../routes/notipushRoutes');
const { analizarMensajeCotizacion } = require('../services/geminiService');
const { enviarCorreoPropuesta } = require('../services/mailService'); // Trae tu Nodemailer
const { buscarProveedoresWeb } = require('../services/scraperService'); // 🌟 Importamos tu servicio de búsqueda



// Enviar la propuesta manual con ganancia calculada (Soporta individual y lote consolidado)
const enviarPropuestaManual = async (req, res) => {
    const {
        cotizacionId,
        canalEnvio,
        // 🌟 Capturamos el nuevo array estructurado con los checkboxes de Angular
        ofertasElegidas,
        // Mantener propiedades sueltas por si usas algún botón individual antiguo
        porcentajeGanancia,
        precioCostoSeleccionado,
        nombreProveedorSeleccionado
    } = req.body;

    try {
        // 1. Validar que la cotización exista y traer los datos del cliente
        const cotizacion = await Cotizacion.findById(cotizacionId).populate('clienteId');
        if (!cotizacion) {
            return res.status(404).json({ ok: false, msg: 'La cotización solicitada no existe.' });
        }

        const cliente = cotizacion.clienteId;
        let precioFinalVentaAcumulado = 0;
        let margenHistoricoGuardar = 0;

        // 🔀 DETERMINAR EL FORMATO DE ENTRADA: EMPAQUETAR A ARRAYS
        let listaAProcesar = [];
        if (ofertasElegidas && ofertasElegidas.length > 0) {
            listaAProcesar = ofertasElegidas;
            // Para el histórico guardamos el promedio de ganancia del lote o el del primer ítem
            margenHistoricoGuardar = parseFloat(ofertasElegidas[0].gananciaAplicada) || 0;
        } else {
            // Fallback: Si se usó el formato viejo individual, lo convertimos a estructura de array
            const costoSuero = parseFloat(precioCostoSeleccionado) || 0;
            const margenSuelto = parseFloat(porcentajeGanancia) || 0;
            margenHistoricoGuardar = margenSuelto;
            
            listaAProcesar = [{
                articulo: cotizacion.productoSolicitado,
                proveedor: nombreProveedorSeleccionado || 'Proveedor Web',
                precioVenta: costoSuero * (1 + (margenSuelto / 100))
            }];
        }

        // 📝 CONSTRUIR EL DESGLOSE LÍNEA POR LÍNEA Y CALCULAR EL TOTAL GENERAL SUMADO
        let lineasProductosText = '';
        listaAProcesar.forEach((item) => {
            const precioVentaItem = parseFloat(item.precioVenta) || 0;
            precioFinalVentaAcumulado += precioVentaItem;
            
            // Formato limpio con viñetas para el cuerpo del mensaje
            lineasProductosText += `• *${item.articulo}* -> *$${precioVentaItem.toFixed(2)}*\n`;
        });

        // --- CANAL DE ENVÍO: WHATSAPP ---
        // --- CANAL DE ENVÍO: WHATSAPP (CONECTADO A TU MOTOR COMPLEJO) ---
        if (canalEnvio === 'whatsapp') {
            if (!cliente.telefono) {
                return res.status(400).json({ ok: false, msg: 'Este cliente no posee un número de teléfono registrado.' });
            }

            // Formateamos el número limpio eliminando caracteres raros
            const numeroLimpio = cliente.telefono.replace(/\D/g, '');

            // Construimos la plantilla con el desglose de productos checkeados de Angular
            const plantillaWhatsapp =
                `¡Hola, *${cliente.nombre}*! 👋🌟\n\n` +
                `Te saludamos de tu plataforma comercial. Con gusto te compartimos el presupuesto formal adaptado para tu solicitud:\n\n` +
                `${lineasProductosText}\n` + 
                `📊 *PRECIO TOTAL NETO:* *$${precioFinalVentaAcumulado.toFixed(2)}*\n\n` +
                `Quedamos totalmente atentos a tus comentarios para procesar tu orden de inmediato. ¡Que tengas un excelente día! 🚀`;

            // 🌟 INYECCIÓN MAESTRA: Usamos tu función con control de RAM e hilos de CPU
            // Pasamos un ID fijo para tu aplicación (ej: 'sistema-presupuestos') o el del operador
            const idInstanciaSegura = 'presupuesto-inteligente'; 
            
            const despachoExitoso = await enviarMensajeWhatsApp(idInstanciaSegura, numeroLimpio, plantillaWhatsapp);
            
            if (!despachoExitoso) {
                return res.status(500).json({ 
                    ok: false, 
                    msg: 'La pasarela automatizada se está inicializando o requiere escaneo QR en el panel.' 
                });
            }
            
            console.log(`💬 [WHATSAPP MANUAL BLINDADO]: Propuesta enviada con éxito a ${cliente.telefono}`);
        }

        // --- CANAL DE ENVÍO: CORREO (GMAIL) ---
        else if (canalEnvio === 'correo') {
            if (!cliente.correo) {
                return res.status(400).json({ ok: false, msg: 'Este cliente no posee un correo electrónico registrado.' });
            }

            // Limpiamos los asteriscos de formato de WhatsApp para que el cuerpo del email sea plano y elegante
            const textoLimpioEmail = lineasProductosText.replace(/\*/g, '');

            await enviarCorreoPropuesta(
                cliente.correo,
                cliente.nombre,
                textoLimpioEmail,
                precioFinalVentaAcumulado
            );
            console.log(`📧 [GMAIL CONSOLIDADO]: Propuesta enviada con éxito a ${cliente.correo}`);
        }

        else {
            return res.status(400).json({ ok: false, msg: 'Canal de envío no válido configurado.' });
        }

        // 3. 🌟 PERSISTENCIA SEGURA EN MONGO: Guardamos números limpios y reales (Evitamos NaN)
        cotizacion.porcentajeGanancia = margenHistoricoGuardar;
        cotizacion.precioFinalVenta = precioFinalVentaAcumulado; // Guarda la sumatoria total del lote
        cotizacion.estado = 'enviado';
        await cotizacion.save();

        // 4. Notificar a Angular por WebSockets para congelar o pintar las filas de la UI
        req.io.emit('cotizacion-enviada-exito', {
            cotizacionId: cotizacion._id,
            estado: cotizacion.estado,
            precioFinalVenta: cotizacion.precioFinalVenta
        });

        return res.status(200).json({
            ok: true,
            msg: `Presupuesto consolidado enviado y registrado con éxito por ${canalEnvio}.`,
            precioFinalVenta: precioFinalVentaAcumulado
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

// Procesar el mensaje entrante (Llamado por los eventos reactivos de GMAIL IMAP o WhatsApp)
const procesarSolicitudEntrante = async (payload, io) => {
    // Recibimos los metadatos puros consolidados desde los oyentes
    const { nombreCliente, telefono, correo, mensajeOriginal, canalEntrada, tituloAsunto, fechaOriginal } = payload;

    try {
        console.log('🧠 [IA]: Enviando mensaje a Gemini para extracción estructurada...');
        const analisisIA = await analizarMensajeCotizacion(mensajeOriginal);

        const nombreFinal = analisisIA.nombreExtraido && analisisIA.nombreExtraido.trim() !== '' 
            ? analisisIA.nombreExtraido 
            : nombreCliente;
            
        const telefonoFinal = telefono || (analisisIA.telefonos ? analisisIA.telefonos.split(',')[0].trim() : undefined);
        const correoFinal = correo || analisisIA.correoContacto || undefined;

        // 1. CRM: Buscar o crear cliente actualizando su ficha comercial con datos finos de la IA
        let cliente = null;
        if (telefonoFinal) {
            cliente = await Cliente.findOne({ telefono: telefonoFinal });
        } else if (correoFinal) {
            cliente = await Cliente.findOne({ correo: correoFinal });
        }

        if (!cliente) {
            cliente = new Cliente({
                nombre: nombreFinal,
                telefono: telefonoFinal,
                correo: correoFinal,
                empresa: analisisIA.empresa || 'Particular'
            });
            await cliente.save();
        } else {
            let requiereActualizacion = false;
            if (!cliente.telefono && telefonoFinal) { cliente.telefono = telefonoFinal; requiereActualizacion = true; }
            if (!cliente.correo && correoFinal) { cliente.correo = correoFinal; requiereActualizacion = true; }
            if ((!cliente.empresa || cliente.empresa === 'Particular') && analisisIA.empresa && analisisIA.empresa !== 'Particular') { 
                cliente.empresa = analisisIA.empresa; 
                requiereActualizacion = true; 
            }
            if (requiereActualizacion) await cliente.save();
        }

        // 2. SCRAPER: Búsqueda de proveedores en bloque optimizada para cuota gratuita (Free Tier)
        let todosLosProveedores = [];
        if (analisisIA.productosLista && analisisIA.productosLista.length > 0) {
            todosLosProveedores = await buscarProveedoresWeb(analisisIA.productosLista);
        }

        // 🌟 CANDADO ANTI-VALIDATION ERROR: Construimos el string y forzamos un Fallback si viene vacío
        let resumenProductos = '';
        if (analisisIA.productosLista && analisisIA.productosLista.length > 0) {
            resumenProductos = analisisIA.productosLista
                .map(p => `${p.cantidad}x ${p.productoDetalle}`)
                .join(', ');
        }
        
        // Si por algún motivo la cadena quedó vacía, le inyectamos un texto válido para cumplir con Mongoose
        if (!resumenProductos || resumenProductos.trim() === '') {
            resumenProductos = `Solicitud de Equipos de Tecnología (${canalEntrada})`;
        }

        // 3. PERSISTENCIA EN MONGO: Guardamos la cotización de forma segura
        const nuevaCotizacion = new Cotizacion({
            clienteId: cliente._id,
            tituloAsunto: tituloAsunto || `Presupuesto: ${resumenProductos.substring(0, 30)}...`,
            fechaRecepcionOriginal: fechaOriginal || new Date(),
            productoSolicitado: resumenProductos, // ✅ Validado y blindado contra strings vacíos
            articulosDetallados: analisisIA.productosLista && analisisIA.productosLista.length > 0 
                ? analisisIA.productosLista 
                : [{ cantidad: 1, productoDetalle: mensajeOriginal.substring(0, 50) }], 
            proveedoresEncontrados: todosLosProveedores,   
            canalEntrada: canalEntrada,
            estado: todosLosProveedores.length > 0 ? 'listo_para_enviar' : 'pendiente_analisis'
        });
        await nuevaCotizacion.save();

        // Alerta histórica para la campana de notificaciones de Angular
        const alertaHistorica = new Notificacion({
            titulo: `📦 ${nuevaCotizacion.tituloAsunto}`,
            mensaje: `${cliente.nombre} solicitó: ${resumenProductos}`,
            tipo: 'ANALISIS_COMPLETADO',
            referenciaCotizacionId: nuevaCotizacion._id
        });
        await alertaHistorica.save();

        // 4. TRANSMISIÓN WEBSOCKET: Empaquetamos la carga para inyectar directo al modal de Angular
        const dataParaFrontend = {
            cotizacionId: nuevaCotizacion._id,
            cliente: {
                id: cliente._id,
                nombre: cliente.nombre,
                empresa: cliente.empresa,
                telefono: cliente.telefono,
                correo: cliente.correo
            },
            tituloAsunto: nuevaCotizacion.tituloAsunto,
            fechaRecepcionOriginal: nuevaCotizacion.fechaRecepcionOriginal,
            productoSolicitado: nuevaCotizacion.productoSolicitado,
            articulosDetallados: nuevaCotizacion.articulosDetallados, 
            proveedoresEncontrados: nuevaCotizacion.proveedoresEncontrados, 
            mensajeOriginal,
            canalEntrada,
            estado: nuevaCotizacion.estado,
            fecha: nuevaCotizacion.fechaSolicitud
        };

        // Emitimos los eventos asíncronos en tiempo real por los sockets unificados
        io.emit('nueva-solicitud-entrante', dataParaFrontend);
        io.emit('nueva-notificacion-campana', alertaHistorica);

        // 5. NOTIFICACIÓN PUSH WEB: Despachamos la alerta nativa al navegador del SuperAdmin
        const tituloNoti = `📦 Nueva Cotización Lista`;
        const cuerpoNoti = `${cliente.nombre} (${canalEntrada}) solicitó: ${resumenProductos}`;
        const rutaDestinoAngular = `/dashboard/clients?cotId=${nuevaCotizacion._id}`;
        
        await enviarNotificacionPushGlobal(tituloNoti, cuerpoNoti, rutaDestinoAngular);
        console.log(`🚀 [WEBPUSH]: Alerta comercial despachada con éxito hacia: ${rutaDestinoAngular}`);

        // 🌟 CORRECCIÓN EXTRA: Eliminamos el segundo 'return' duplicado que generaba ruido sintáctico
        return dataParaFrontend;

    } catch (error) {
        console.error("❌ [CONTROLADOR]: Error crítico al procesar solicitud entrante:");
        console.error(error.stack || error.message || error);
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
