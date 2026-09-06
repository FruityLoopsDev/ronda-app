// privacy-policy.ts: Protocolo estricto de privacidad y anti-contacto para RONDA

export interface ContactViolationResult {
  prohibited: boolean;
  reason?: string;
  detectedType?: 'phone' | 'whatsapp' | 'social' | 'email' | 'address' | 'intent';
}

const NUMBER_WORDS_MAP: Record<string, string> = {
  'cero': '0', 'uno': '1', 'una': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
  'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9'
};

export class PrivacyPolicy {
  /**
   * Mensaje oficial de advertencia
   */
  static readonly PROHIBITED_MESSAGE = 
    '⚠️ Está estrictamente prohibido compartir números de WhatsApp, teléfonos, redes sociales o direcciones. ' +
    'RONDA protege la privacidad e integridad de todos los miembros. Las citas y conversaciones se coordinan únicamente a través de la plataforma y en locales aliados.';

  /**
   * Analiza un texto para detectar cualquier intento de intercambiar WhatsApp,
   * números de teléfono, redes sociales, direcciones o enlaces externos.
   */
  static detectProhibitedContact(input: string): ContactViolationResult {
    if (!input || typeof input !== 'string') {
      return { prohibited: false };
    }

    const text = input.trim();
    if (!text) return { prohibited: false };

    // 1. Detección directa de palabras clave de WhatsApp
    const waKeywordsRegex = /\b(whatsapp|wpp|wa\.me|watsap|wasap|wts|guasap|wapp|whastapp|wha|wsapp|whats|whtasapp)\b/i;
    if (waKeywordsRegex.test(text)) {
      return {
        prohibited: true,
        reason: 'Se detectó mención a WhatsApp o mensajería externa.',
        detectedType: 'whatsapp'
      };
    }

    // 2. Normalización de texto para buscar teléfonos camuflados
    // Reemplaza palabras numéricas escritas (ej: "tres uno dos...")
    let textNormalized = text.toLowerCase();
    for (const [word, digit] of Object.entries(NUMBER_WORDS_MAP)) {
      const reg = new RegExp(`\\b${word}\\b`, 'gi');
      textNormalized = textNormalized.replace(reg, digit);
    }

    // Extraer secuencias numéricas ignorando espacios, puntos, guiones, paréntesis o barras
    // Ej: "3 1 2 4 5 6 7 8 9 0", "312-456-7890", "(312) 456 7890", "+57 300 123 4567"
    const pureDigits = textNormalized.replace(/[^\d]/g, '');

    // Si contiene 7 o más dígitos consecutivos o agrupados en total
    if (pureDigits.length >= 7) {
      // Verificar si los dígitos aparecen en una proximidad que sugiere un número de teléfono
      const spacedDigitsRegex = /(\+?\d[\s.\-_/()]*){7,14}/;
      if (spacedDigitsRegex.test(textNormalized)) {
        return {
          prohibited: true,
          reason: 'Se detectó un número telefónico o secuencia numérica sospechosa.',
          detectedType: 'phone'
        };
      }
    }

    // 3. Detección de Redes Sociales y Usuarios (@usuario, instagram, telegram, tiktok, facebook, twitter/x)
    const socialRegex = /(@[a-zA-Z0-9._]{3,}|instagram(\.com)?|ig\s*:\s*|telegram|tg\s*:\s*|t\.me\/|tiktok(\.com)?|facebook(\.com)?|fb\s*:\s*|twitter(\.com)?|x\.com\/|snapchat|discord)/i;
    if (socialRegex.test(text)) {
      return {
        prohibited: true,
        reason: 'Se detectó un usuario o mención a redes sociales externas.',
        detectedType: 'social'
      };
    }

    // 4. Detección de Correos Electrónicos o Enlaces / URLs externas (wa.me, linktr.ee, bit.ly, etc.)
    const linkEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/|www\.|linktr\.ee|bit\.ly|wa\.link)/i;
    if (linkEmailRegex.test(text)) {
      return {
        prohibited: true,
        reason: 'Se detectó un correo electrónico o enlace externo no permitido.',
        detectedType: 'email'
      };
    }

    // 5. Detección de Frases de intención de intercambio de contacto
    const intentRegex = /\b(mi\s+(cel|celular|telefono|teléfono|wpp|whats|numero|número|contacto|ig|insta)|(escribeme|escríbeme|llamame|llámame|agregame|agrégame|marcame|márcame|hablame|háblame)\s+(al|por|a)|(pasame|pásame|dame|comparteme|compárteme)\s+tu\s+(cel|celular|numero|número|wpp|whatsapp|telefono|teléfono|contacto)|mandame\s+un\s+(wpp|whatsapp|mensaje|dm)|escribeme\s+al\s+privado)\b/i;
    if (intentRegex.test(text)) {
      return {
        prohibited: true,
        reason: 'Se detectó una solicitud o intercambio explícito de datos de contacto.',
        detectedType: 'intent'
      };
    }

    // 6. Detección de Direcciones residenciales / citas fuera de locales aliados
    const addressRegex = /\b(calle\s*\d+|carrera\s*\d+|cra\.?\s*\d+|cll\.?\s*\d+|diagonal\s*\d+|transversal\s*\d+|transv\.?\s*\d+|mi\s+casa\b|mi\s+apto\b|mi\s+apartamento\b|direccion\s*:|dirección\s*:)/i;
    if (addressRegex.test(text)) {
      return {
        prohibited: true,
        reason: 'Se detectó una dirección residencial. Las citas deben coordinarse en locales aliados de RONDA.',
        detectedType: 'address'
      };
    }

    return { prohibited: false };
  }
}
