const { GoogleGenerativeAI, Type } = require('@google/generative-ai');

// Inicializar el SDK con tu clave del .env
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analiza el texto de un correo o WhatsApp para extraer información estructurada del cliente y su solicitud.
 */
const analizarMensajeCotizacion = async (textoMensaje) => {
    try {
        // Habilitamos v1beta para soportar responseSchema con JSON mode de forma estable
        const modelo = ai.getGenerativeModel(
            { model: 'gemini-2.5-flash' },
            { apiVersion: 'v1beta' }
        );

        const promptSistema = `
            Actúa como un agente experto en operaciones de sistemas CRM y procesamiento analítico de datos comerciales.
            Tu tarea consiste en extraer de forma quirúrgica la información de una solicitud entrante para estructurarla en un formato JSON limpio.

            INSTRUCCIONES CRÍTICAS DE EXTRACCIÓN:
            1. NOMBRE DEL REMITENTE: Busca en el cuerpo o rigurosamente en la firma corporativa (debajo de '--'). Extrae el nombre real completo (Ej: "Malcolm Córdova"). Ignora títulos como Ing., Lic., Dr., etc.
            2. EMPRESA: Identifica la organización (Ej: "Klyntic"). Si es un correo personal o no hay rastro institucional, coloca "Particular".
            3. CANALES DE CONTACTO: Extrae el correo electrónico de contacto institucional que figure en la firma. Busca y extrae los números telefónicos/móviles completos incluyendo su código de área o prefijo internacional (Ej: "+58 412-952.88.00"). Si hay varios, sepáralos por comas.
            4. LISTADO DE PRODUCTOS: Mapea línea por línea cada artículo solicitado con su cantidad numérica exacta y su descripción técnica con variables (modelos, procesadores, gamas). Si no se especifica cantidad, asume 1.

            MENSAJE ENTRANTE DEL CLIENTE PARA ANALIZAR:
            """
            ${textoMensaje}
            """
        `;

        const resultado = await modelo.generateContent({
            contents: [{ role: 'user', parts: [{ text: promptSistema }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        nombreExtraido: { type: 'STRING', description: 'Nombre completo y real del remitente.' },
                        empresa: { type: 'STRING', description: 'Nombre comercial de la empresa o "Particular".' },
                        correoContacto: { type: 'STRING', description: 'Email institucional extraído de la firma del remitente.' },
                        telefonos: { type: 'STRING', description: 'Teléfono o teléfonos corporativos con formato internacional si aplica.' },
                        productosLista: {
                            type: 'ARRAY',
                            description: 'Colección indexada de cada uno de los productos o servicios solicitados.',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    cantidad: { type: 'NUMBER', description: 'Cantidad física solicitada.' },
                                    productoDetalle: { type: 'STRING', description: 'Descripción detallada con variaciones de modelo o capacidad.' }
                                },
                                required: ['cantidad', 'productoDetalle']
                            }
                        }
                    },
                    // Añadimos las nuevas propiedades como requeridas por la estructura del validador
                    required: ['nombreExtraido', 'empresa', 'correoContacto', 'telefonos', 'productosLista'],
                },
            },
        });

        const respuestaJson = JSON.parse(resultado.response.text());
        console.log("🧠 [GEMINI PARSER]: Respuesta estructurada obtenida con éxito:", respuestaJson);
        return respuestaJson;

    } catch (error) {
        console.error('❌ [GEMINI SERVICE ERROR]: Falló la extracción estructurada del mensaje:', error);
        return { 
            nombreExtraido: 'Cliente Nuevo', 
            empresa: 'Particular',
            correoContacto: '',
            telefonos: '', 
            productosLista: [{ cantidad: 1, productoDetalle: 'Producto por analizar' }] 
        };
    }
};

module.exports = { analizarMensajeCotizacion };
