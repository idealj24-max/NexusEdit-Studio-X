/**
 * NexusEdit Studio 4.0 - Module d'intégration API Gemini
 */

const GEMINI_CONFIG = {
  MODEL_NAME: "gemini-3.6-flash",
  BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models"
};

/**
 * Fonction générique pour interroger l'API Gemini 3.6 Flash
 * @param {string} prompt - Le texte envoyé à l'IA
 * @param {string} apiKey - Votre clé API Gemini
 * @returns {Promise<string>} - La réponse générée
 */
async function generateWithGemini(prompt, apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Clé API Gemini absente. Veuillez insérer votre Token.");
  }

  const url = `${GEMINI_CONFIG.BASE_URL}/${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey.trim()}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || "Erreur lors de la communication avec Gemini.";
      throw new Error(`Erreur IA (${response.status}) : ${errorMsg}`);
    }

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Format de réponse invalide reçu de l'API.");
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

/**
 * Action spécifique pour la génération de scripts TikTok / Réseaux sociaux
 */
async function generateTikTokScript(sujet, format, ton, apiKey) {
  const prompt = `Rédige un script complet et un storyboard pour une vidéo courte (Format: ${format}, Ton: ${ton}). 
Sujet : ${sujet}.
Inclus les instructions visuelles, audio et le texte à dire à la caméra.`;

  return await generateWithGemini(prompt, apiKey);
}

// Exemple de liaison d'événement UI dans votre interface :
document.getElementById("btn-execute")?.addEventListener("click", async () => {
  const apiKey = document.getElementById("api-key-input")?.value;
  const prompt = document.getElementById("prompt-input")?.value;
  const outputContainer = document.getElementById("output-result");

  try {
    outputContainer.textContent = "Génération en cours...";
    const result = await generateWithGemini(prompt, apiKey);
    outputContainer.textContent = result;
  } catch (err) {
    outputContainer.innerHTML = `<span style="color: #ff5555;">${err.message}</span>`;
  }
});
