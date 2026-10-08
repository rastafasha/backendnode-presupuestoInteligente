const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { procesarSolicitudEntrante } = require('../controllers/cotizacionController');

let ioInstance;

const inicializarLectorCorreos = (io) => {
    ioInstance = io;

    const conectarYEscuchar = async () => {
        // 🌟 LA CLAVE ANTI-REUSE: Instanciamos el cliente ADENTRO de la función de conexión.
        // Forzamos manualmente el string 'imap.gmail.com' limpio para evitar que tome basura del .env
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
                            nombreCliente: correoParseado.from.value[0].name || 'Cliente por Correo',
                            telefono: undefined, 
                            correo: correoParseado.from.value[0].address,
                            mensajeOriginal: cuerpoTexto || asunto,
                            canalEntrada: 'correo',
                            tituloAsunto: asunto || 'Solicitud de Presupuesto',
                            fechaOriginal: correoParseado.date || new Date()
                        };

                        await procesarSolicitudEntrante(payloadInicial, ioInstance);

                        await client.messageFlagsAdd(ultimoId, ['\\Seen']);
                    } else {
                        // Línea de debugging recomendada para que veas en consola qué correos está ignorando el sistema
                        console.log(`ℹ️ [GMAIL IMAP]: Correo ignorado (No cumple con palabras clave). Asunto: "${asunto}"`);
                    }
                });
            } finally {
                // Liberamos el buzón de correo de forma segura
                lock.release();
            }

            // Manejador extra por si el servidor de Gmail cierra la conexión de forma abrupta por inactividad
            client.on('close', () => {
                console.warn('⚠️ [GMAIL IMAP]: Conexión cerrada por el servidor. Intentando reconectar en 30s...');
                setTimeout(conectarYEscuchar, 30000);
            });

        } catch (err) {
            console.error('❌ [GMAIL IMAP ERROR]: Falló la conexión del lector:', err.message);
            
            // 🛡️ Cerramos la instancia colgada de forma segura si existiera
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
