const { response } = require('express');
const Usuario = require('../models/usuario');
const Cliente = require('../models/Cliente');

const getTodo = async(req, res = response) => {
    const busqueda = req.params.busqueda || ''; 
    
    const regexStr = busqueda === '' ? '.*' : busqueda;
    const regex = new RegExp(regexStr, 'i');

    const clientesFilter = {
        $or: [
            { name: regex },
            { correo: regex },
            { telefono: regex },
        ]
    };
    

    const [usuarios, clientes] = await Promise.all([
        Usuario.find({ username: regex }),
        Cliente.find(clientesFilter).populate('nombre'),
    ]);

    res.json({
        ok: true,
        usuarios,
        clientes,
    });
}

const getDocumentosColeccion = async(req, res = response) => {
    const tabla = req.params.tabla;
    const busqueda = req.params.busqueda;
    
    const regexStr = busqueda === 'all' ? '.*' : busqueda;
    const regex = new RegExp(regexStr, 'i');

    let data = [];

    switch (tabla) {
        case 'usuarios':
            data = await Usuario.find({ username: regex });
            break;
        case 'clientes':

            let clientesFilter = {};

            if (busqueda !== 'all') {
                clientesFilter.$or = [ 
                    { name: regex },
                    { correo: regex },
                    { telefono: regex },
                ];
            }


            data = await Cliente.find(clientesFilter).populate('nombre');
            break;
        default:
            return res.status(400).json({
                ok: false,
                msg: 'la tabla debe ser usuarios/clientes'
            });
    }

    res.json({
        ok: true,
        resultados: data
    });
}

module.exports = {
    getTodo,
    getDocumentosColeccion
}
