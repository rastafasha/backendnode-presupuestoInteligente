/*
Ruta: /api/todo/
*/

const { Router } = require('express');
const router = Router();
const { getTodo, getDocumentosColeccion } = require('../controllers/busquedaController');
const { validarJWT } = require('../middlewares/validar-jwt');

router.get('/:busqueda',
    // [validarJWT], 
    getTodo);
router.get('/coleccion/:tabla/:busqueda',
    // [validarJWT], 
    getDocumentosColeccion);


module.exports = router;