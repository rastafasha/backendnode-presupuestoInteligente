const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConexionWhatsappSchema = new Schema({
  usuarioId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Usuario', // Lo vincula con el usuario dueño del presupuesto
    required: true 
  },
  numeroTelefono: { 
    type: String, 
    required: true, 
    unique: true // Evita que un número se vincule a dos cuentas
  },
  codigoPais: { 
    type: String, 
    default: '54' // O el código por defecto que uses
  },
  estadoConexion: { 
    type: String, 
    enum: ['pendiente', 'conectado', 'desconectado'], 
    default: 'pendiente' 
  },
  fechaVinculacion: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('ConexionWhatsapp', ConexionWhatsappSchema);