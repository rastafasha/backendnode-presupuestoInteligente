// 🟢 CORRECCIÓN: Usar GoogleGenerativeAI en lugar de GoogleGenAI
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializar el SDK con la API Key del archivo .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); //

/**
 * Analiza el texto de un correo o WhatsApp para extraer información estructurada del cliente y su solicitud.
 */
const analizarMensajeCotizacion = async (textoMensaje) => {
    try {
        // Inicializamos el modelo de velocidad flash
        const modelo = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); //

        const promptSistema = `
            Eres un asistente de inteligencia artificial experto en preventa y operaciones comerciales.
            Tu objetivo es analizar un mensaje entrante (de WhatsApp o Correo) de un cliente que solicita un presupuesto.
            
            Debes extraer con precisión:
            1. El nombre real del remitente (si se presenta, no uses apodos de chat).
            2. El nombre de la empresa u organización (si la menciona, si no, coloca "Particular").
            3. El nombre claro, específico y conciso del producto o servicio que solicita cotizar.

            Analiza el siguiente mensaje: "${textoMensaje}"
        `;

        // Aplicamos el JSON mode compatible con la sintaxis de Mongoose
        const resultado = await modelo.generateContent({
            contents: [{ role: 'user', parts: [{ text: promptSistema }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT', // Pasamos el string directo para evitar problemas de tipos
                    properties: {
                        nombreExtraido: { type: 'STRING', description: 'Nombre del cliente.' },
                        empresa: { type: 'STRING', description: 'Empresa o "Particular".' },
                        productoFormateado: { type: 'STRING', description: 'El producto limpio.' }
                    },
                    required: ['nombreExtraido', 'empresa', 'productoFormateado'],
                },
            },
        });

        return JSON.parse(resultado.response.text()); //

    } catch (error) {
        console.error('❌ [GEMINI SERVICE]: Error:', error);
        return { nombreExtraido: '', empresa: 'Particular', productoFormateado: 'Producto no identificado' };
    }
};

module.exports = { analizarMensajeCotizacion };
