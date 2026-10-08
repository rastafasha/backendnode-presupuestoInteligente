const Cliente = require('../models/Cliente');

/**
 * 🟢 CREAR NUEVO CLIENTE (MANUAL DESDE FRONTEND)
 * POST: /api/clientes
 */
const crearCliente = async (req, res) => {
    try {
        const { nombre, empresa, telefono, correo } = req.body;

        // Validar si ya existe un cliente con el mismo teléfono o correo para evitar duplicados en el CRM
        const existeCliente = await Cliente.findOne({
            $or: [
                { telefono: telefono || 'undefined-placeholder' },
                { correo: correo || 'undefined-placeholder' }
            ]
        });

        if (existeCliente) {
            return res.status(400).json({
                ok: false,
                msg: 'Ya existe un cliente registrado con ese número de teléfono o correo electrónico.'
            });
        }

        const nuevoCliente = new Cliente({ nombre, empresa, telefono, correo });
        await nuevoCliente.save();

        // 🔥 Emitir a Angular por Sockets para actualizar la lista en tiempo real
        req.io.emit('crm-cliente-creado', nuevoCliente);

        return res.status(201).json({
            ok: true,
            msg: 'Cliente creado exitosamente en el CRM.',
            cliente: nuevoCliente
        });
    } catch (error) {
        console.error('❌ [CRUD CLIENTE ERROR]:', error.message);
        return res.status(500).json({ ok: false, msg: 'Error interno al crear el cliente.' });
    }
};

/**
 * 🔵 OBTENER TODOS LOS CLIENTES (CON PAGINACIÓN OPCIONAL)
 * GET: /api/clientes
 */
const obtenerClientes = async (req, res) => {
    try {
        // Ordenamos por fecha de registro descendente (los más nuevos primero)
        const clientes = await Cliente.find().sort({ fechaRegistro: -1 });
        
        return res.status(200).json({
            ok: true,
            total: clientes.length,
            clientes
        });
    } catch (error) {
        console.error('❌ [CRUD CLIENTE ERROR]:', error.message);
        return res.status(500).json({ ok: false, msg: 'Error interno al obtener los clientes.' });
    }
};

/**
 * 🔍 OBTENER UN CLIENTE POR ID
 * GET: /api/clientes/:id
 */
const obtenerClientePorId = async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.id);
        if (!cliente) {
            return res.status(404).json({ ok: false, msg: 'Cliente no encontrado en el sistema.' });
        }

        return res.status(200).json({ ok: true, cliente });
    } catch (error) {
        console.error('❌ [CRUD CLIENTE ERROR]:', error.message);
        return res.status(500).json({ ok: false, msg: 'ID de cliente no válido o error de consulta.' });
    }
};

/**
 * 🟠 ACTUALIZAR CLIENTE
 * PUT: /api/clientes/:id
 */
const actualizarCliente = async (req, res) => {
    try {
        const { nombre, empresa, telefono, correo } = req.body;
        const clienteId = req.params.id;

        // Validar si los nuevos datos de contacto chocan con otro cliente diferente
        const conflictoContacto = await Cliente.findOne({
            _id: { $ne: clienteId }, // Que no sea el mismo cliente que estamos editando
            $or: [
                { telefono: telefono || 'undefined-placeholder' },
                { correo: correo || 'undefined-placeholder' }
            ]
        });

        if (conflictoContacto) {
            return res.status(400).json({
                ok: false,
                msg: 'El número de teléfono o correo ya pertenecen a otro cliente registrado.'
            });
        }

        const clienteActualizado = await Cliente.findByIdAndUpdate(
            clienteId,
            { nombre, empresa, telefono, correo },
            { new: true, runValidators: true } // new: true devuelve el objeto modificado de inmediato
        );

        if (!clienteActualizado) {
            return res.status(404).json({ ok: false, msg: 'El cliente que intenta actualizar no existe.' });
        }

        // 🔥 Emitir a Angular el objeto actualizado de forma masiva
        req.io.emit('crm-cliente-actualizado', clienteActualizado);

        return res.status(200).json({
            ok: true,
            msg: 'Ficha de cliente actualizada correctamente.',
            cliente: clienteActualizado
        });
    } catch (error) {
        console.error('❌ [CRUD CLIENTE ERROR]:', error.message);
        return res.status(500).json({ ok: false, msg: 'Error interno al actualizar el cliente.' });
    }
};

/**
 * 🔴 ELIMINAR CLIENTE
 * DELETE: /api/clientes/:id
 */
const eliminarCliente = async (req, res) => {
    try {
        const clienteEliminado = await Cliente.findByIdAndDelete(req.params.id);
        
        if (!clienteEliminado) {
            return res.status(404).json({ ok: false, msg: 'El cliente que intenta eliminar no existe.' });
        }

        // 🔥 Notificar a Angular el ID removido para sacarlo de la tabla visual de inmediato
        req.io.emit('crm-cliente-eliminado', { id: req.params.id });

        return res.status(200).json({
            ok: true,
            msg: `El cliente "${clienteEliminado.nombre}" ha sido removido del sistema.`
        });
    } catch (error) {
        console.error('❌ [CRUD CLIENTE ERROR]:', error.message);
        return res.status(500).json({ ok: false, msg: 'Error interno al eliminar el cliente.' });
    }
};

module.exports = {
    crearCliente,
    obtenerClientes,
    obtenerClientePorId,
    actualizarCliente,
    eliminarCliente
};
