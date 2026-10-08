/*
    Ruta: /api/auth
*/
const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { login, googleSignIn, renewToken } = require('../controllers/authController');
const { validarJWT } = require('../middlewares/validar-jwt');


const router = Router();

router.post('/login', [
    check('email', 'el email es obligatorio').isEmail(),
    check('password', 'el password es obligatorio').not().isEmpty(),
    validarCampos

], login);

router.post('/google', [
    check('token', 'el token es obligatorio').not().isEmpty(),
    validarCampos

], googleSignIn);

router.get('/renew', validarJWT, renewToken);


module.exports = router;