// Store elements for later highlighting
let pageElements = new Map();
let highlightedElements = [];

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageContent':
      // Extract page content
      const pageContent = extractPageContent();
      sendResponse({
        content: pageContent.fullText,
        pageUrl: window.location.href
      });
      break;
      
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
  
  // Index all visible elements on the page
  const visibleElements = Array.from(document.querySelectorAll('*'))
    .filter(el => {
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
    
    // Tooltip content - now with collapsed description by default
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <strong>${pattern.type}</strong>
        <button class="tooltip-more-btn">More</button>
      </div>
      <div class="tooltip-content hidden">
        <p>${pattern.description}</p>
      </div>
    `;
    
    // Add tooltip to the element
    targetElement.appendChild(tooltip);
    
    // Add event listener for the "More" button
    tooltip.querySelector('.tooltip-more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const content = tooltip.querySelector('.tooltip-content');
      content.classList.toggle('hidden');
      e.target.textContent = content.classList.contains('hidden') ? 'More' : 'Less';
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
  
  // Try different approaches to find the element
  
  // 1. Try the exact text first
  if (pattern.text) {
    targetElement = pageElements.get(pattern.text);
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
    } catch (error) {
      console.error('Invalid selector:', pattern.selector);
    }
  }
  
  // 3. Try partial text matching with decreasing specificity
  if (pattern.text) {
    // Try phrases from the text
    const words = pattern.text.trim().split(/\s+/);
    
    // Try different length word combinations
    for (let len = Math.min(5, words.length); len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 5) {
          targetElement = pageElements.get(phrase);
          if (targetElement) {
            console.log('Found element with phrase:', phrase);
            return targetElement;
          }
          
          // Try to find an element containing this phrase
          for (const [key, el] of pageElements.entries()) {
            if (key.includes(phrase)) {
              console.log('Found element containing phrase:', phrase);
              return el;
            }
          }
        }
      }
    }
    
    // Try individual words (only longer, significant words)
    const significantWords = words.filter(word => word.length > 5);
    for (const word of significantWords) {
      for (const [key, el] of pageElements.entries()) {
        if (key.includes(word)) {
          console.log('Found element containing word:', word);
          return el;
        }
      }
    }
  }
  
  // 4. Try keywords from the description
  if (pattern.description) {
    const descWords = pattern.description.trim().split(/\s+/);
    const descKeywords = descWords.filter(word => word.length > 6);
    
    for (const keyword of descKeywords) {
      // Find elements containing these keywords
      const elements = document.querySelectorAll('body *');
      for (const el of elements) {
        if (el.textContent.includes(keyword)) {
          console.log('Found element with keyword from description:', keyword);
          return el;
        }
      }
    }
  }
  
  // 5. Last resort: fuzzy matching
  if (pattern.text) {
    const text = pattern.text.toLowerCase();
    // Find elements with greatest text overlap
    let bestMatch = null;
    let bestScore = 0;
    
    Array.from(pageElements.entries()).forEach(([key, el]) => {
      const elementText = key.toLowerCase();
      let score = 0;
      
      // Calculate simple overlap score
      const wordSet = new Set(text.split(/\s+/));
      elementText.split(/\s+/).forEach(word => {
        if (wordSet.has(word) && word.length > 3) {
          score += word.length;
        }
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    });
    
    if (bestMatch && bestScore > 10) {
      console.log('Found element with fuzzy matching, score:', bestScore);
      return bestMatch;
    }
  }
  
  return null;
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