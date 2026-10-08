const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo'); // Almacén en MongoDB Atlas contra reinicios de Render
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let client;
let ioInstance;

const inicializarWhatsApp = async (io) => {
    ioInstance = io;
    console.log('🔄 [WHATSAPP]: Inicializando pasarela unificada de alto rendimiento...');

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        
        // 💾 1. ESTRATEGIA DE AUTENTICACIÓN REMOTA CONTROLADA
        const store = new MongoStore({ mongoose: mongoose });

        client = new Client({
            authTimeoutMs: 120000, // 2 minutos de tolerancia para evitar caídas por timeout
            qrMaxImages: 3,
            takeoverOnConflict: true, 
            takeoverTimeoutMs: 10000,
            
            // Configuración dinámica de persistencia: Atlas para la nube, local para tu Mac
            authStrategy: new RemoteAuth({
                store: store,
                backupSyncIntervalMs: 300000, // Sincroniza la sesión cada 5 minutos
                clientId: isProduction ? 'presupuesto-inteligente-prod' : 'presupuesto-inteligente-local',
                dataPath: isProduction ? '/tmp' : './.wwebjs_auth' // Evita errores de permisos de escritura en Render
            }),

            webVersionCache: { type: 'local' }, // Usa caché local para estabilidad de scripts

            puppeteer: {
                headless: true,
                // 🎭 REDUCCIÓN CRÍTICA DE RAM VISUAL: Optimiza la escala y desactiva la renderización de la CPU
                defaultViewport: { width: 800, height: 600 },
                
                // 🎯 RUTA DEL EJECUTABLE DINÁMICA SEGÚN EL ENTORNO
                executablePath: isProduction
                    ? '/opt/render/project/src/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome' // Binario estable de Render
                    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Tu Chrome nativo de Mac
                
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', // Blindaje supremo contra colapsos de RAM en contenedores
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions',
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    
                    // Impedir que WhatsApp Web se duerma o congele en segundo plano
                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-software-rasterizer',
                    '--process-per-tab',
                    '--disable-web-security',
                    '--force-device-scale-factor=1',

                    // 🧠 RESTRICCIÓN DEL MOTOR V8 DE RAM PARA CHROMIUM
                    isProduction ? '--js-flags=--max-old-space-size=100' : '--js-flags=--max-old-space-size=4096',
                    ...(isProduction ? ['--single-process'] : []) // Hilo secuencial único en producción para evitar detached frames
                ]
            }
        });

        // 📡 2. INTERCEPTOR DE PETICIONES DE CHROMIUM (Ahorro del 70% de consumo de RAM)
        client.on('pup_page_created', async (page) => {
            try {
                await page.setRequestInterception(true);
                page.on('request', (request) => {
                    const resourceType = request.resourceType();
                    // Bloqueamos la descarga de imágenes, tipografías y audios pesados que saturan la memoria
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

        // 📌 3. ESCUCHA REACTIVA DE ESTADO (SOCKETS PARA ANGULAR)
        io.on('connection', (socket) => {
            socket.on('solicitar-estado-whatsapp', () => {
                console.log('📌 [SOCKET]: Angular solicitó el estado actual de la pasarela.');
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
        // 📡 GESTIÓN DE EVENTOS NATIVOS MIGRADOS
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
            console.log('🚀 [WHATSAPP]: ¡Cliente listo, conectado y persistido en Atlas!');
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
            console.warn('⚠️ [WHATSAPP]: Cliente desconectado. Limpiando y relanzando:', reason);
            ioInstance.emit('whatsapp-status', { estado: 'desconectado', detalle: reason });
            try { await client.destroy(); } catch (e) {}
            inicializarWhatsApp(ioInstance);
        });

        // 📩 OYENTE DE SOLICITUDES ENTRANTES (DICCIONARIO FLEXIBILIZADO)
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
                        telefono: `+${telefono}`, // Le inyectamos el prefijo internacional para consistencia del CRM
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

        // 🛡️ PARCHE DE ORO CONTRA EL BUG ENOENT DE LA LIBRERÍA
        const nombreZipFantasma = `RemoteAuth-session-${isProduction ? 'presupuesto-inteligente-prod' : 'presupuesto-inteligente-local'}.zip`;
        if (!fs.existsSync(nombreZipFantasma)) {
            fs.writeFileSync(nombreZipFantasma, '');
            console.log(`🛡️ [PARCHE] Archivo fantasma ${nombreZipFantasma} inyectado con éxito.`);
        }

        // Lanzar inicialización asíncrona
        client.initialize().catch(err => console.error('❌ Error en el inicializador:', err.message));

    } catch (error) {
        console.error('❌ Error crítico en el módulo superior de WhatsApp:', error.message);
    }
};

module.exports = {
    inicializarWhatsApp,
    getWhatsappClient: () => client
};
