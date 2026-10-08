const { response } = require('express');
const Usuario = require('../models/usuario');
const bcrypt = require('bcryptjs');
const { generarJWT } = require('../helpers/jwt');


const login = async(req, res) => {

    const { email, password } = req.body;

    try {
        //verificar email
        const user = await Usuario.findOne({ email });

        if (!user) {
            return res.status(404).json({
                ok: false,
                msg: 'email no encontrado'
            });
        }

        //verificar password
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: 'Contraseña no valida'
            });
        }

        //generar el token - JWT
        const token = await generarJWT(user.id);

        res.json({
            ok: true,
            token,
            user
            // menu: getMenuFrontEnd(usuarioDB.role)
        })

    } catch (error) {
        // console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'hable con el admin'
        });
    }
};

const googleSignIn = async(req, res = response) => {

    const googleToken = req.body.token;

    try {

        const { name, email, picture } = await googleVerify(googleToken);

        const user = await Usuario.findOne({ email });
        let usuario;

        if (!user) {
            //si no existe el usuario
            usuario = new Usuario({
                nombre: name,
                email,
                password: '@@@',
                img: picture,
                google: true

            });
        } else {
            //existe usuario
            usuario = user;
            usuario.google = true;
        }

        //guardar en bd
        await usuario.save();

        //generar el token - JWT
        const token = await generarJWT(usuario.id);

        res.json({
            ok: true,
            token,
            user
            // menu: getMenuFrontEnd(usuario.role)
        });

    } catch (error) {
        res.status(401).json({
            ok: false,
            msg: 'Token no es correcto',
        });
    }


};

const renewToken = async(req, res = response) => {

    const uid = req.uid

    //generar el token - JWT
    const token = await generarJWT(uid);

    // obenter el usuario por uid
    const user = await Usuario.findById(uid);

    res.json({
        ok: true,
        token,
        user,
        // menu: getMenuFrontEnd(usuario.role)
    });
};

module.exports = {
    login,
    googleSignIn,
    renewToken,

};