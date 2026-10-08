/*
 Ruta: /api/cotizaciones
 */

const { Router } = require('express');
const router = Router();
const { enviarPropuestaManual, obtenerHistorialCotizaciones,
     obtenerCotizacionesPorCliente,
    obtenerClientePorCotizacion
 } = require('../controllers/cotizacionController');

router.get('/historial', obtenerHistorialCotizaciones);
router.get('/cliente/:clienteId', obtenerCotizacionesPorCliente);
router.get('/buscar-por-cotizacion/:cotId', obtenerClientePorCotizacion);
router.post('/enviar-propuesta', enviarPropuestaManual);


module.exports = router;