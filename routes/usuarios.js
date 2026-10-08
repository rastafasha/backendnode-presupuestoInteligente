/*
    Ruta: /api/usuarios
*/
const { Router } = require('express');
const router = Router();
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const {
    getUsuariosList,
    crearUsuarios,
    crearEditor,
    actualizarUsuario,
    actualizarUAdmin,
    borrarUsuario,
    getUsuario,
    getAllUsers,
    newest,
    set_token_recovery,
    verify_token_recovery,
    change_password,
    getAllEditores,
    listarProfileUsuario,
    cambiarAMiembro,
    actualizarUsuarioRole
} = require('../controllers/usuarioController');
const {
    validarJWT,
    validarAdminRole,
    validarAdminRoleOMismoUsuario,
    validarUserRole,
    validarSuperAdminRole,
    validarEditorRole,
    validarUserRoleOMismoUsuario
} = require('../middlewares/validar-jwt');

router.get('/',  getUsuariosList);
router.get('/recientes', newest);
router.get('/all', validarJWT, getAllUsers);
router.get('/editores', getAllEditores);
router.get('/:id', [validarJWT], getUsuario);
router.get('/user_profile/:id', listarProfileUsuario);
router.delete('/delete/:id', [validarJWT], borrarUsuario);

router.get('/user_token/set/:email', set_token_recovery);
router.get('/user_verify/token/:email/:codigo', verify_token_recovery);
router.put('/user_password/change/:email', change_password);

// router.get('/activarMiembro/:id', validarJWT, cambiarAMiembro);

router.post('/crear', [
    check('username', 'el username es obligatorio').not().isEmpty(),
    check('password', 'el password es obligatorio').not().isEmpty(),
    check('email', 'el email es obligatorio').isEmail(),
    validarCampos
], crearUsuarios);

router.post('/crearEditor', [
    check('username', 'el username es obligatorio').not().isEmpty(),
    check('password', 'el password es obligatorio').not().isEmpty(),
    check('email', 'el email es obligatorio').isEmail(),
    validarCampos
], crearEditor);

router.put('/editar/:id', [
    validarJWT,
    // validarUserRoleOMismoUsuario,
    check('first_name', 'el nombre es obligatorio').not().isEmpty(),
    check('email', 'el email es obligatorio').isEmail(),
    check('role', 'el role es obligatorio').not().isEmpty(),
    validarCampos
], actualizarUsuario);

router.put('/editarRole/:id', [
    validarJWT,
    // validarUserRoleOMismoUsuario,
    check('role', 'el role es obligatorio').not().isEmpty(),
    validarCampos
], actualizarUsuarioRole);

router.put('/editarAdmin/:id', [
    validarJWT,
    // validarAdminRole,
    // validarSuperAdminRole,
    // validarAdminRoleOMismoUsuario,
    check('username', 'el nombre es obligatorio').not().isEmpty(),
    check('email', 'el email es obligatorio').isEmail(),
    check('role', 'el role es obligatorio').not().isEmpty(),
    validarCampos
], actualizarUAdmin);






module.exports = router;