import 'dotenv/config';

async function testModel(model: string) {
  const apiKey = process.env.AI_API_KEY;
  console.log(`\nTesting: ${model}...`);
  
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Eres un secretario ejecutivo de una universidad colombiana. Redacta en español formal.' },
        { role: 'user', content: 'Escribe un párrafo de apertura de un acta de comité curricular de Ingeniería Industrial. Fecha: 5 de junio de 2025. Asistentes: Carlos Figueroa (Profesor), María López (Directora). Solo el párrafo de apertura.' }
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });

  if (resp.ok) {
    const data = await resp.json();
    const content = data.choices[0].message.content.trim();
    console.log(`  ✅ Respuesta (${content.length} chars):`);
    console.log(`  "${content.substring(0, 300)}"`);
  } else {
    const err = await resp.text();
    console.log(`  ❌ ${resp.status}: ${err.substring(0, 200)}`);
  }
}

async function main() {
  await testModel('openai/gpt-oss-120b');
  await testModel('allam-2-7b');
}

main();
