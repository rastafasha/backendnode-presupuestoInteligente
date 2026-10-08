const mongoose = require('mongoose');

const ProveedorSchema = new mongoose.Schema({
    nombreProveedor: { type: String, required: true },
    precioCosto: { type: Number, required: true },
    urlOrigen: { type: String },
    contactoProveedor: { type: String }
});

const CotizacionSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    productoSolicitado: { type: String, required: true },
    canalEntrada: { type: String, enum: ['whatsapp', 'correo'], required: true },
    
    // Lista de proveedores encontrados por la IA/Scraper
    proveedoresEncontrados: [ProveedorSchema],
    
    // Datos finales que llenará el usuario desde Angular
    porcentajeGanancia: { type: Number, default: 0 },
    precioFinalVenta: { type: Number, default: 0 },
    proveedorSeleccionadoId: { type: mongoose.Schema.Types.ObjectId }, 
    
    estado: { 
        type: String, 
        enum: ['pendiente_analisis', 'listo_para_enviar', 'enviado'], 
        default: 'pendiente_analisis' 
    },
    fechaSolicitud: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cotizacion', CotizacionSchema);
