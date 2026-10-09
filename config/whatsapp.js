const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo'); 
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');
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
            authTimeoutMs: 240000, // Subimos a 4 minutos de tolerancia para conexiones lentas
            qrMaxImages: 5,        
            takeoverOnConflict: true, 
            takeoverTimeoutMs: 15000,
            
            authStrategy: estrategiaAutenticacion, // Inyectamos la estrategia elegida

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
                    
                    // Identidad real de Google Chrome en Mac
                    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    
                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-software-rasterizer',
                    '--process-per-tab',
                    '--force-device-scale-factor=1',
                    '--disable-component-update',

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
            try { await client.destroy(); } catch (e) {}
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
                    const contacto = await msg.getContact();
                    const nombreCliente = contacto.pushname || 'Cliente por WhatsApp';
                    const telefono = msg.from.replace('@c.us', '');

                    const payloadInicial = {
                        nombreCliente,
                        telefono: `+${telefono}`, 
                        mensajeOriginal: msg.body,
                        canalEntrada: 'whatsapp',
                        tituloAsunto: `Mensaje de WhatsApp - ${nombreCliente}`,
                        fechaOriginal: new Date()
                    };

                    await procesarSolicitudEntrante(payloadInicial, ioInstance);
                } catch (err) {
                    console.error('❌ [WHATSAPP REQUERIMIENTO ERROR]:', err);
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

module.exports = {
    inicializarWhatsApp,
    getWhatsappClient: () => client
};
