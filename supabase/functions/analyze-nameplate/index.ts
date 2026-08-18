import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Modèle Gemini utilisé pour la vision — modifiable ici uniquement (côté serveur).
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const SYSTEM_PROMPT = `Tu es un expert en analyse de plaques signalétiques d'équipements de chauffage (chaudières gaz, mazout, pellets, climatisation, VMC).
Analyse l'image d'une plaque signalétique et extrais les informations dans un JSON strict avec ces clés (chaînes vides si non visible) :
{
  "brand": "marque du fabricant",
  "model": "référence / modèle",
  "serialNumber": "numéro de série",
  "nominalPower": "puissance nominale en kW (chiffre uniquement)",
  "usefulPower": "puissance utile en kW (chiffre uniquement)",
  "fuelType": "type de combustible (gaz naturel, propane, mazout, pellets, électrique, etc.)",
  "servicePressure": "pression de service en bar (chiffre uniquement)",
  "caloricFlow": "débit calorifique en kW (chiffre uniquement)",
  "yearOfManufacture": "année de fabrication (4 chiffres)",
  "ceNumber": "numéro CE / PIN",
  "category": "catégorie appareil (ex: I2E+, II2E+3P, etc.)",
  "otherInfo": "toute autre info utile (tension, gaz, etc.)"
}
RÈGLES STRICTES :
- Analyse UNIQUEMENT la plaque présente sur la photo fournie.
- N'invente JAMAIS une valeur : si une information est absente, illisible ou incertaine, retourne une chaîne vide "".
- N'ajoute aucune clé supplémentaire, ne renomme aucune clé.
- Réponds UNIQUEMENT avec le JSON, sans texte additionnel, sans balises markdown.`;

const KEYS = [
  'brand', 'model', 'serialNumber', 'nominalPower', 'usefulPower', 'fuelType',
  'servicePressure', 'caloricFlow', 'yearOfManufacture', 'ceNumber', 'category', 'otherInfo',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configuré' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'imageDataUrl requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'imageDataUrl doit être une data URL image base64' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const [, mimeType, base64Data] = match;

    const aiRes = await fetch(GEMINI_ENDPOINT(GEMINI_MODEL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [
            { text: 'Analyse cette plaque signalétique et retourne le JSON.' },
            { inlineData: { mimeType, data: base64Data } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      console.error('Gemini error', aiRes.status, body);
      return new Response(JSON.stringify({ error: 'Gemini API error', status: aiRes.status, details: body }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await aiRes.json();
    const content: string = json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? '')
      .join('') ?? '{}';
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    // Normalise : uniquement les clés attendues, valeurs en chaînes ("" si null/absent)
    const data: Record<string, string> = {};
    for (const key of KEYS) {
      const v = parsed?.[key];
      data[key] = v === null || v === undefined ? '' : String(v).trim();
    }

    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});