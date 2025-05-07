/*
 * This file is the main background script for the extension.
 * It handles the communication with the Gemini API for dark pattern detection.
 *
 * 1. It loads configuration including the API key from config.js.
 * 2. It receives page content from the content script and sends it to the Gemini API for analysis.
 * 3. It processes and formats the API response before sending it back to the popup.
 * 4. It handles storage of user feedback data received from the content script.
 */

// Configuration variable to store API keys
let CONFIG = {
  GEMINI_API_KEY: null
};

// Load configuration at startup
loadConfig().then(() => {
  console.log('Configuration loaded');
}).catch(error => {
  console.error('Error loading configuration:', error);
});

// Function to load config
async function loadConfig() {
  try {
    const configUrl = chrome.runtime.getURL('config.js');
    const response = await fetch(configUrl);
    const configText = await response.text();
    
    // Extract the API key using regex - safer than eval
    const keyMatch = configText.match(/GEMINI_API_KEY:\s*['"]([^'"]+)['"]/);
    if (keyMatch && keyMatch[1]) {
      CONFIG.GEMINI_API_KEY = keyMatch[1];
      console.log('API key loaded successfully');
    } else {
      console.error('API key not found in config.js');
    }
  } catch (error) {
    console.error('Error loading config.js:', error);
    throw error;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeContent') {
    console.log('Background script received analyze request');
    analyzeWithGemini(request.content)
      .then(response => {
        console.log('Gemini analysis complete, detected patterns:', response.darkPatterns.length);
        sendResponse(response);
      })
      .catch(error => {
        console.error('Error in Gemini analysis:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  
  // Handle feedback storage request from content script
  if (request.action === 'storeFeedback' && request.feedbackType === 'pattern') {
    console.log('Background script received feedback storage request');
    
    // Get existing feedback
    chrome.storage.local.get(['patternFeedback'], (data) => {
      const patternFeedback = data.patternFeedback || [];
      
      // Create new feedback entry
      const feedback = {
        patternIndex: request.patternIndex,
        patternType: request.patternType,
        wasAware: request.wasAware,
        pageUrl: request.pageUrl,
        timestamp: new Date().toISOString()
      };
      
      // Add to existing feedback
      patternFeedback.push(feedback);
      
      // Store updated feedback
      chrome.storage.local.set({ patternFeedback }, () => {
        console.log('Pattern feedback stored successfully');
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    });
    
    return true; // Keep the message channel open for async response
  }
});

async function analyzeWithGemini(content) {
  try {
    // Check if API key is available
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error('Gemini API key not found. Please check your config.js file.');
    }

    const prompt = `Analyze this webpage content for dark patterns. For each dark pattern found, provide:
1. The exact text where the dark pattern appears
2. The type of dark pattern
3. A brief description of how it's being used and how it affects users
4. Find all possible dark patterns on the entire webpage.

Format your response as a JSON array like this:
{
  "dark_patterns": [
    {
      "text": "the exact text containing the dark pattern",
      "type": "type of dark pattern (e.g., Urgency, Misdirection, etc.)",
      "description": "brief explanation of how this creates a dark pattern and affects users"
    }
  ]
}

Here's the webpage content to analyze:
${content}`;

    console.log('Sending request to Gemini API');
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to analyze content');
    }

    const data = await response.json();
    console.log('Received response from Gemini API');

    // Parse the response to extract dark patterns
    const darkPatterns = parseGeminiResponse(data);
    
    // Transform the data to match our extension's expected format
    const transformedPatterns = darkPatterns.map(pattern => ({
      text: pattern.text,
      type: pattern.type,
      description: pattern.description,
      selector: "N/A" // We don't have selectors but our extension expects this field
    }));
    
    return { darkPatterns: transformedPatterns };
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    throw error;
  }
}

function parseGeminiResponse(response) {
  try {
    // Extract the text content from the Gemini response
    const text = response.candidates[0].content.parts[0].text;
    console.log('Processing Gemini response text');

    // Try to clean and parse the response
    // First remove any markdown code block markers
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
    
    try {
      // Try to parse the cleaned text directly
      const parsedData = JSON.parse(cleanedText);
      return parsedData.dark_patterns || [];
    } catch (e) {
      console.log('Direct parsing failed, trying to extract JSON object');
      // If direct parsing fails, try to find JSON object in the text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in response');
        return [];
      }
      const parsedData = JSON.parse(jsonMatch[0]);
      return parsedData.dark_patterns || [];
    }
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return [];
  }
} 