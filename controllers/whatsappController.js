const ConexionWhatsapp = require('../models/ConexionWhatsapp');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Diccionario temporal para mantener los clientes activos en memoria
const clientesActivos = {};

exports.conectarWhatsapp = async (req, res) => {
  try {
    const { usuarioId, numeroTelefono } = req.body;

    // 1. Guardar o actualizar la conexión en MongoDB
    let conexion = await ConexionWhatsapp.findOne({ usuarioId });
    if (!conexion) {
      conexion = new ConexionWhatsapp({ usuarioId, numeroTelefono, estadoConexion: 'pendiente' });
    } else {
      conexion.numeroTelefono = numeroTelefono;
      conexion.estadoConexion = 'pendiente';
    }
    await conexion.save();

    // 2. Inicializar whatsapp-web.js para este usuario usando LocalAuth
    // Esto crea una carpeta de sesión única para este usuario específico
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: usuarioId }),
      puppeteer: { headless: true, args: ['--no-sandbox'] }
    });

    client.on('qr', (qr) => {
      // AQUÍ: Puedes enviar el QR a tu frontend de Angular mediante WebSockets (Socket.io)
      console.log(`[QR] Escanea este código para el usuario ${usuarioId}`);
    });

    client.on('ready', async () => {
      console.log(`[WhatsApp] ¡Cliente listo para el usuario ${usuarioId}!`);
      conexion.estadoConexion = 'conectado';
      await conexion.save();
    });

    client.on('message', async (msg) => {
      // AQUÍ: Capturas cuando el teléfono te escribe algo
      // Ej: "Gaste 500" -> Buscas la conexión por el número, sacas el usuarioId y guardas el gasto
      if (msg.body.toLowerCase().includes('gaste')) {
        msg.reply('¡Entendido! Registrando tu gasto en el Presupuesto Inteligente.');
      }
    });

    client.initialize();
    
    // Guardamos la instancia en memoria para poder usarla luego
    clientesActivos[usuarioId] = client;

    res.status(200).json({ message: 'Inicializando WhatsApp, revisa la consola para el QR.' });

  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar la conexión de WhatsApp' });
  }
};