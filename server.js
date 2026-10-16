const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
  });
});

// Google Gemini Prompt Enhancer (Expands prompt for maximum visual fidelity)
async function enhancePromptWithGemini(userPrompt, apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert AI prompt engineer for Google Imagen 3. Expand this short prompt into a single descriptive sentence for photorealistic, high-detail image generation, including lighting, texture, and composition. Preserve the subject matter accurately (especially landmarks and cultural details like Indian heritage). Return ONLY the expanded prompt, no quotes, no markdown: "${userPrompt}"`
          }]
        }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.7 }
      })
    });

    const data = await response.json();
    const expanded = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return expanded || userPrompt;
  } catch (err) {
    console.warn('Gemini prompt expand error:', err.message);
    return userPrompt;
  }
}

// Google Imagen 3 Predictor (Single Image)
async function generateWithGoogleImagen(prompt, aspectRatio, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const validAspects = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  const aspect = validAspects.includes(aspectRatio) ? aspectRatio : '1:1';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspect,
        outputMimeType: 'image/jpeg',
        personGeneration: 'ALLOW_ADULT',
        safetySetting: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Google Imagen error (HTTP ${response.status})`);
  }

  if (data.predictions && data.predictions.length > 0) {
    return `data:${data.predictions[0].mimeType || 'image/jpeg'};base64,${data.predictions[0].bytesBase64Encoded}`;
  }

  throw new Error('Google Imagen returned no prediction.');
}

// Single Image Fallback Generator (No extra concurrent requests)
function generateSingleFallbackImage(prompt, aspectRatio) {
  const base = encodeURIComponent(prompt);

  let w = 800, h = 800;
  if (aspectRatio === '16:9') { w = 960; h = 540; }
  else if (aspectRatio === '9:16') { w = 540; h = 960; }
  else if (aspectRatio === '4:3') { w = 800; h = 600; }

  // Exactly one image - no concurrent seeds that cause rate limit errors
  return `https://image.pollinations.ai/prompt/${base}?width=${w}&height=${h}&nologo=true`;
}

// POST /api/generate-image - STRICTLY GENERATES ONLY 1 IMAGE
app.post('/api/generate-image', async (req, res) => {
  const { 
    prompt, 
    style = 'none', 
    aspectRatio = '1:1',
    autoEnhance = false 
  } = req.body;

  const apiKey = req.body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ error: 'Please enter a prompt.' });
  }

  let finalPrompt = prompt.trim();

  // Apply style modifier
  if (style && style !== 'none') {
    finalPrompt += `, ${style}`;
  }

  // Optional Gemini prompt expansion
  if (apiKey && autoEnhance) {
    finalPrompt = await enhancePromptWithGemini(finalPrompt, apiKey);
  }

  // Google Imagen 3 if key is present
  if (apiKey) {
    try {
      console.log(`Generating 1 image with Google Imagen 3: "${finalPrompt}" [aspect: ${aspectRatio}]`);
      const imageUrl = await generateWithGoogleImagen(finalPrompt, aspectRatio, apiKey);
      return res.json({
        provider: 'google-imagen-3',
        imageUrl,
        prompt: finalPrompt
      });
    } catch (err) {
      console.error('Google Imagen 3 API error:', err.message);
      return res.status(500).json({ 
        error: `Google Imagen 3: ${err.message}. Check your GEMINI_API_KEY.` 
      });
    }
  }

  // Single Image Generation (No extra seeds, no rate limits)
  try {
    const imageUrl = generateSingleFallbackImage(finalPrompt, aspectRatio);
    return res.json({
      provider: 'imagen-preview',
      imageUrl,
      prompt: finalPrompt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Google Imagen 3 Generator running at http://localhost:${PORT}`);
});
