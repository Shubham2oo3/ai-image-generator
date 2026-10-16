const modelStatusBadge = document.getElementById('modelStatusBadge');
const modelStatusText = document.getElementById('modelStatusText');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsOverlay = document.getElementById('settingsOverlay');
const geminiKeyInput = document.getElementById('geminiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const clearKeyBtn = document.getElementById('clearKeyBtn');

const styleChips = document.getElementById('styleChips');
const aspectRatioSelect = document.getElementById('aspectRatioSelect');
const enhancePromptCheck = document.getElementById('enhancePromptCheck');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');

const loading = document.getElementById('loading');
const loadingStatusText = document.getElementById('loadingStatusText');
const errorMessage = document.getElementById('errorMessage');

const singleImageContainer = document.getElementById('singleImageContainer');
const imageFrame = document.getElementById('imageFrame');
const singleGeneratedImage = document.getElementById('singleGeneratedImage');
const viewFullscreenBtn = document.getElementById('viewFullscreenBtn');
const downloadBtn = document.getElementById('downloadBtn');

const promptDetailBox = document.getElementById('promptDetailBox');
const finalPromptText = document.getElementById('finalPromptText');

// Lightbox Elements
const lightboxModal = document.getElementById('lightboxModal');
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');

// State
let selectedStyle = 'none';
let currentActivePrompt = '';
let currentImageUrl = '';
let storedGeminiKey = localStorage.getItem('google_gemini_key') || '';

updateStatusBadge();

// Style Chips Selection
styleChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.style-chip');
  if (!chip) return;
  document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  selectedStyle = chip.dataset.style;
});

// Settings Modal Listeners
openSettingsBtn.addEventListener('click', () => {
  geminiKeyInput.value = storedGeminiKey;
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

saveKeyBtn.addEventListener('click', () => {
  const key = geminiKeyInput.value.trim();
  storedGeminiKey = key;
  if (key) {
    localStorage.setItem('google_gemini_key', key);
  } else {
    localStorage.removeItem('google_gemini_key');
  }
  updateStatusBadge();
  closeSettings();
  hideError();
});

clearKeyBtn.addEventListener('click', () => {
  storedGeminiKey = '';
  geminiKeyInput.value = '';
  localStorage.removeItem('google_gemini_key');
  updateStatusBadge();
  closeSettings();
});

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function updateStatusBadge() {
  if (storedGeminiKey) {
    modelStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    modelStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    modelStatusBadge.style.color = '#6ee7b7';
    modelStatusText.textContent = '✨ Google Imagen 3 (Connected)';
  } else {
    modelStatusBadge.style.background = 'rgba(66, 133, 244, 0.15)';
    modelStatusBadge.style.borderColor = 'rgba(66, 133, 244, 0.35)';
    modelStatusBadge.style.color = '#93c5fd';
    modelStatusText.textContent = 'Google Imagen 3 (Single Image)';
  }
}

// Lightbox Listeners
lightboxClose.addEventListener('click', closeLightbox);
lightboxOverlay.addEventListener('click', closeLightbox);
lightboxDownloadBtn.addEventListener('click', () => {
  if (lightboxImage.src) downloadImage(lightboxImage.src, `${slugify(currentActivePrompt)}.jpg`);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeSettings();
  }
});

function openLightbox(url) {
  lightboxImage.src = url;
  lightboxModal.classList.remove('hidden');
}

function closeLightbox() {
  lightboxModal.classList.add('hidden');
  lightboxImage.src = '';
}

function slugify(text) {
  return (text || 'imagen3-image').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
}

// Action Buttons on Image
viewFullscreenBtn.addEventListener('click', () => {
  if (currentImageUrl) openLightbox(currentImageUrl);
});

downloadBtn.addEventListener('click', () => {
  if (currentImageUrl) downloadImage(currentImageUrl, `${slugify(currentActivePrompt)}.jpg`);
});

// Generate Single Image
generateBtn.addEventListener('click', () => generateSingleImage());
promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') generateSingleImage();
});

async function generateSingleImage() {
  const prompt = promptInput.value.trim();
  const aspectRatio = aspectRatioSelect.value;
  const autoEnhance = enhancePromptCheck.checked;

  if (!prompt) {
    showError('Please enter a description for Google Imagen 3.');
    return;
  }

  hideError();
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating Image...';
  loadingStatusText.textContent = autoEnhance 
    ? 'Optimizing prompt & rendering single image...' 
    : 'Rendering single image with Imagen 3...';
  
  singleImageContainer.classList.add('hidden');
  promptDetailBox.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        style: selectedStyle,
        aspectRatio,
        autoEnhance,
        apiKey: storedGeminiKey
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Generation failed.');
    }

    if (!data.imageUrl) {
      throw new Error('No image was returned from the server.');
    }

    currentActivePrompt = data.prompt || prompt;
    currentImageUrl = data.imageUrl;

    // Preload single image
    const img = new Image();
    img.onload = () => {
      // Set aspect ratio on the image frame
      imageFrame.style.aspectRatio = getAspectStyle(aspectRatio);
      singleGeneratedImage.src = currentImageUrl;

      finalPromptText.textContent = currentActivePrompt;
      promptDetailBox.classList.remove('hidden');

      loading.classList.add('hidden');
      singleImageContainer.classList.remove('hidden');

      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Image';
    };

    img.onerror = () => {
      showError('Image generation timed out. Please click Generate Image again.');
      loading.classList.add('hidden');
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Image';
    };

    img.src = currentImageUrl;
  } catch (err) {
    showError(err.message);
    loading.classList.add('hidden');
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Image';
  }
}

function getAspectStyle(aspect) {
  switch (aspect) {
    case '16:9': return '16 / 9';
    case '9:16': return '9 / 16';
    case '4:3': return '4 / 3';
    case '3:4': return '3 / 4';
    default: return '1 / 1';
  }
}

async function downloadImage(url, filename) {
  try {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    window.open(url, '_blank');
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}
