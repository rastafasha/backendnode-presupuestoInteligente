const mongoose = require('mongoose');

const ClienteSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    empresa: { type: String, default: 'Particular' },
    telefono: { type: String, unique: true, sparse: true }, // unique evita duplicados, sparse permite nulos
    correo: { type: String, unique: true, sparse: true },
    fechaRegistro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cliente', ClienteSchema);
