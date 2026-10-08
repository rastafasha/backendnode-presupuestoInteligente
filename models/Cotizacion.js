const mongoose = require('mongoose');

// NUEVO: Sub-esquema para almacenar de forma exacta el desglose de productos que la IA extrae
const ArticuloSolicitadoSchema = new mongoose.Schema({
    cantidad: { type: Number, default: 1 },
    productoDetalle: { type: String, required: true }
});

const ProveedorSchema = new mongoose.Schema({
    nombreProveedor: { type: String, required: true },
    precioCosto: { type: Number, required: true },
    urlOrigen: { type: String },
    contactoProveedor: { type: String }
});

const CotizacionSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    
    // Mantiene el string resumido compacto (ej: "1x Mac book, 1x iPhone...") para títulos rápidos en tablas
    productoSolicitado: { type: String, required: true }, 
    
    // 🔥 NUEVO CAMPO: Colección exacta para renderizar en el Paso 2 de tu modal en Angular
    articulosDetallados: [ArticuloSolicitadoSchema], 
    
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
