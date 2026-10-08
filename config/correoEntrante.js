const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');

let ioInstance;

const inicializarLectorCorreos = (io) => {
    ioInstance = io;

    const client = new ImapFlow({
        // 🟢 CORRECCIÓN: Debe ser estrictamente el string limpio sin "://", "imap://" ni "https://"
        host: 'imap.gmail.com', 
        port: 993,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        logger: false
    });

    const conectarYEscuchar = async () => {
        try {
            await client.connect();
            console.log('✅ [GMAIL IMAP]: Conectado y escuchando la bandeja de entrada...');

            // Abrimos la bandeja principal (INBOX) en modo lectura/escritura
            let lock = await client.getMailboxLock('INBOX');
            try {
                // Escuchamos el evento de nueva mensajería
                client.on('exists', async (data) => {
                    // Buscamos el último correo recibido sin leer
                    let listaMensajes = await client.search({ seen: false });
                    if (listaMensajes.length === 0) return;

                    let ultimoId = listaMensajes[listaMensajes.length - 1];
                    let correoCrudo = await client.fetchOne(ultimoId, { source: true });
                    
                    // Parseamos el cuerpo del email con mailparser
                    let correoParseado = await simpleParser(correoCrudo.source);
                    
                    const asunto = correoParseado.subject || '';
                    const cuerpoTexto = correoParseado.text || '';
                    const textoCompleto = `${asunto} ${cuerpoTexto}`.toLowerCase();

                    // Validamos tus palabras clave obligatorias
                    const palabrasClave = ['cotización', 'cotizacion', 'presupuesto', 'solicitud'];
                    const contienePalabraClave = palabrasClave.some(palabra => textoCompleto.includes(palabra));

                    if (contienePalabraClave) {
                        console.log(`📩 [GMAIL IMAP]: Solicitud detectada por correo electrónico de: ${correoParseado.from.text}`);

                        const payloadInicial = {
                            nombreCliente: correoParseado.from.value[0].name || 'Cliente por Correo',
                            telefono: undefined, // En correo no viene teléfono inicialmente
                            correo: correoParseado.from.value[0].address,
                            mensajeOriginal: cuerpoTexto || asunto,
                            canalEntrada: 'correo'
                        };

                        // 🔥 Derivamos al mismo controlador de Mongo/Gemini/Sockets que usa WhatsApp
                        await procesarSolicitudEntrante(payloadInicial, ioInstance);

                        // Marcamos el correo como leído para no procesarlo dos veces
                        await client.messageFlagsAdd(ultimoId, ['\\Seen']);
                    }
                });
            } finally {
                lock.release();
            }
        } catch (err) {
            console.error('❌ [GMAIL IMAP ERROR]: Falló la conexión del lector:', err.message);
            // Reintento automático de conexión si se cae el socket de Gmail
            setTimeout(conectarYEscuchar, 30000);
        }
    };

    conectarYEscuchar();
};

module.exports = { inicializarLectorCorreos };
