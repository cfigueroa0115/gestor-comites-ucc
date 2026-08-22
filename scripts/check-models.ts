import 'dotenv/config';

async function checkModels() {
  const apiKey = process.env.AI_API_KEY;
  const resp = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  
  if (resp.ok) {
    const data = await resp.json();
    console.log('=== TODOS LOS MODELOS DISPONIBLES EN GROQ ===\n');
    const models = data.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
    models.forEach((m: any) => console.log(`  ${m.id}`));
    console.log(`\nTotal: ${models.length}`);
  } else {
    console.log('Error:', resp.status, await resp.text());
  }
}

checkModels();
