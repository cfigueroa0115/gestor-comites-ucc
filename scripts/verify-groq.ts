import 'dotenv/config';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

async function verify() {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'llama-3.1-8b-instant';

  console.log('=== VERIFICACIÓN GROQ API ===\n');
  console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5) : 'NO CONFIGURADA'}`);
  console.log(`🤖 Modelo: ${model}`);

  // Test Chat Completion (Llama)
  console.log('\n--- Test 1: Chat Completion (Llama) ---');
  try {
    const resp = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responde solo con "OK FUNCIONA" sin nada más.' }],
        temperature: 0,
        max_tokens: 20,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      console.log(`   ✅ Groq Chat: ${resp.status} - Respuesta: "${content.trim()}"`);
    } else {
      const err = await resp.text();
      console.log(`   ❌ Groq Chat ERROR: ${resp.status} - ${err.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Groq Chat NETWORK ERROR: ${e.message}`);
  }

  // Test Whisper endpoint availability
  console.log('\n--- Test 2: Whisper API (disponibilidad) ---');
  try {
    // Send empty request to see if endpoint responds
    const resp = await fetch(GROQ_WHISPER_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: new FormData(), // Empty - will fail but proves endpoint is reachable
    });
    if (resp.status === 400 || resp.status === 422) {
      console.log(`   ✅ Whisper endpoint accesible (${resp.status} - esperado sin audio)`);
    } else if (resp.status === 401) {
      console.log(`   ❌ Whisper: API key inválida`);
    } else {
      console.log(`   ⚠️ Whisper responde con: ${resp.status}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Whisper NETWORK ERROR: ${e.message}`);
  }

  console.log('\n✅ VERIFICACIÓN GROQ COMPLETADA');
}

verify().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
