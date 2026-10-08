// sockets/socket.js

// Recibimos 'io' desde el app.js principal para mantener la inyección global limpia
module.exports = function(io) {

    io.on('connection', function(socket) {
        console.log('🔌 [WEBSOCKET]: Un panel de Angular se ha conectado con éxito.');

        // Evento de desconexión estándar
        socket.on('disconnect', function() {
            console.log('❌ [WEBSOCKET]: Panel de Angular desconectado.');
        });

        // =========================================================================
        // 💬 CONTROL DE FLUJO DE WHATSAPP (Sincronización de Sesión)
        // =========================================================================
        
        // Escucha si Angular solicita forzar un refresco del estado o QR de WhatsApp
        socket.on('solicitar-estado-whatsapp', function() {
            // El backend responderá emitiendo 'whatsapp-status' desde el config
            console.log('📌 [WEBSOCKET]: Angular solicitó el estado actual de la pasarela.');
        });

        // =========================================================================
        // 📋 EVENTOS RECIBIDOS DESDE EL FRONTEND (Opcionales para interactividad masiva)
        // =========================================================================

        // Si un agente abre una cotización específica, avisa a los demás paneles para bloquearla
        socket.on('marcar-cotizacion-en-revision', function(data) {
            socket.broadcast.emit('bloquear-fila-revision', data);
        });

        // Si quieres mantener un canal de chat vivo o logs internos de desarrollo
        socket.on('log-operaciones', function(msg) {
            console.log('🛠️ [LOG FRONTEND]: ' + msg);
        });
    });
};
