const { GoogleGenAI, Type } = require('@google/generative-ai');

// Inicializar el SDK con tu clave del .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Busca proveedores, precios y enlaces web para un producto específico en tiempo real
 * utilizando la herramienta de búsqueda en vivo nativa de Google Gemini.
 * @param {string} producto - El nombre del producto limpio formateado por Gemini.
 * @returns {Promise<Array>} - Lista de objetos proveedores con nombre, precio de costo y URL.
 */
const buscarProveedoresWeb = async (producto) => {
    try {
        console.log(`🔎 [GEMINI SEARCH]: Buscando proveedores reales en Google para: "${producto}"...`);
        
        // Usamos el modelo estándar
        const modelo = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const promptAgente = `
            Actúa como un agente experto en compras y análisis de mercado para e-commerce.
            Necesito que busques en la web tiendas en línea, distribuidores o proveedores reales de este producto: "${producto}".
            
            Debes extraer una lista de exactamente 3 opciones distintas encontrados en los resultados de búsqueda.
            Para cada opción necesito:
            1. El nombre de la tienda o proveedor (ej. MercadoLibre, Amazon, Alibaba, o tiendas locales especializadas).
            2. El precio de costo estimado expresado numéricamente sin letras ni signos de moneda.
            3. La URL o enlace directo de la página web del proveedor.

            Asegúrate de basarte en información comercial real de internet.
        `;

        // 🔥 LA CLAVE: Activamos la herramienta 'googleSearch' nativa de Gemini
        const resultado = await modelo.generateContent({
            contents: [{ role: 'user', parts: [{ text: promptAgente }] }],
            tools: [{ googleSearch: {} }], // <--- Esto obliga a Gemini a conectarse a Google en vivo
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    description: 'Lista de los mejores 3 proveedores encontrados en la web.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            nombreProveedor: { 
                                type: Type.STRING, 
                                description: 'Nombre de la tienda, distribuidor o plataforma e-commerce.' 
                            },
                            precioCosto: { 
                                type: Type.NUMBER, 
                                description: 'Precio del producto como número flotante o entero. Ejemplo: 89.99' 
                            },
                            urlOrigen: { 
                                type: Type.STRING, 
                                description: 'URL completa del sitio web encontrado. Ejemplo: https://tienda.com' 
                            },
                            contactoProveedor: { 
                                type: Type.STRING, 
                                description: 'Texto descriptivo fijo: "Disponible en sitio web".' 
                            }
                        },
                        required: ['nombreProveedor', 'precioCosto', 'urlOrigen', 'contactoProveedor'],
                    }
                }
            }
        });

        // Parseamos la respuesta estructurada limpia
        const proveedoresFormateados = JSON.parse(resultado.response.text);
        
        console.log(`✅ [GEMINI SEARCH]: Búsqueda finalizada con éxito. Se inyectarán ${proveedoresFormateados.length} filas.`);
        return proveedoresFormateados;

    } catch (error) {
        console.error('❌ [GEMINI SEARCH ERROR]: Falló la búsqueda en vivo:', error.message);
        
        // Datos de contingencia en caso de que alcances el límite de cuota gratuita en desarrollo
        return [
            { nombreProveedor: 'Distribuidor Local A', precioCosto: 45.00, urlOrigen: 'https://google.com', contactoProveedor: 'Disponible en sitio web' },
            { nombreProveedor: 'Mayorista Web B', precioCosto: 52.50, urlOrigen: 'https://google.com', contactoProveedor: 'Disponible en sitio web' },
            { nombreProveedor: 'Tienda Online C', precioCosto: 49.99, urlOrigen: 'https://google.com', contactoProveedor: 'Disponible en sitio web' }
        ];
    }
};

module.exports = {
    buscarProveedoresWeb
};