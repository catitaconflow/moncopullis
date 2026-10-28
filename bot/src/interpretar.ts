// Convierte el texto del operario en {diio, medicamento, cantidad}.
// Con GEMINI_API_KEY se usa Gemini; sin clave o si Gemini falla, un lector simple de reglas.
// El resultado siempre se valida después en la base y el operario lo confirma antes de guardar.

export interface Interpretacion {
  diio: string | null;
  medicamento: string | null;
  cantidad: number | null;
}

const PALABRAS_VACIAS = new Set([
  'aplique', 'apliqué', 'aplica', 'aplicar', 'aplicado', 'puse', 'le', 'se', 'a', 'al', 'la', 'el', 'los', 'las',
  'de', 'del', 'con', 'en', 'una', 'un', 'dosis', 'vaca', 'vaquilla', 'ternero', 'toro', 'animal', 'diio', 'hoy',
  'y', 'para', 'registrar', 'por', 'favor', 'inyecte', 'inyecté', 'di', 'medicamento',
]);
const UNIDAD = '(?:ml|cc|mililitros?|g|gr|gramos?|u|unidades?)';

export function interpretarLocal(texto: string): Interpretacion {
  const diio = texto.match(/\b\d{9}\b/)?.[0] ?? null;
  const sinDiio = diio ? texto.replace(diio, ' ') : texto;
  const cant = sinDiio.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNIDAD}?\\b`, 'i'));
  const cantidad = cant ? Number(cant[1].replace(',', '.')) : null;
  const resto = (cant ? sinDiio.replace(cant[0], ' ') : sinDiio)
    .replace(new RegExp(`\\b${UNIDAD}\\b`, 'gi'), ' ')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((p) => p && !PALABRAS_VACIAS.has(p.toLowerCase()));
  return { diio, medicamento: resto.length ? resto.join(' ') : null, cantidad };
}

const INSTRUCCION =
  'Eres el asistente de registro sanitario de un predio lechero en Chile. Del mensaje del operario extrae ' +
  'el DIIO del animal (9 dígitos), el nombre del medicamento tal como lo escribió y la cantidad aplicada (solo el número). ' +
  'Si un dato no aparece, devuélvelo como null. No inventes datos.';

export async function interpretarConGemini(texto: string, clave: string, fetcher: typeof fetch = fetch): Promise<Interpretacion> {
  const res = await fetcher('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCCION }] },
      contents: [{ role: 'user', parts: [{ text: texto.slice(0, 1000) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            diio: { type: 'STRING', nullable: true },
            medicamento: { type: 'STRING', nullable: true },
            cantidad: { type: 'NUMBER', nullable: true },
          },
          required: ['diio', 'medicamento', 'cantidad'],
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const datos = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const crudo = JSON.parse(datos.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as Partial<Interpretacion>;
  return {
    diio: typeof crudo.diio === 'string' && /^\d{9}$/.test(crudo.diio) ? crudo.diio : null,
    medicamento: typeof crudo.medicamento === 'string' && crudo.medicamento.trim() ? crudo.medicamento.trim() : null,
    cantidad: typeof crudo.cantidad === 'number' && crudo.cantidad > 0 ? crudo.cantidad : null,
  };
}

export async function interpretar(texto: string, claveGemini?: string, fetcher: typeof fetch = fetch): Promise<Interpretacion> {
  const local = interpretarLocal(texto);
  if (!claveGemini) return local;
  try {
    const g = await interpretarConGemini(texto, claveGemini, fetcher);
    // El DIIO escrito con sus 9 dígitos manda sobre lo que proponga el modelo
    return { diio: local.diio ?? g.diio, medicamento: g.medicamento ?? local.medicamento, cantidad: g.cantidad ?? local.cantidad };
  } catch {
    return local;
  }
}
