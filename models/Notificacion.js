const mongoose = require('mongoose');

const NotificacionSchema = new mongoose.Schema({
    // Título descriptivo y cuerpo del mensaje que se pintará en la campana
    titulo: { type: String, required: true },
    mensaje: { type: String, required: true },
    
    // Estado de lectura para el contador dinámico de la campana
    leido: { type: Boolean, default: false },
    
    // Segmentación rápida de los eventos del sistema de presupuestos
    tipo: { 
        type: String, 
        enum: [
            'SOLICITUD_ENTRANTE',    // Entró un WhatsApp o Correo con palabras clave
            'ANALISIS_COMPLETADO',   // Gemini y el Scraper terminaron de armar los precios
            'PROPUESTA_ENVIADA',     // El usuario dio clic y se despachó al cliente
            'ERROR_SISTEMA'          // Fallas de conexión con WhatsApp o APIs
        ], 
        default: 'SOLICITUD_ENTRANTE' 
    },

    // 🔥 CAMPO DE REFERENCIA: Guardamos el ID de la Cotización asociada
    // Esto te permitirá hacer clic sobre la notificación en Angular y redirigir al usuario directo a esa fila.
    referenciaCotizacionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Cotizacion', 
        default: null 
    },

    fecha: { type: Date, default: Date.now }
}, { 
    collection: 'app_notificaciones', // Colección limpia para presupuestos
    timestamps: true // Crea automáticamente 'createdAt' y 'updatedAt'
});

// Índice compuesto para acelerar drásticamente la carga de la campana en Angular
NotificacionSchema.index({ leido: 1, createdAt: -1 });

module.exports = mongoose.model('Notificacion', NotificacionSchema);
