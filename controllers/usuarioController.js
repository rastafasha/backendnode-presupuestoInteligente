const { response } = require('express');
const Usuario = require('../models/usuario');
const Profile = require('../models/profile');
const bcrypt = require('bcryptjs');
const { generarJWT } = require('../helpers/jwt');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

const crearUsuarios = async (req, res = response) => {

    const { email, password } = req.body;

    const body = req.body;

    //emvio por correo
    var admin_email = req.body.admin_email;
    var newUser = new Usuario();
    newUser.username = req.body.username;
    newUser.user_email = req.body.email;
    newUser.timezone = req.body.timezone;
    //emvio por correo
    try {

        const existeEmail = await Usuario.findOne({ email });

        if (existeEmail) {
            return res.status(400).json({
                ok: false,
                msg: 'El correo ya está registrado'
            })
        }

        const usuario = new Usuario({
            username: body.username,
            email: body.email,
            // terminos: body.terminos,
            role: body.role,
        });

        //encriptar password
        const salt = bcrypt.genSaltSync();
        usuario.password = bcrypt.hashSync(password, salt);

        //guardar usuario
        await usuario.save();

        // Enviar notificación de nuevo usuario al admin
        const adminTransporter = nodemailer.createTransport({
            host: "zlipmenu.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.USER_EMAIL,
                pass: process.env.PASS_email
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false
            }
        });

            const adminNotifyEmail = {
            from: `"Soporte ZlipMenu | CRM" <${process.env.USER_EMAIL}>`, 
            to: 'mercadocreativo@gmail.com',
            subject: `Nuevo usuario registrado: ${usuario.username}`,
            html: `
                <h2>¡Nuevo usuario en Zlipmenu | CRM!</h2>
                <p>Un nuevo usuario se ha registrado con éxito:</p>
                <ul>
                    <li><strong>Username:</strong> ${usuario.username}</li>
                    <li><strong>Email:</strong> ${usuario.email}</li>
                    <li><strong>Role:</strong> ${usuario.role}</li>
                    <li><strong>Fecha:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                <p>Revisa los detalles en el panel de administración.</p>
                <p>No Responda este correo</p>
            `
        };

        adminTransporter.sendMail(adminNotifyEmail, (error, info) => {
            if (error) {
                console.error('Error enviando email de notificación admin:', error);
            } else {
                console.log('Email de notificación admin enviado:', info.response);
            }
        });

        //generar el token - JWT
        const token = await generarJWT(usuario.id);
        res.json({
            ok: true,
            usuario,
            token
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado... revisar logs'
        });
    }


};


const getUsuariosList = async (req, res) => {


    const usuarios = await Usuario.find({})
        .populate('profile');

    res.json({
        ok: true,
        usuarios
    });



};

const getAllUsers = async (req, res) => {
    const usuarios = await Usuario.find({})
        .populate('project')
        .populate('profile');

    res.json({
        ok: true,
        usuarios
    });
};



const getUsuario = async (req, res = response) => {

    const id = req.params.id;

    try {

        const usuario = await Usuario.findById(id)
            .populate('profile', 'first_name last_name pais estado ciudad telhome')

        res.json({
            ok: true,
            usuario: usuario
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error hable con el admin'
        });

    }



};


const actualizarUAdmin = async (req, res = response) => {
    //todo: validar token y comprobar si el usuario es correcto

    const uid = req.params.id;

    try {
        const usuarioDB = await Usuario.findById(uid);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe el usuario por ese id'
            });
        }

        //actualizaciones
        const { password, google, email, ...campos } = req.body;




        if (usuarioDB.email !== email) {

            const existeEmail = await Usuario.findOne({ email });
            if (existeEmail) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Ya existe un usuario con ese email'
                });
            }
        }

        if (!usuarioDB.google) {

            campos.email = email;

        } else if (usuarioDB.email !== email) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario de google no puede cambiar su correo'
            });
        }

        //encriptar password
        const salt = bcrypt.genSaltSync();
        usuarioDB.password = bcrypt.hashSync(password, salt);

        const usuarioActualizado = await Usuario.findByIdAndUpdate(uid, campos, { new: true });

        res.json({
            ok: true,
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
};

const actualizarUsuario = async (req, res = response) => {
    //todo: validar token y comprobar si el usuario es correcto

    const uid = req.params.id;

    try {
        const usuarioDB = await Usuario.findById(uid);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe el usuario por ese id'
            });
        }

        //actualizaciones
        const { password, google, email, ...campos } = req.body;


        if (usuarioDB.email !== email) {

            const existeEmail = await Usuario.findOne({ email });
            if (existeEmail) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Ya existe un usuario con ese email'
                });
            }
        }

        if (!usuarioDB.google) {

            campos.email = email;

        } else if (usuarioDB.email !== email) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario de google no puede cambiar su correo'
            });
        }
        const usuarioActualizado = await Usuario.findByIdAndUpdate(uid, campos, { new: true });

        res.json({
            ok: true,
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
};
const actualizarUsuarioRole = async (req, res = response) => {
    //todo: validar token y comprobar si el usuario es correcto

    const uid = req.params.id;

    try {
        const usuarioDB = await Usuario.findById(uid);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe el usuario por ese id'
            });
        }

        //actualizaciones
        const { password, google, email, ...campos } = req.body;

        if (usuarioDB.email !== email) {

            const existeEmail = await Usuario.findOne({ email });
            if (existeEmail) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Ya existe un usuario con ese email'
                });
            }
        }

        if (!usuarioDB.google) {

            campos.email = email;

        } else if (usuarioDB.email !== email) {
            return res.status(400).json({
                ok: false,
                msg: 'Usuario de google no puede cambiar su correo'
            });
        }
        const usuarioActualizado = await Usuario.findByIdAndUpdate(uid, campos, { new: true });

        // Send welcome email if role changed
        if (campos.role && usuarioDB.role !== campos.role && usuarioActualizado.email) {
            const transporter = nodemailer.createTransport({
                host: "zlipmenu.com",
                port: 465,
                secure: true,
                auth: {
                    user: env.USER_EMAIL,
                    pass: env.PASS_email
                },
                tls: {
                    rejectUnauthorized: false
                }
            });


            const mailOptions = {
                from: `"Soporte ZlipMenu | CRM" <${process.env.USER_EMAIL}>`, 
                to: usuarioActualizado.email,
                subject: '¡Bienvenido! Tu rol ha sido actualizado',
                html: `
                    <h2>¡Hola, ${usuarioActualizado.username || 'Usuario'}!</h2>
                    <p>Tu rol ha sido actualizado a <strong>${usuarioActualizado.role}</strong>.</p>
                    <p>Ahora puedes acceder al sistema con tus nuevos permisos.</p>
                    <p>Puedes acceder a la aplicación por aquí: <a href="https://crm-zlipmenu.vercel.app/">https://crm-zlipmenu.vercel.app/</a>.</p>
                    <p>Si tienes alguna duda, contacta al administrador.</p>
                    <p>¡Gracias por usar Zlipmenu!</p>
                    <p>No Responda este correo</p>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending welcome email:', error);
                } else {
                    console.log('Welcome email sent to', usuarioActualizado.email, info.response);
                }
            });
        }

        res.json({
            ok: true,
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
};


const borrarUsuario = async (req, res) => {

    const uid = req.params.id;

    try {

        const usuarioDB = await Usuario.findById(uid);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe el usuario por ese id'
            });
        }

        await Usuario.findByIdAndDelete(uid);

        res.json({
            ok: true,
            msg: 'Usuario eliminado'
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
};

const crearEditor = async (req, res = response) => {

    const { email, password } = req.body;

    const body = req.body;

    try {

        const existeEmail = await Usuario.findOne({ email });

        if (existeEmail) {
            return res.status(400).json({
                ok: false,
                msg: 'El correo ya está registrado'
            })
        }

        const usuario = new Usuario({
            username: body.username,
            email: body.email,
            role: 'PARTNER',
        });

        //encriptar password
        const salt = bcrypt.genSaltSync();
        usuario.password = bcrypt.hashSync(password, salt);

        //guardar usuario
        await usuario.save();

        //generar el token - JWT
        const token = await generarJWT(usuario.id);

        res.json({
            ok: true,
            usuario,
            token
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado... revisar logs'
        });
    }


};

const getAllEditores = (req, res) => {


    Usuario.find({ role: 'PARTNER' }).exec((err, editores) => {
        if (err) {
            res.status(500).send({ message: 'Ocurrió un error en el servidor.' });
        } else {
            if (editores) {
                res.status(200).send({ editores: editores });
            } else {
                res.status(500).send({ message: 'No se encontró ningun dato en esta sección.' });
            }
        }
    });
};

function set_token_recovery(req, res) {
    var email = req.params['email'];
    const token = Math.floor(Math.random() * (999999 - 100000) + 100000);


    var transporter = nodemailer.createTransport(smtpTransport({
        host: "zlipmenu.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.USER_EMAIL,
                pass: process.env.PASS_email
        },
        tls: {
            rejectUnauthorized: false
        }
    }));

    var mailOptions = {
        from: env.USER_EMAIL,
        to: email,
        subject: 'Código de recuperación.',
        text: 'Tu código de recuperacion es: ' + token
    };


    Usuario.findOne({ email: email }, (err, user) => {

        if (err) {
            res.status(500).send({ message: "Error en el servidor" });
        } else {
            if (user == null) {
                res.status(500).send({ message: "El correo electrónico no se encuentra registrado, intente nuevamente." });
            } else {
                Usuario.findByIdAndUpdate({ _id: user._id }, { recovery_token: token }, (err, user_update) => {
                    if (err) {

                    } else {
                        res.status(200).send({ data: user_update });

                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {

                            } else {
                                console.log('Email sent: ' + info.response);
                            }
                        });
                    }
                })
            }
        }
    });
}

function verify_token_recovery(req, res) {
    var email = req.params['email'];
    var codigo = req.params['codigo'];

    Usuario.findOne({ email: email }, (err, user) => {
        if (err) {
            res.status(500).send({ message: "Error en el servidor" });
        } else {
            if (user.recovery_token == codigo) {
                res.status(200).send({ data: true });
            } else {
                res.status(200).send({ data: false });
            }
        }
    });
}

function change_password(req, res) {
    var email = req.params['email'];
    var params = req.body;
    Usuario.findOne({ email: email }, (err, user) => {
        if (err) {
            res.status(500).send({ message: "Error en el servidor" });
        } else {
            if (user == null) {
                res.status(500).send({ message: "El correo electrónico no se encuentra registrado, intente nuevamente." });
            } else {
                bcrypt.hash(params.password, null, null, function (err, hash) {
                    Usuario.findByIdAndUpdate({ _id: user._id }, { password: hash }, (err, user_update) => {
                        res.status(200).send({ data: user_update });
                    });
                });

            }
        }
    });
}



function newest(req, res) {
    Usuario.find().sort({ createdAt: -1 }).limit(4).exec((err, usuarios) => {
        if (usuarios) {
            res.status(200).send({ usuarios: usuarios });
        }
    });

}


const listarProfileUsuario = (req, res) => {
    var id = req.params['_id'];
    Usuario.find({ profile: id }, (err, usuario_data) => {
        if (!err) {
            if (usuario_data) {
                res.status(200).send({ usuario: usuario_data });
            } else {
                res.status(500).send({ error: err });
            }
        } else {
            res.status(500).send({ error: err });
        }
    }).populate('profile');
}



module.exports = {
    getUsuariosList,
    crearUsuarios,
    crearEditor,
    actualizarUsuario,
    actualizarUAdmin,
    borrarUsuario,
    getUsuario,
    getAllUsers,
    set_token_recovery,
    verify_token_recovery,
    change_password,
    newest,
    getAllEditores,
    listarProfileUsuario,
    actualizarUsuarioRole
};