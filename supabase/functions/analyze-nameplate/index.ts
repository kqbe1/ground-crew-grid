import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
Réponds UNIQUEMENT avec le JSON, sans texte additionnel, sans balises markdown.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY non configuré' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'imageDataUrl requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyse cette plaque signalétique et retourne le JSON.' },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      console.error('Gateway error', aiRes.status, body);
      return new Response(JSON.stringify({ error: 'AI Gateway error', status: aiRes.status, details: body }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await aiRes.json();
    const content = json?.choices?.[0]?.message?.content ?? '{}';
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});