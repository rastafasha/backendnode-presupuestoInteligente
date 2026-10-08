const express = require('express');
const router = express.Router();
const Notificacion = require('../models/Notificacion');

// GET: /api/notificaciones/pendientes -> Trae las alertas sin leer de la campana
router.get('/pendientes', async (req, res) => {
    try {
        const alertas = await Notificacion.find({ leido: false }).sort({ createdAt: -1 }).limit(20);
        res.json({ ok: true, alertas });
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al obtener notificaciones.' });
    }
});

// PUT: /api/notificaciones/marcar-leida/:id -> Cambia el estado al hacer clic en Angular
router.put('/marcar-leida/:id', async (req, res) => {
    try {
        await Notificacion.findByIdAndUpdate(req.params.id, { leido: true });
        res.json({ ok: true, msg: 'Notificación marcada como leída.' });
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al actualizar estado.' });
    }
});

router.get('/historial-completo', async (req, res) => {
    try {
        const alertas = await Notificacion.find().sort({ createdAt: -1 }).limit(100);
        res.json({ ok: true, alertas });
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al compilar el historial masivo.' });
    }
});

module.exports = router;
