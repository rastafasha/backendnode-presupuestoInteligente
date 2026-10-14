const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');
const ConexionWhatsapp = require('../models/ConexionWhatsapp');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let client;
let ioInstance;

const inicializarWhatsApp = async (io) => {
    ioInstance = io;
    console.log('🔄 [WHATSAPP]: Inicializando pasarela híbrida auto-adaptable...');

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        let estrategiaAutenticacion;

        // 🔀 ESTRATEGIA DE AUTENTICACIÓN DINÁMICA SEGÚN EL ENTORNO
        if (isProduction) {
            console.log('☁️ [PRODUCCIÓN]: Activando RemoteAuth con MongoDB Atlas para Render...');
            const store = new MongoStore({ mongoose: mongoose });
            estrategiaAutenticacion = new RemoteAuth({
                store: store,
                backupSyncIntervalMs: 300000,
                clientId: 'presupuesto-inteligente-prod',
                dataPath: '/tmp'
            });
        } else {
            console.log('💻 [DESARROLLO LOCAL]: Activando LocalAuth directo en tu Mac (Inmune a caídas de red)...');
            estrategiaAutenticacion = new LocalAuth({
                clientId: 'presupuesto-inteligente-local',
                dataPath: './whatsapp_auth_session' // Guarda la sesión rápido en una carpeta local de tu MAMP
            });
        }

        client = new Client({
            // 🌟 ELEVACIÓN DE TOLERANCIA DE RED (De 2 a 5 minutos de espera máxima)
            authTimeoutMs: 300000,
            qrMaxImages: 10,        // Permitimos más intentos de refresco para que no aborte si la señal parpadea
            takeoverOnConflict: true,
            takeoverTimeoutMs: 30000,

            authStrategy: estrategiaAutenticacion,

            puppeteer: {
                headless: true,
                defaultViewport: { width: 1024, height: 768 },
                executablePath: isProduction
                    ? '/opt/render/project/src/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome'
                    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions',

                    // Identidad de Chrome estable de Mac
                    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',

                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-software-rasterizer',
                    '--process-per-tab',
                    '--force-device-scale-factor=1',
                    '--disable-component-update',

                    // 🌟 PARCHES SALVADORES PARA CONEXIONES INTERMITENTES:
                    '--disable-features=IsolateOrigins,site-per-process', // Evita que Chrome asile procesos consumiendo datos de red extra
                    '--ignore-certificate-errors', // Salta validaciones SSL lentas en redes inestables

                    isProduction ? '--js-flags=--max-old-space-size=120' : '--js-flags=--max-old-space-size=4096',
                    ...(isProduction ? ['--single-process'] : [])
                ]
            }
        });

        // 📡 INTERCEPTOR DE PETICIONES (Ahorro masivo de datos si el internet está lento)
        client.on('pup_page_created', async (page) => {
            try {
                await page.setRequestInterception(true);
                page.on('request', (request) => {
                    const resourceType = request.resourceType();
                    if (['image', 'font', 'media'].includes(resourceType)) {
                        request.abort();
                    } else {
                        request.continue();
                    }
                });
            } catch (error) {
                console.error("❌ [PUPPETEER INTERCEPTOR ERROR]:", error.message);
            }
        });

        // 📌 ESCUCHA DE ESTADO (SOCKETS PARA ANGULAR)
        io.on('connection', (socket) => {
            socket.on('solicitar-estado-whatsapp', () => {
                if (!client) {
                    socket.emit('whatsapp-status', { estado: 'cargando' });
                    return;
                }
                if (client.pupPage && !client.pupPage.isClosed()) {
                    if (client.info && client.info.wid) {
                        socket.emit('whatsapp-status', { estado: 'conectado' });
                    } else {
                        socket.emit('whatsapp-status', { estado: 'esperando_qr' });
                    }
                } else {
                    socket.emit('whatsapp-status', { estado: 'desconectado' });
                }
            });
        });

        // =========================================================================
        // GESTIÓN DE EVENTOS NATIVOS
        // =========================================================================
        client.on('qr', (qr) => {
            console.log('📌 [WHATSAPP]: Nuevo código QR generado. Transmitiendo a Angular...');
            ioInstance.emit('whatsapp-qr', { qr });
            ioInstance.emit('whatsapp-status', { estado: 'esperando_qr' });
        });

        client.on('authenticated', () => {
            console.log('✅ [WHATSAPP]: Sesión autenticada correctamente.');
            ioInstance.emit('whatsapp-status', { estado: 'autenticado' });
        });

        client.on('ready', () => {
            console.log('🚀 [WHATSAPP]: ¡Cliente listo y operando localmente!');
            ioInstance.emit('whatsapp-status', { estado: 'conectado' });
        });

        client.on('remote_session_saved', () => {
            console.log('💾 [WHATSAPP]: Respaldo de sesión guardado con éxito en MongoDB Atlas.');
        });

        client.on('auth_failure', (msg) => {
            console.error('❌ [WHATSAPP]: Fallo en la autenticación:', msg);
            ioInstance.emit('whatsapp-status', { estado: 'error_autenticacion', detalle: msg });
        });

        client.on('disconnected', async (reason) => {
            console.warn('⚠️ [WHATSAPP]: Cliente desconectado. Reiniciando de forma limpia:', reason);
            ioInstance.emit('whatsapp-status', { estado: 'desconectado', detalle: reason });
            try { await client.destroy(); } catch (e) { }
            inicializarWhatsApp(ioInstance);
        });

        // 📩 OYENTE DE MENSAJES ENTRANTES (DICCIONARIO SEMÁNTICO)
        client.on('message', async (msg) => {
            const textoMensaje = msg.body.toLowerCase();
            const palabrasClave = [
                'cotizacion', 'cotización', 'presupuesto', 'solicitud', 'cotizar', 'cotizame', 'precio'
            ];
            const contienePalabraClave = palabrasClave.some(palabra => textoMensaje.includes(palabra));

            if (contienePalabraClave) {
                console.log(`📩 [WHATSAPP]: Mensaje clave detectado de [${msg.from}]`);
                try {
                    // Extraemos metadatos rápidos nativos de la librería de WhatsApp
                    const contacto = await msg.getContact();
                    const nombreCliente = contacto.pushname || 'Cliente por WhatsApp';
                    
                    // Extraemos los dígitos limpios directamente de msg.from
                    const telefonoEnvioCrudo = msg.from.replace('@c.us', ''); 

                    const payloadInicial = {
                        nombreCliente,
                        telefono: `+${telefonoEnvioCrudo}`, // Enviamos el ID nativo crudo para que lo procese el controlador
                        mensajeOriginal: msg.body,
                        canalEntrada: 'whatsapp',
                        tituloAsunto: `Mensaje de WhatsApp - ${nombreCliente}`,
                        fechaOriginal: new Date()
                    };

                    console.log('🚀 [WHATSAPP]: Despachando payload directo al controlador:', payloadInicial);
                    
                    // Invocamos el controlador unificado
                    await procesarSolicitudEntrante(payloadInicial, ioInstance);
                } catch (err) {
                    console.error('❌ [WHATSAPP REQUERIMIENTO ERROR]:', err.stack || err.message);
                }
            }
        });

        // 🛡️ PARCHE SOLO PARA PRODUCCIÓN (Evitamos conflictos en local)
        if (isProduction) {
            const nombreZipFantasma = `RemoteAuth-session-presupuesto-inteligente-prod.zip`;
            if (!fs.existsSync(nombreZipFantasma)) {
                fs.writeFileSync(nombreZipFantasma, '');
            }
        }

        // Inicializar el cliente
        client.initialize().catch(err => console.error('❌ Error en el inicializador:', err.message));

    } catch (error) {
        console.error('❌ Error crítico en el módulo superior de WhatsApp:', error.message);
    }
};


/**
 * Despacha un mensaje de texto plano o con formato a través del cliente activo de whatsapp-web.js
 * @param {string} idInstancia - ID del sistema o del operador (ej: 'presupuesto-inteligente')
 * @param {string} numero - El número de teléfono limpio (ej: 54911xxxxxxx)
 * @param {string} mensaje - El texto formateado de la propuesta comercial
 * @returns {Promise<boolean>} - Devuelve true si el mensaje se envió con éxito
 */
const enviarMensajeWhatsApp = async (idInstancia, numero, mensaje) => {
    try {
        // 1. Recuperar el cliente activo de la pasarela híbrida auto-adaptable
        const client = getWhatsappClient();

        // 2. Control de seguridad por si el bot no está inicializado o escaneado
        if (!client || !client.info || !client.info.wid) {
            console.error(`❌ [WHATSAPP ERROR]: El cliente '${idInstancia}' no está listo o falta escanear el QR.`);
            return false;
        }

        // 3. Estructurar el JID oficial de WhatsApp Web (@c.us)
        // Agregamos un fallback por si el número ya trae el formato de sufijo por error
        const whatsappJID = numero.includes('@c.us') ? numero : `${numero}@c.us`;

        console.log(`📡 [WHATSAPP DISPARADOR]: Enviando presupuesto formal a [${whatsappJID}]...`);

        // 4. Enviar el mensaje usando el método nativo del cliente de Puppeteer
        await client.sendMessage(whatsappJID, mensaje);

        console.log(`✅ [WHATSAPP EXITO]: Mensaje enviado correctamente.`);
        return true;

    } catch (error) {
        console.error(`❌ [CRÍTICO ENVIAR WHATSAPP]: Falló el despacho del mensaje para ${numero}:`, error.message);
        return false;
    }
};

module.exports = {
    inicializarWhatsApp,
    enviarMensajeWhatsApp,
    getWhatsappClient: () => client
};
