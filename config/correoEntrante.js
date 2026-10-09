const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');

let ioInstance;

const inicializarLectorCorreos = (io) => {
    ioInstance = io;

       const conectarYEscuchar = async () => {
        // Instanciamos el cliente adentro de la función de conexión para evitar que se congele.
        const client = new ImapFlow({
            host: 'imap.gmail.com', 
            port: 993,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            logger: false
        });

        // 🌟 EL ESCUCHADOR SALVADOR: Evita que Node.js crashee (Unhandled error) si Gmail da un Timeout de red
        client.on('error', (err) => {
            console.error('⚠️ [GMAIL IMAP SOCKET ERROR]: Detectado parpadeo de red o Timeout:', err.message);
            // No hacemos nada más aquí; dejamos que el evento 'close' o el catch superior gatillen el reintento limpio
        });

        try {
            await client.connect();
            console.log('✅ [GMAIL IMAP]: Conectado con éxito y escuchando la bandeja de entrada...');

            let lock = await client.getMailboxLock('INBOX');
            try {
                client.on('exists', async (data) => {
                    let listaMensajes = await client.search({ seen: false });
                    if (listaMensajes.length === 0) return;

                    let ultimoId = listaMensajes[listaMensajes.length - 1];
                    let correoCrudo = await client.fetchOne(ultimoId, { source: true });
                    
                    let correoParseado = await simpleParser(correoCrudo.source);
                    
                    const asunto = correoParseado.subject || '';
                    const cuerpoTexto = correoParseado.text || '';
                    const textoCompleto = `${asunto} ${cuerpoTexto}`.toLowerCase();

                    const palabrasClave = [
                        'cotizacion', 'cotización', 'cotizaciones', 'cotizar', 'cotízame', 'cotizame', 'cotizo',
                        'presupuesto', 'presupuestos', 'presupuestar', 'presupuestame', 'presupuestame',
                        'solicitud', 'solicitudes', 'solicitar', 'requerimiento', 'requiero', 'comprar'
                    ];
                    const contienePalabraClave = palabrasClave.some(palabra => textoCompleto.includes(palabra));

                    if (contienePalabraClave) {
                        console.log(`📩 [GMAIL IMAP]: Solicitud válida detectada por correo electrónico de: ${correoParseado.from.text}`);

                        const payloadInicial = {
                            nombreCliente: correoParseado.from.value.name || 'Cliente por Correo',
                            telefono: undefined, 
                            correo: correoParseado.from.value.address,
                            mensajeOriginal: cuerpoTexto || asunto,
                            canalEntrada: 'correo',
                            tituloAsunto: asunto || 'Solicitud de Presupuesto',
                            fechaOriginal: correoParseado.date || new Date()
                        };

                        await procesarSolicitudEntrante(payloadInicial, ioInstance);

                        await client.messageFlagsAdd(ultimoId, ['\\Seen']);
                    }
                });
            } finally {
                // Liberamos el buzón de correo de forma segura
                if (lock) lock.release();
            }

            // Manejador por si el servidor de Gmail cierra la conexión abruptamente por inactividad (Idletimeout)
            client.on('close', () => {
                console.warn('⚠️ [GMAIL IMAP]: Conexión cerrada. Intentando reconectar de forma limpia en 30s...');
                setTimeout(conectarYEscuchar, 30000);
            });

        } catch (err) {
            console.error('❌ [GMAIL IMAP ERROR]: Falló la conexión del lector:', err.message);
            
            // Cerramos la instancia colgada de forma segura si existiera
            try { await client.logout(); } catch(e) {}
            
            // Reintento automático generando una instancia totalmente nueva en el próximo ciclo
            console.log('🔄 [GMAIL IMAP]: Programando reintento de conexión limpia en 30 segundos...');
            setTimeout(conectarYEscuchar, 30000);
        }
    };


    // Arrancamos el primer ciclo de escucha
    conectarYEscuchar();
};

module.exports = { inicializarLectorCorreos };
