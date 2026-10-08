const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');

let client;
let ioInstance;

const inicializarWhatsApp = (io) => {
    ioInstance = io; // Guardamos la instancia de socket.io para usarla globalmente

    console.log('🔄 Inicializando instancia de WhatsApp Web...');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp_auth_session' // Almacena la sesión localmente
        }),
        puppeteer: {
            headless: true, // Se ejecuta en segundo plano sin abrir ventanas
            // 🔥 CORRECCIÓN CRÍTICA: Forzamos a puppeteer-core a usar tu Google Chrome nativo de Mac
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        }
    });

    // 1. Evento cuando se requiere escanear el Código QR
    client.on('qr', (qr) => {
        console.log('📌 [WHATSAPP]: Nuevo código QR generado. Escanéalo en la terminal o el panel.');

        // Lo pinta en la consola del backend por comodidad
        // qrcodeTerminal.generate(qr, { small: true });

        // 🔥 Transmite el string del QR en tiempo real a Angular por WebSocket
        ioInstance.emit('whatsapp-qr', { qr });
        ioInstance.emit('whatsapp-status', { estado: 'esperando_qr' });
    });

    // 2. Evento cuando el teléfono se autentica con éxito
    client.on('authenticated', () => {
        console.log('✅ [WHATSAPP]: Sesión autenticada correctamente.');
        ioInstance.emit('whatsapp-status', { estado: 'autenticado' });
    });

    // 3. Evento cuando la conexión está 100% lista para enviar/recibir mensajes
    client.on('ready', () => {
        console.log('🚀 [WHATSAPP]: ¡Cliente listo y conectado con éxito!');
        ioInstance.emit('whatsapp-status', { estado: 'conectado' });
    });

    // 4. Evento cuando falla la autenticación
    client.on('auth_failure', (msg) => {
        console.error('❌ [WHATSAPP]: Fallo en la autenticación:', msg);
        ioInstance.emit('whatsapp-status', { estado: 'error_autenticacion', detalle: msg });
    });

    // 5. Evento cuando el usuario cierra la sesión desde el celular
    client.on('disconnected', (reason) => {
        console.warn('⚠️ [WHATSAPP]: El cliente se ha desconectado:', reason);
        ioInstance.emit('whatsapp-status', { estado: 'desconectado', detalle: reason });

        // Destruir e intentar reiniciar el cliente de forma limpia
        client.destroy();
        inicializarWhatsApp(ioInstance);
    });

    // 6. Escucha de mensajes entrantes con palabras clave
    client.on('message', async (msg) => {
        const textoMensaje = msg.body.toLowerCase();
        const palabrasClave = ['cotización', 'cotizacion', 'presupuesto', 'solicitud'];
        const contienePalabraClave = palabrasClave.some(palabra => textoMensaje.includes(palabra));

        if (contienePalabraClave) {
            console.log(`📩 [WHATSAPP]: Mensaje clave detectado de [${msg.from}]: ${msg.body}`);

            try {
                // Obtener los datos del perfil de WhatsApp de forma asíncrona
                const contacto = await msg.getContact();
                const nombreCliente = contacto.pushname || 'Cliente Nuevo';
                const telefono = msg.from.replace('@c.us', '');

                // Armamos el objeto base
                const payloadInicial = {
                    nombreCliente,
                    telefono,
                    mensajeOriginal: msg.body,
                    canalEntrada: 'whatsapp'
                };

                // 🔥 Enviamos la solicitud al controlador pasándole el ioInstance de los Sockets
                await procesarSolicitudEntrante(payloadInicial, ioInstance);

            } catch (err) {
                console.error('❌ [WHATSAPP]: Error al extraer datos del contacto:', err);
            }
        }
    });

    // Arrancar el proceso interno de Puppeteer
    client.initialize();
};

module.exports = {
    inicializarWhatsApp,
    getWhatsappClient: () => client
};


