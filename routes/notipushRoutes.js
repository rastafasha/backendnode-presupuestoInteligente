const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const SuscripcionPush = require('../models/SuscripcionPush');

// Configuración global de WebPush con tus llaves del .env
webpush.setVapidDetails(
    'mailto:mercadocreativo@gmail.com',
    process.env.VAPI_KEY_PUBLIC,
    process.env.VAPI_KEY_PRIVATE
);

// 1. Endpoint para guardar la suscripción del navegador (Llamado desde Angular)
router.post('/suscribir', async (req, res) => {
    const suscripcionEntrante = req.body;

    try {
        // Guardamos o actualizamos la suscripción en MongoDB para evitar duplicados
        await SuscripcionPush.findOneAndUpdate(
            { endpoint: suscripcionEntrante.endpoint },
            suscripcionEntrante,
            { upsert: true, new: true }
        );

        res.status(201).json({ ok: true, msg: 'Dispositivo suscrito con éxito a las notificaciones Push.' });
    } catch (error) {
        console.error('❌ [WEBPUSH]: Error al guardar suscripción:', error.message);
        res.status(500).json({ ok: false, error: error.toString() });
    }
});

// 2. Función auxiliar global para disparar notificaciones desde cualquier parte del backend
const enviarNotificacionPushGlobal = async (titulo, mensaje, urlDestino = '/dashboard/clientes') => {
    // 1. Buscamos todos los dispositivos suscritos en MongoDB
    const suscripciones = await SuscripcionPush.find({});

    // 2. Definimos el Payload en un formato JSON estricto compatible con Angular NGSW
    const payloadJson = JSON.stringify({
        notification: {
            title: titulo,
            body: mensaje,
            icon: 'assets/icons/72.png', // Ruta de tus iconos locales en el frontend
            badge: 'assets/icons/72.png',
            vibrate:[200, 100, 200],
            data: {
                url: urlDestino // Ruta para que el router.navigateByUrl de Angular sepa a dónde redirigir al hacer clic
            }
        }
    });

    // 3. Enviamos el paquete de datos a todos los navegadores guardados
    const promesasEnvio = suscripciones.map(suscripcion => {
        return webpush.sendNotification(suscripcion, payloadJson)
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log('🧹 [WEBPUSH]: Token expirado o navegador cerrado. Limpiando registro viejo de Mongo...');
                    return SuscripcionPush.deleteOne({ _id: suscripcion._id });
                }
                console.error('⚠️ Error enviando a un dispositivo individual:', err.message);
            });
    });

    await Promise.all(promesasEnvio);
    console.log(`🚀 [WEBPUSH]: Notificación Push despachada con éxito a ${suscripciones.length} navegadores.`);
};

// POST: /api/notipush/save-subscription
router.post('/save-subscription', async (req, res) => {
    const suscripcionEntrante = req.body;

    // Validación de seguridad por si el payload viene vacío
    if (!suscripcionEntrante || !suscripcionEntrante.endpoint) {
        return res.status(400).json({ ok: false, msg: 'La suscripción no contiene un endpoint válido.' });
    }

    try {
        // Guardamos o actualizamos usando el endpoint como llave única
        await SuscripcionPush.findOneAndUpdate(
            { endpoint: suscripcionEntrante.endpoint },
            suscripcionEntrante,
            { upsert: true, new: true }
        );

        return res.status(201).json({ 
            ok: true, 
            msg: 'Dispositivo comercial enlazado con éxito en MongoDB para WebPush.' 
        });
    } catch (error) {
        console.error('❌ [WEBPUSH BACKEND ERROR]:', error.message);
        return res.status(500).json({ ok: false, error: error.toString() });
    }
});
router.enviarNotificacionPushGlobal = enviarNotificacionPushGlobal;
// Exportamos las rutas de Express y la función disparadora global
module.exports = router;
