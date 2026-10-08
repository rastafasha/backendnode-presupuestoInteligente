/*
 Ruta: /api/clientes
 */

const { Router } = require('express');
const router = Router();
const {
    crearCliente,
        obtenerClientes,
        obtenerClientePorId,
        actualizarCliente,
        eliminarCliente
} = require('../controllers/clienteController');

const { validarJWT } = require('../middlewares/validar-jwt');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');

router.get('/', obtenerClientes);
router.get('/:id', obtenerClientePorId);

router.post('/crear', [
    // validarJWT,
    validarCampos
], crearCliente);

router.put('/editar/:id', [
    validarJWT,
    check('nombre', 'El nombre de la Tasa es necesario').not().isEmpty(),
    validarCampos
], actualizarCliente);

router.delete('/borrar/:id',  eliminarCliente);


module.exports = router;