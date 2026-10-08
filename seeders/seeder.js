require('dotenv').config();
const mongoose = require('mongoose');

// Importamos tus modelos exactos de Mongoose
const Cliente = require('../models/Cliente');
const Cotizacion = require('../models/Cotizacion');
const Notificacion = require('../models/Notificacion');

// Datos de prueba para Clientes (CRM)
const clientesFalsos = [
    {
        nombre: 'Carlos Mendoza',
        empresa: 'Constructora Alfa',
        telefono: '584141234567',
        correo: 'carlos.mendoza@alfa.com'
    },
    {
        nombre: 'María Alejandra Silva',
        empresa: 'Particular',
        telefono: '584129876543',
        correo: 'mariaalemujica@gmail.com'
    },
    {
        nombre: 'Roberto Gómez',
        empresa: 'Suministros Globales C.A.',
        telefono: '584245556677',
        correo: 'compras@sumiglobal.com'
    }
];

const ejecutarSeeder = async () => {
    try {
        // 1. Validar que la URI exista en el archivo .env
        const dbUri = process.env.DB_MONGO;
        if (!dbUri) {
            console.error('❌ Error: DB_MONGO no está definida en las variables de entorno (.env)');
            process.exit(1);
        }

        // 2. Conectar de forma limpia a MongoDB
        console.log('🔄 Conectando a MongoDB para sembrar datos...');
        await mongoose.connect(dbUri);
        console.log('✅ Conexión establecida.');

        // 3. Limpiar las colecciones existentes para evitar registros huérfanos o duplicados de claves únicas
        console.log('🧹 Limpiando datos antiguos de las colecciones...');
        await Cliente.deleteMany({});
        await Cotizacion.deleteMany({});
        await Notificacion.deleteMany({});

        // 4. Sembrar Clientes y capturar los objetos insertados
        console.log('👤 Insertando clientes en el CRM...');
        const clientesCreados = await Cliente.insertMany(clientesFalsos);
        console.log(`✅ ${clientesCreados.length} Clientes creados con éxito.`);

        // 5. Estructurar Cotizaciones asociándolas dinámicamente a los IDs y aplicando 'articulosDetallados'
        console.log('📦 Estructurando cotizaciones simulando el comportamiento de Gemini y el Scraper...');
        
        const artLaptop = 'Laptop ASUS Rog Strix 16GB RAM';
        const artImpresora = 'Impresora HP Laserjet Pro MFP';
        const artSilla = 'Silla Ergonómica de Oficina Ejecutiva';
        const artEscritorio = 'Escritorio de Madera en L';

        const cotizacionesFalsas = [
            {
                clienteId: clientesCreados[0]._id, // Enlazado a Carlos Mendoza
                productoSolicitado: `1x ${artLaptop}`,
                articulosDetallados: [
                    { cantidad: 1, productoDetalle: artLaptop }
                ],
                canalEntrada: 'whatsapp',
                estado: 'listo_para_enviar',
                // 🌟 VINCULACIÓN INYECTADA: Sincronizamos las ofertas simulando el parseo exitoso de la IA
                proveedoresEncontrados: [
                    { nombreProveedor: 'Amazon', precioCosto: 1150.00, urlOrigen: 'https://amazon.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artLaptop },
                    { nombreProveedor: 'eBay', precioCosto: 1099.99, urlOrigen: 'https://ebay.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artLaptop },
                    { nombreProveedor: 'BestBuy', precioCosto: 1200.00, urlOrigen: 'https://bestbuy.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artLaptop }
                ]
            },
            {
                clienteId: clientesCreados[1]._id, // Enlazado a María Alejandra Silva
                productoSolicitado: `1x ${artImpresora}`,
                articulosDetallados: [
                    { cantidad: 1, productoDetalle: artImpresora }
                ],
                canalEntrada: 'correo',
                estado: 'listo_para_enviar',
                // 🌟 VINCULACIÓN INYECTADA: Reparamos el problema de MercadoLibre y HP que viste en tu captura
                proveedoresEncontrados: [
                    { nombreProveedor: 'MercadoLibre', precioCosto: 280.00, urlOrigen: 'https://mercadolibre.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artImpresora },
                    { nombreProveedor: 'Tienda Oficial HP', precioCosto: 310.00, urlOrigen: 'https://hp.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artImpresora }
                ]
            },
            {
                clienteId: clientesCreados[2]._id, // Enlazado a Roberto Gómez
                productoSolicitado: `2x ${artSilla}, 1x ${artEscritorio}`,
                articulosDetallados: [
                    { cantidad: 2, productoDetalle: artSilla },
                    { cantidad: 1, productoDetalle: artEscritorio }
                ],
                canalEntrada: 'whatsapp',
                estado: 'enviado',
                porcentajeGanancia: 20,
                precioFinalVenta: 180.00,
                // 🌟 VINCULACIÓN INYECTADA: Múltiples proveedores enlazados a artículos distintos del lote
                proveedoresEncontrados: [
                    { nombreProveedor: 'IKEA Sillas', precioCosto: 75.00, urlOrigen: 'https://ikea.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artSilla },
                    { nombreProveedor: 'OfficeMax Escritorios', precioCosto: 150.00, urlOrigen: 'https://officemax.com', contactoProveedor: 'Disponible en sitio web', productoAsociado: artEscritorio }
                ]
            }
        ];

        const cotizacionesCreadas = await Cotizacion.insertMany(cotizacionesFalsas);
        console.log(`✅ ${cotizacionesCreadas.length} Cotizaciones creadas con éxito.`);

        // 6. Sembrar el historial de la campana asociando las referencias a las cotizaciones insertadas
        console.log('🔔 Sembrando historial de la campana de notificaciones...');
        const notificacionesFalsas = [
            {
                titulo: '📦 Nueva Cotización Lista',
                mensaje: `${clientesCreados[0].nombre} (whatsapp) solicitó: 1x Laptop ASUS Rog Strix 16GB RAM`,
                leido: false,
                tipo: 'ANALISIS_COMPLETADO',
                referenciaCotizacionId: cotizacionesCreadas[0]._id
            },
            {
                titulo: '📩 Nueva Cotización Lista',
                mensaje: `${clientesCreados[1].nombre} (correo) solicitó: 1x Impresora HP Laserjet Pro MFP`,
                leido: false,
                tipo: 'ANALISIS_COMPLETADO',
                referenciaCotizacionId: cotizacionesCreadas[1]._id
            },
            {
                titulo: '🚀 Propuesta Despachada',
                mensaje: `Propuesta enviada con éxito a ${clientesCreados[2].nombre} por un total de $180.00`,
                leido: true,
                tipo: 'PROPUESTA_ENVIADA',
                referenciaCotizacionId: cotizacionesCreadas[2]._id
            }
        ];

        await Notificacion.insertMany(notificacionesFalsas);
        console.log('✅ Historial de notificaciones sembrado con éxito.');

        console.log('\n🚀 ¡Proceso de Seeding completado al 100%! Base de datos lista para pruebas modernas.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico ejecutando el seeder:', error.message);
        process.exit(1);
    }
};

ejecutarSeeder();
