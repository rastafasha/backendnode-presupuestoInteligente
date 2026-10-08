const { response } = require('express');
const Profile = require('../models/profile');

const crearProfile = async(req, res) => {

    const uid = req.uid;
    const profile = new Profile({
        usuario: uid,
        ...req.body
    });

    try {

        const profileDB = await profile.save();

        res.json({
            ok: true,
            profile: profileDB
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Hable con el admin'
        });
    }


};

const actualizarProfile = async(req, res) => {

    const id = req.params.id;
    const uid = req.uid;

    try {

        const profile = await Profile.findById(id);
        if (!profile) {
            return res.status(500).json({
                ok: false,
                msg: 'profile no encontrado por el id'
            });
        }

        const cambiosProfile = {
            ...req.body,
            usuario: uid
        }

        const profileActualizado = await Profile.findByIdAndUpdate(id, cambiosProfile, { new: true });

        res.json({
            ok: true,
            profileActualizado
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error hable con el admin'
        });
    }


};

const getProfiles = async(req, res) => {

    const profiles = await Profile.find()
        .populate('usuario')

    res.json({
        ok: true,
        profiles
    });
};

const getProfilesrole = async(req, res) => {

    // const profiles = await Profile.find({ role: 'EDITOR' })
    //     .populate('usuario', 'role editor');

    // res.json({
    //     ok: true,
    //     profiles
    // });

     Profile.find(

        // {
        //     where: {
        //         role: 'EDITOR'
        //     }
        // }
     )
    .populate('usuario', 'username role email')
    .exec((err, profiles) => {
        if (err) {
            res.status(500).send({ message: 'Ocurrió un error en el servidor.' });
        } else {
            if (profiles) {
                res.status(200).send({ profiles: profiles });
            } else {
                res.status(500).send({ message: 'No se encontró ningun dato en esta sección.' });
            }
        }
    });

};


const getProfile = async(req, res) => {

    const id = req.params.id;

    Profile.findById(id)
        .populate('usuario')
        .exec((err, profile) => {
            if (err) {
                return res.status(500).json({
                    ok: false,
                    mensaje: 'Error al buscar profile',
                    errors: err
                });
            }
            if (!profile) {
                return res.status(400).json({
                    ok: false,
                    mensaje: 'El profile con el id ' + id + 'no existe',
                    errors: { message: 'No existe un profile con ese ID' }
                });

            }
            res.status(200).json({
                ok: true,
                profile: profile
            });
        });

};




const borrarProfile = async(req, res) => {

    const id = req.params.id;

    try {

        const profile = await Profile.findById(id);
        if (!profile) {
            return res.status(500).json({
                ok: false,
                msg: 'profile no encontrado por el id'
            });
        }

        await Profile.findByIdAndDelete(id);

        res.json({
            ok: true,
            msg: 'profile eliminado'
        });

    } catch (error) {
        res.status(500).json({
            ok: false,
            msg: 'Error hable con el admin'
        });
    }
};

const listarProfilePorUsuario = (req, res) => {
    var id = req.params['id'];
    Profile.find({ usuario: id }, (err, profile_data) => {
        if (!err) {
            if (profile_data) {
                res.status(200).send({ profile: profile_data });
            } else {
                res.status(500).send({ error: err });
            }
        } else {
            res.status(500).send({ error: err });
        }
    }).populate('usuario');
}



module.exports = {
    crearProfile,
    getProfiles,
    getProfile,
    actualizarProfile,
    borrarProfile,
    listarProfilePorUsuario,
    getProfilesrole


};