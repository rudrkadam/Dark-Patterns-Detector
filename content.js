/*
 * This file is the content script that runs in the context of web pages.
 * It handles manipulation of the web page DOM to detect and highlight dark patterns.
 *
 * 1. It extracts page content and sends it to the background script for analysis.
 * 2. It provides sophisticated element targeting with multiple fallback strategies:
 *    - Exact text matching
 *    - Selector-based targeting
 *    - Partial text matching with phrases
 *    - Fuzzy matching as a last resort
 * 3. It adds interactive tooltips to highlighted elements with pattern information.
 * 4. It manages user feedback collection directly from the page via the tooltips.
 * 5. It handles highlight removal and notification displays for user interactions.
 */

// This script is injected on demand and may be injected again into the same tab
// (e.g. after the extension is reloaded), so top-level state uses `var`:
// re-declaring `let`/`const` would throw and break the scan.

// Store elements for later highlighting
var pageElements = new Map();
// Every indexed element with its full text, used to find the smallest element containing a phrase
var indexedElements = [];
var highlightedElements = [];

var NON_HIGHLIGHTABLE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME']);
// Elements with more text than this are page sections, not something worth highlighting
var MAX_HIGHLIGHT_TEXT_LENGTH = 1500;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'ping':
      // Lets the popup check whether this script is already injected
      sendResponse({ ready: true });
      break;

    case 'getPageContent': {
      // Extract page content
      const pageContent = extractPageContent();
      sendResponse({
        content: pageContent.fullText,
        pageUrl: window.location.href
      });
      break;
    }
      
    case 'addHighlight':
      console.log('Adding highlight for pattern:', request.pattern);
      highlightDarkPattern(request.pattern, request.index);
      sendResponse({success: true});
      break;
      
    case 'removeHighlight':
      removeHighlight(request.index);
      sendResponse({success: true});
      break;
      
    case 'addAllHighlights':
      addAllHighlights(request.patterns);
      sendResponse({success: true});
      break;
      
    case 'removeAllHighlights':
      removeAllHighlights();
      sendResponse({success: true});
      break;
  }
  
  return true; // Keep the message channel open for async responses
});

// Function to extract page content
function extractPageContent() {
  const textContent = document.body.innerText;

  // Start from a clean index on every scan
  pageElements = new Map();
  indexedElements = [];

  // Index all visible elements on the page. <html>/<body> (and non-visual tags)
  // are skipped: they contain all the page text, so they would match every
  // search and the "highlight" would cover the whole page.
  const visibleElements = Array.from(document.body.querySelectorAll('*'))
    .filter(el => {
      if (NON_HIGHLIGHTABLE_TAGS.has(el.tagName) || el instanceof SVGElement) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' && 
             el.offsetWidth > 0 &&
             el.offsetHeight > 0 &&
             el.textContent.trim().length > 0;
    })
    .map(el => {
      const elementInfo = {
        text: el.textContent.trim(),
        tag: el.tagName.toLowerCase(),
        element: el
      };
      
      // Store element with its text as key for later lookup
      pageElements.set(elementInfo.text, el);
      indexedElements.push({ normalized: normalizeText(elementInfo.text), element: el });
      
      // Also store elements with shorter text segments for partial matching
      const textSegments = elementInfo.text.split(/\s+/);
      if (textSegments.length > 3) {
        // Store phrases (groups of 3-5 words)
        for (let i = 0; i < textSegments.length - 2; i++) {
          const phrase = textSegments.slice(i, i + 3).join(' ');
          if (phrase.length > 10) {
            pageElements.set(phrase, el);
          }
        }
      }
      
      return elementInfo;
    });

  return {
    fullText: textContent,
    elements: visibleElements.map(info => ({
      text: info.text,
      tag: info.tag
    }))
  };
}

// Function to highlight a dark pattern
function highlightDarkPattern(pattern, index) {
  console.log('Attempting to highlight pattern:', pattern);
  
  // If already highlighted, return
  if (highlightedElements[index]) {
    console.log('Pattern already highlighted');
    return;
  }
  
  // Find the element containing the text
  let targetElement = findElementForPattern(pattern);
  
  if (targetElement) {
    console.log('Found element to highlight:', targetElement);
    
    // Mark element with a unique class
    const className = `dark-pattern-${index}`;
    targetElement.classList.add('dark-pattern-highlight', className);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'dark-pattern-tooltip';
    
    // Tooltip content - now with collapsed description by default.
    // The markup below is static; pattern data comes from the LLM (which reads
    // untrusted page text), so it is only ever inserted via textContent/dataset.
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <strong class="tooltip-type"></strong>
        <button class="tooltip-more-btn">More</button>
      </div>
      <div class="tooltip-content hidden">
        <p class="tooltip-description"></p>
        <div class="tooltip-feedback">
          <span>Were you aware of this pattern?</span>
          <div class="tooltip-feedback-buttons">
            <button class="tooltip-thumbs-btn tooltip-thumbs-up" data-aware="true" title="Yes, I was aware" aria-label="Yes, I was aware">👍</button>
            <button class="tooltip-thumbs-btn tooltip-thumbs-down" data-aware="false" title="No, I wasn't aware" aria-label="No, I wasn't aware">👎</button>
          </div>
          <div class="tooltip-feedback-thanks hidden">Thanks for your feedback!</div>
        </div>
      </div>
    `;
    tooltip.querySelector('.tooltip-type').textContent = String(pattern.type ?? '');
    tooltip.querySelector('.tooltip-description').textContent = String(pattern.description ?? '');
    tooltip.querySelectorAll('.tooltip-thumbs-btn').forEach(btn => {
      btn.dataset.index = index;
    });

    // Add tooltip to the element
    targetElement.appendChild(tooltip);
    
    // Add event listener for the "More" button
    tooltip.querySelector('.tooltip-more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const content = tooltip.querySelector('.tooltip-content');
      content.classList.toggle('hidden');
      e.target.textContent = content.classList.contains('hidden') ? 'More' : 'Less';
    });
    
    // Add event listeners for feedback buttons
    tooltip.querySelectorAll('.tooltip-thumbs-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Get pattern info and feedback
        const patternIndex = btn.dataset.index;
        const wasAware = btn.dataset.aware === 'true';
        
        // Disable both buttons
        tooltip.querySelectorAll('.tooltip-thumbs-btn').forEach(b => {
          b.disabled = true;
          b.style.opacity = 0.5;
        });
        
        // Show thanks message
        const thanksMsg = tooltip.querySelector('.tooltip-feedback-thanks');
        thanksMsg.classList.remove('hidden');
        
        // Store feedback in extension storage
        chrome.runtime.sendMessage({
          action: 'storeFeedback',
          feedbackType: 'pattern',
          patternIndex: patternIndex,
          patternType: pattern.type,
          wasAware: wasAware,
          pageUrl: window.location.href
        });
      });
    });
    
    // Scroll element into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Store highlighted element
    highlightedElements[index] = {
      element: targetElement,
      pattern: pattern
    };
    
    return true;
  } else {
    console.log('Could not find element to highlight');
    
    // Create a floating notification if element not found
    const notification = document.createElement('div');
    notification.className = 'dark-pattern-notification';
    notification.textContent = `Could not locate "${pattern.type}" element on page.`;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds (animation handles this)
    setTimeout(() => {
      notification.remove();
    }, 3000);
    
    return false;
  }
}

// Find the most appropriate element for a given pattern
function findElementForPattern(pattern) {
  let targetElement = null;

  // The index is built when the page is scanned. If the page was reloaded since
  // (results are restored from storage), rebuild it now.
  if (indexedElements.length === 0) {
    extractPageContent();
  }

  // Try different approaches to find the element

  // 1. Try the exact text first
  if (pattern.text) {
    targetElement = pageElements.get(pattern.text.trim());
    if (targetElement) {
      console.log('Found element with exact text match');
      return targetElement;
    }
  }

  // 2. Try by selector if provided
  if (pattern.selector && pattern.selector !== "N/A") {
    try {
      targetElement = document.querySelector(pattern.selector);
      if (targetElement) {
        console.log('Found element with selector:', pattern.selector);
        return targetElement;
      }
    } catch {
      console.error('Invalid selector:', pattern.selector);
    }
  }

  // 3. Try partial text matching with decreasing specificity
  if (pattern.text) {
    // Whole text first (ignoring case and whitespace differences)
    const fullText = normalizeText(pattern.text);
    targetElement = smallestElementContaining(fullText);
    if (targetElement) {
      console.log('Found element containing full text');
      return targetElement;
    }

    // Then phrases from the text, longest first
    const words = fullText.split(' ');
    for (let len = Math.min(5, words.length); len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 5) {
          targetElement = smallestElementContaining(phrase);
          if (targetElement) {
            console.log('Found element containing phrase:', phrase);
            return targetElement;
          }
        }
      }
    }

    // Try individual words (only longer, significant words)
    const significantWords = words.filter(word => word.length > 5);
    for (const word of significantWords) {
      targetElement = smallestElementContaining(word);
      if (targetElement) {
        console.log('Found element containing word:', word);
        return targetElement;
      }
    }
  }

  // 4. Last resort: fuzzy matching - the smallest element sharing the most words with the text
  if (pattern.text) {
    const wordSet = new Set(normalizeText(pattern.text).split(' ').filter(word => word.length > 3));
    let bestMatch = null;
    let bestScore = 0;
    let bestLength = Infinity;

    indexedElements.forEach(({ normalized, element }) => {
      if (normalized.length > MAX_HIGHLIGHT_TEXT_LENGTH) return;

      let score = 0;
      new Set(normalized.split(' ')).forEach(word => {
        if (wordSet.has(word)) {
          score += word.length;
        }
      });

      if (score > bestScore || (score === bestScore && normalized.length < bestLength)) {
        bestScore = score;
        bestLength = normalized.length;
        bestMatch = element;
      }
    });

    if (bestMatch && bestScore > 10) {
      console.log('Found element with fuzzy matching, score:', bestScore);
      return bestMatch;
    }
  }

  return null;
}

// Lowercase and collapse whitespace so AI-quoted text matches page text more reliably
function normalizeText(text) {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Return the element with the least text that still contains the phrase, so we
// highlight e.g. the price label rather than the product card or page wrapper.
function smallestElementContaining(phrase) {
  let best = null;
  for (const entry of indexedElements) {
    if (entry.normalized.length > MAX_HIGHLIGHT_TEXT_LENGTH) continue;
    if (best && entry.normalized.length >= best.normalized.length) continue;
    if (entry.normalized.includes(phrase)) {
      best = entry;
    }
  }
  return best ? best.element : null;
}

// Function to remove highlight
function removeHighlight(index) {
  if (highlightedElements[index]) {
    console.log('Removing highlight for index:', index);
    
    const element = highlightedElements[index].element;
    
    // Remove dark pattern class
    element.classList.remove('dark-pattern-highlight');
    element.classList.remove(`dark-pattern-${index}`);
    
    // Remove tooltip
    const tooltip = element.querySelector('.dark-pattern-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
    
    // Remove from tracking array
    highlightedElements[index] = null;
  }
}

// Function to add all highlights
function addAllHighlights(patterns) {
  console.log('Adding all highlights for patterns:', patterns);
  removeAllHighlights(); // Clear existing highlights
  
  let successCount = 0;
  patterns.forEach((pattern, index) => {
    const success = highlightDarkPattern(pattern, index);
    if (success) successCount++;
  });
  
  if (successCount > 0) {
    // Create a notification with count
    const notification = document.createElement('div');
    notification.className = 'dark-pattern-notification';
    notification.textContent = `Highlighted ${successCount} dark patterns on this page.`;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds (animation handles this)
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Function to remove all highlights
function removeAllHighlights() {
  console.log('Removing all highlights');
  
  // Remove highlights from all elements
  document.querySelectorAll('.dark-pattern-highlight').forEach(el => {
    el.classList.remove('dark-pattern-highlight');
    
    // Remove any pattern-specific classes
    const classes = el.className.split(' ');
    classes.forEach(cls => {
      if (cls.startsWith('dark-pattern-')) {
        el.classList.remove(cls);
      }
    });
    
    // Remove tooltips
    const tooltip = el.querySelector('.dark-pattern-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  });
  
  // Reset tracking array
  highlightedElements = [];
} 