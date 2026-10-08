const { GoogleGenerativeAI, Type } = require('@google/generative-ai');

// Inicializar el SDK con tu clave del .env
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analiza el texto de un correo o WhatsApp para extraer información estructurada del cliente y su solicitud.
 */
const analizarMensajeCotizacion = async (textoMensaje) => {
    try {
        const modelo = genAI.getGenerativeModel(
            { model: 'gemini-1.5-flash' },
            { apiVersion: 'v1' }
        );

        const promptSistema = `
            Eres un asistente de IA experto en operaciones comerciales y CRM.
            Tu objetivo es analizar un correo o WhatsApp de solicitud de presupuesto y extraer la información de forma estructurada.
            
            Debes extraer con precisión:
            1. El nombre real del remitente (ej. "Malcolm Córdova"). No inventes nombres si no existen.
            2. El nombre de la empresa (ej. "Klyntic"). Si no se menciona, usa "Particular".
            3. Una LISTA DETALLADA de los productos solicitados. Cada ítem de la lista debe tener obligatoriamente: cantidad, descripción del producto (incluyendo modelos, procesadores o variaciones mencionadas) y notas adicionales si aplica.

            Analiza detalladamente este mensaje: "${textoMensaje}"
        `;

        const resultado = await modelo.generateContent({
            contents: [{ role: 'user', parts: [{ text: promptSistema }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        nombreExtraido: { type: 'STRING', description: 'Nombre completo del remitente.' },
                        empresa: { type: 'STRING', description: 'Empresa o "Particular".' },
                        // Cambiamos el string plano por un arreglo robusto de objetos
                        productosLista: {
                            type: 'ARRAY',
                            description: 'Lista de ítems explícitamente solicitados en el mensaje.',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    cantidad: { type: 'NUMBER', description: 'Cantidad solicitada. Si no se especifica, asume 1.' },
                                    productoDetalle: { type: 'STRING', description: 'Nombre claro del producto con sus variables (Ej: "MacBook Pro M1 a M4").' }
                                },
                                required: ['cantidad', 'productoDetalle']
                            }
                        }
                    },
                    required: ['nombreExtraido', 'empresa', 'productosLista'],
                },
            },
        });

        return JSON.parse(resultado.response.text());

    } catch (error) {
        console.error('❌ [GEMINI SERVICE ERROR]:', error);
        // Respuesta de contingencia estructurada correctamente
        return { 
            nombreExtraido: 'Cliente Nuevo', 
            empresa: 'Particular', 
            productosLista: [{ cantidad: 1, productoDetalle: 'Producto por analizar' }] 
        };
    }
};

module.exports = { analizarMensajeCotizacion };
