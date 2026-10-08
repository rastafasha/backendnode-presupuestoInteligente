require('dotenv').config();
const express = require('express');
const { dbConnection } = require('./database/config'); // Tu conexión a Mongo
const cors = require('cors');

const path = require('path');
const socketIO = require('socket.io');

const { inicializarWhatsApp } = require('./config/whatsapp');
const { inicializarLectorCorreos } = require('./config/correoEntrante'); 

// Crear servidores
const app = express();
const server = require('http').Server(app);

// 🌐 Orígenes permitidos (Aquí está tu Angular)
const allowedOrigins = [
    "http://localhost:4200",
    "http://localhost:4203",
    "http://localhost:3000",
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`[CORS RECHAZADO]: El origen ${origin} no tiene permisos.`);
            callback(new Error('Origin no permitido por CORS'));
        }
    },
    allowedHeaders: ["Content-Type", "Authorization", "x-token", "X-Token", "Accept"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    optionsSuccessStatus: 200
};

// Aplicar CORS
app.use(cors(corsOptions));

// ⚡ Inicializar Socket.io con tus configuraciones estables de Render/Producción
const io = socketIO(server, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Exportamos io para el resto de la app
module.exports.io = io;

// Cargar eventos de sockets pasándole el io
require('./sockets/socket')(io);

// =========================================================================
// 🚀 ARRANQUE SECUENCIAL COMPLETO 
// =========================================================================
const startServer = async () => {
    try {
        // 1. Conectamos la base de datos primero
        await dbConnection();
        console.log('📦 Inicialización de base de datos completada.');

        // 2. Middlewares globales
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // 🔥 TU INYECTOR SALVAVIDAS: Inyectamos el objeto IO en cada petición HTTP
        app.use((req, res, next) => {
            req.io = io;
            next();
        });

        // =========================================================================
        // 🌐 DECLARACIÓN DE RUTAS DE TU NUEVA API
        // =========================================================================
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/usuarios', require('./routes/usuarios'));
        app.use('/api/clientes', require('./routes/clientesRoutes'));
        app.use('/api/cotizaciones', require('./routes/cotizacionesRoutes'));
        app.use('/api/notipush', require('./routes/notipushRoutes'));
        app.use('/api/notificaciones', require('./routes/notificacionesRoutes'));
        app.use('/api/profile', require('./routes/profile'));
        app.use('/api/todo', require('./routes/busquedas'));

        // Test Endpoint
        app.get("/api/status", (req, res) => {
            res.json({ status: "online", message: "Backend de Presupuestos listo." });
        });

        // 🚨 ENCENDIDO DEL PUERTO
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Servidor de Presupuestos ejecutándose en puerto: ${PORT}`);
            
            // Inicializar pasarela de WhatsApp
            console.log('⏱️ Iniciando pasarela de WhatsApp en segundo plano...');
            inicializarWhatsApp(io); 

            // 🔥 Inicializar pasarela de Gmail IMAP
            console.log('⏱️ Iniciando escucha de Gmail IMAP en segundo plano...');
            inicializarLectorCorreos(io); 
        });

        // Manejador global de errores
        app.use((err, req, res, next) => {
            console.error('Global error handler:', err);
            res.status(500).json({ ok: false, msg: 'Internal Server Error', error: err.message });
        });

    } catch (error) {
        console.error('❌ Error crítico inicializando el servidor:', error.message);
        process.exit(1);
    }
};

startServer().catch(err => {
    console.error('Error starting server:', err);
    process.exit(1);
});

module.exports = { app, server, io };
