/*
    Ruta: /api/profile
*/
const { Router } = require('express');
const router = Router();
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const {
    crearProfile,
    getProfiles,
    getProfile,
    actualizarProfile,
    borrarProfile,
    listarProfilePorUsuario,
    getProfilesrole
} = require('../controllers/profileController');

const {
    validarJWT,
    validarAdminRoleOMismoUsuario,
} = require('../middlewares/validar-jwt');


router.get('/all/', validarJWT, getProfiles);
router.get('/editores', getProfilesrole);
router.get('/:id', [validarJWT], getProfile);
router.delete('/borrar/:id', [validarJWT, ], borrarProfile);
router.get('/user_profile/:id', listarProfilePorUsuario);

router.post('/crear', [
    validarJWT,
    // check('first_name', 'el first_name es obligatorio').not().isEmpty(),
    // check('last_name', 'el last_name es obligatorio').not().isEmpty(),
    // check('usuario', 'El usuario id debe de ser valido').isMongoId(),
    validarCampos
], crearProfile);


router.put('/editar/:id', [
    validarJWT,
    validarCampos
], actualizarProfile);






module.exports = router;