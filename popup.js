document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const scanButton = document.getElementById('scan-button');
  const loadingSpinner = document.getElementById('loading-spinner');
  const initialView = document.getElementById('initial-view');
  const resultsView = document.getElementById('results-view');
  const patternsList = document.getElementById('patterns-list');
  const patternCount = document.getElementById('pattern-count');
  const highlightAllButton = document.getElementById('highlight-all');
  const backButton = document.getElementById('back-button');

  // Check if we have saved results
  chrome.storage.local.get(['darkPatterns', 'pageUrl'], (data) => {
    // If we have results for the current page, show them
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentUrl = tabs[0].url;
      
      if (data.darkPatterns && data.pageUrl === currentUrl) {
        displayResults(data.darkPatterns);
      }
    });
  });

  // Scan button click handler
  scanButton.addEventListener('click', () => {
    // Show loading spinner
    scanButton.style.display = 'none';
    loadingSpinner.style.display = 'flex';

    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentTab = tabs[0];
      
      // Send message to content script to get page content
      chrome.tabs.sendMessage(
        currentTab.id, 
        {action: 'getPageContent'}, 
        (response) => {
          if (chrome.runtime.lastError) {
            // If content script isn't ready yet, inject it
            chrome.scripting.executeScript({
              target: {tabId: currentTab.id},
              files: ['content.js']
            }, () => {
              // Try again after script is injected
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  currentTab.id, 
                  {action: 'getPageContent'}, 
                  processPageContent
                );
              }, 200);
            });
          } else {
            processPageContent(response);
          }
        }
      );
    });
  });

  // Process page content and send to Gemini API via background script
  function processPageContent(response) {
    if (!response || !response.content) {
      showError("Couldn't extract page content.");
      return;
    }

    // Send content to background script for analysis
    chrome.runtime.sendMessage(
      {
        action: 'analyzeContent',
        content: response.content
      },
      (result) => {
        if (chrome.runtime.lastError || result.error) {
          console.error('Error from background script:', result?.error || chrome.runtime.lastError);
          showError("Failed to analyze page. Please try again.");
          return;
        }

        // Save results to storage
        chrome.storage.local.set({
          darkPatterns: result.darkPatterns,
          pageUrl: response.pageUrl
        });
        
        // Display results
        displayResults(result.darkPatterns);
      }
    );
  }

  // Function to display results
  function displayResults(darkPatterns) {
    // Hide loading, show results
    initialView.style.display = 'none';
    resultsView.classList.remove('hidden');
    
    // Clear previous results
    patternsList.innerHTML = '';
    
    // Update count
    patternCount.textContent = darkPatterns.length;
    
    if (darkPatterns.length === 0) {
      patternsList.innerHTML = '<div class="pattern-item">No dark patterns detected on this page.</div>';
      highlightAllButton.style.display = 'none';
      return;
    }
    
    // Create list items for each dark pattern
    darkPatterns.forEach((pattern, index) => {
      const patternItem = document.createElement('div');
      patternItem.className = 'pattern-item';
      patternItem.dataset.index = index;
      
      const patternHeader = document.createElement('div');
      patternHeader.className = 'pattern-header';
      
      const patternType = document.createElement('div');
      patternType.className = 'pattern-type';
      patternType.textContent = pattern.type;
      
      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'highlight-btn';
      highlightBtn.textContent = 'Highlight';
      highlightBtn.dataset.index = index;
      
      patternHeader.appendChild(patternType);
      patternHeader.appendChild(highlightBtn);
      
      const patternDescription = document.createElement('div');
      patternDescription.className = 'pattern-description';
      patternDescription.textContent = pattern.description;
      
      patternItem.appendChild(patternHeader);
      patternItem.appendChild(patternDescription);
      
      patternsList.appendChild(patternItem);
      
      // Add highlight button click handler
      highlightBtn.addEventListener('click', function() {
        const isActive = this.classList.contains('active');
        
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id, 
            {
              action: isActive ? 'removeHighlight' : 'addHighlight',
              pattern: pattern,
              index: index
            }
          );
        });
        
        this.classList.toggle('active');
        this.textContent = isActive ? 'Highlight' : 'Remove';
      });
    });
    
    // Highlight All button handler
    highlightAllButton.addEventListener('click', function() {
      const isActive = this.classList.contains('active');
      const highlightBtns = document.querySelectorAll('.highlight-btn');
      
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          {
            action: isActive ? 'removeAllHighlights' : 'addAllHighlights',
            patterns: darkPatterns
          }
        );
      });
      
      this.classList.toggle('active');
      this.textContent = isActive ? 'Highlight All' : 'Remove All';
      
      highlightBtns.forEach(btn => {
        btn.classList.toggle('active', !isActive);
        btn.textContent = isActive ? 'Highlight' : 'Remove';
      });
    });
  }
  
  // Back button handler
  backButton.addEventListener('click', () => {
    resultsView.classList.add('hidden');
    initialView.style.display = 'block';
    scanButton.style.display = 'block';
    loadingSpinner.style.display = 'none';
  });
  
  // Show error message
  function showError(message) {
    loadingSpinner.style.display = 'none';
    scanButton.style.display = 'block';
    
    // Create an error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Insert after scan button
    scanButton.insertAdjacentElement('afterend', errorDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }
}); 