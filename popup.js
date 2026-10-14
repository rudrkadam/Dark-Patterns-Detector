/*
* This file is the main script for the popup.html file.
* It controls the popup logic and user interactions.
*
* 1. It handles the logic for the scan button, results view, feedback view, and thank you view.
* 2. It handles the logic for the feedback buttons and the feedback options.
* 3. It handles the logic for the export buttons and the download all feedback button.
* 4. It handles the logic for the highlight buttons and the highlight all buttons.
*/

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements for the popup
  const scanButton = document.getElementById('scan-button');
  const loadingSpinner = document.getElementById('loading-spinner');
  const initialView = document.getElementById('initial-view');
  const resultsView = document.getElementById('results-view');
  const patternsList = document.getElementById('patterns-list');
  const patternCount = document.getElementById('pattern-count');
  const highlightAllButton = document.getElementById('highlight-all');
  const backButton = document.getElementById('back-button');
  const feedbackButton = document.getElementById('feedback-button');
  const feedbackView = document.getElementById('feedback-view');
  const submitFeedback = document.getElementById('submit-feedback');
  const skipFeedback = document.getElementById('skip-feedback');
  const feedbackOptions = document.querySelectorAll('.feedback-option-btn');
  const feedbackName = document.getElementById('feedback-name');
  const feedbackComments = document.getElementById('feedback-comments');
  const thankYouView = document.getElementById('thank-you-view');
  const backToHome = document.getElementById('back-to-home');
  const exportJson = document.getElementById('export-json');
  const exportCsv = document.getElementById('export-csv');
  const downloadAllFeedback = document.getElementById('download-all-feedback');

  // Variables for tracking
  let currentUrl = '';
  let detectedPatterns = [];
  let patternFeedbackGiven = {};

  // Check if we have saved results
  chrome.storage.local.get(['darkPatterns', 'pageUrl'], (data) => {
    // If we have results for the current page, show them
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      currentUrl = tabs[0].url;

      if (data.darkPatterns && data.pageUrl === currentUrl) {
        detectedPatterns = data.darkPatterns;
        displayResults(data.darkPatterns);
      }
    });
  });

  // Scan button click handler
  scanButton.addEventListener('click', () => {
    // Show loading spinner
    scanButton.style.display = 'none';
    loadingSpinner.style.display = 'flex';

    // Get page content from the content script, injecting it if needed
    sendToActiveTab({ action: 'getPageContent' })
      .then(processPageContent)
      .catch(error => {
        console.error('Could not get page content:', error.message);
        // Chrome blocks extensions on its own pages (chrome://, the Web Store, etc.)
        showError("This page can't be scanned. Try a regular website.");
      });
  });

  // The content script is not declared in the manifest (that would run it on
  // every page the user visits). It is injected into the active tab on demand,
  // which the activeTab permission allows once the user opens the popup.
  async function ensureContentScript(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.ready) return;
    } catch {
      // Not injected yet - fall through and inject it
    }
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }

  // Send a message to the content script in the active tab, injecting it first if needed
  async function sendToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = tab.url;
    await ensureContentScript(tab.id);
    return chrome.tabs.sendMessage(tab.id, message);
  }

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
        // result is undefined if the background script failed to respond
        if (chrome.runtime.lastError || !result || result.error) {
          const errorText = result?.error || chrome.runtime.lastError?.message || 'No response';
          console.error('Error from background script:', errorText);
          showError(friendlyErrorMessage(errorText));
          return;
        }

        // Save results to storage
        chrome.storage.local.set({
          darkPatterns: result.darkPatterns,
          pageUrl: response.pageUrl
        });

        // Store detected patterns for feedback
        detectedPatterns = result.darkPatterns;

        // Display results
        displayResults(result.darkPatterns);

        if (result.truncated) {
          showNotice('This page is very long, so only its first part was analysed.');
        }
      }
    );
  }

  // Function to display results
  function displayResults(darkPatterns) {
    // Reset feedback tracking
    patternFeedbackGiven = {};

    // Hide loading, show results
    initialView.style.display = 'none';
    resultsView.classList.remove('hidden');

    // Clear previous results
    patternsList.innerHTML = '';
    document.querySelectorAll('.results-notice').forEach(el => el.remove());

    // Reset the Highlight All button (it may be hidden or active from a previous scan)
    highlightAllButton.style.display = '';
    highlightAllButton.classList.remove('active');
    highlightAllButton.textContent = 'Highlight All';

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

      // How many places on the page show this pattern (results saved by
      // older versions have no quotes list)
      const occurrenceCount = Array.isArray(pattern.quotes) ? pattern.quotes.length : 1;
      if (occurrenceCount > 1) {
        const occurrences = document.createElement('div');
        occurrences.className = 'pattern-occurrences';
        occurrences.textContent = `Found in ${occurrenceCount} places on this page`;
        patternDescription.appendChild(occurrences);
      }

      // Add feedback section with thumbs up/down
      const patternFeedback = document.createElement('div');
      patternFeedback.className = 'pattern-feedback';
      patternFeedback.innerHTML = `
        <span>Were you aware of this dark pattern?</span>
        <div class="feedback-buttons">
          <button class="thumbs-btn thumbs-up" data-index="${index}" data-aware="true" title="Yes, I was aware">👍</button>
          <button class="thumbs-btn thumbs-down" data-index="${index}" data-aware="false" title="No, I wasn't aware">👎</button>
        </div>
      `;

      // Add feedback label to show when user has given feedback
      const feedbackLabel = document.createElement('div');
      feedbackLabel.className = 'feedback-label hidden';
      feedbackLabel.id = `feedback-label-${index}`;
      feedbackLabel.textContent = 'Thanks for your feedback!';
      patternFeedback.appendChild(feedbackLabel);

      patternItem.appendChild(patternHeader);
      patternItem.appendChild(patternDescription);
      patternItem.appendChild(patternFeedback);

      patternsList.appendChild(patternItem);

      // Add highlight button click handler
      highlightBtn.addEventListener('click', function () {
        const isActive = this.classList.contains('active');

        sendToActiveTab({
          action: isActive ? 'removeHighlight' : 'addHighlight',
          pattern: pattern,
          index: index
        }).catch(error => console.error('Highlight failed:', error.message));

        this.classList.toggle('active');
        this.textContent = isActive ? 'Highlight' : 'Remove';
      });

      // Add thumbs up/down button handlers
      patternFeedback.querySelectorAll('.thumbs-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const index = this.dataset.index;
          const wasAware = this.dataset.aware === 'true';

          // Store user's feedback
          storeFeedbackForPattern(index, pattern.type, wasAware, currentUrl)
            .then(() => {
              // Mark this pattern as having received feedback
              patternFeedbackGiven[index] = true;

              // Update UI to show feedback was received
              patternFeedback.querySelectorAll('.thumbs-btn').forEach(b => {
                b.classList.remove('selected');
              });
              this.classList.add('selected');

              // Show feedback label
              document.getElementById(`feedback-label-${index}`).classList.remove('hidden');

              // Check if all patterns have feedback
              checkAllFeedbackGiven();
            });
        });
      });
    });
  }

  // Highlight All button handler. Registered once (not per displayResults call),
  // otherwise a second scan adds a second listener and each click toggles twice.
  highlightAllButton.addEventListener('click', function () {
    const isActive = this.classList.contains('active');
    const highlightBtns = document.querySelectorAll('.highlight-btn');

    sendToActiveTab({
      action: isActive ? 'removeAllHighlights' : 'addAllHighlights',
      patterns: detectedPatterns
    }).catch(error => console.error('Highlight all failed:', error.message));

    this.classList.toggle('active');
    this.textContent = isActive ? 'Highlight All' : 'Remove All';

    highlightBtns.forEach(btn => {
      btn.classList.toggle('active', !isActive);
      btn.textContent = isActive ? 'Highlight' : 'Remove';
    });
  });

  // Function to check if all patterns have received feedback
  function checkAllFeedbackGiven() {
    if (Object.keys(patternFeedbackGiven).length === detectedPatterns.length && detectedPatterns.length > 0) {
      // All patterns have received feedback, suggest overall feedback
      setTimeout(() => {
        feedbackButton.classList.add('pulse-animation');
      }, 500);
    }
  }

  // Back button handler
  backButton.addEventListener('click', () => {
    resultsView.classList.add('hidden');
    initialView.style.display = 'block';
    scanButton.style.display = 'block';
    loadingSpinner.style.display = 'none';
  });

  // Feedback button handler
  feedbackButton.addEventListener('click', () => {
    resultsView.classList.add('hidden');
    feedbackView.classList.remove('hidden');
  });

  // Feedback option selection
  feedbackOptions.forEach(option => {
    option.addEventListener('click', function () {
      // Clear previous selection
      feedbackOptions.forEach(opt => opt.classList.remove('selected'));
      // Select this option
      this.classList.add('selected');
    });
  });

  // Submit feedback handler
  submitFeedback.addEventListener('click', () => {
    // Get selected option
    const selectedOption = document.querySelector('.feedback-option-btn.selected');
    const isHelpful = selectedOption ? selectedOption.dataset.value : null;
    const name = feedbackName.value.trim();
    const comments = feedbackComments.value.trim();

    if (!isHelpful) {
      // Show error if no option selected
      showError("Please select an option for how helpful the extension was.", submitFeedback);
      return;
    }

    // Store feedback
    storeHelpfulnessFeedback(
      isHelpful,
      name,
      comments,
      detectedPatterns.length,
      currentUrl
    ).then(() => {
      // Show thank you view
      feedbackView.classList.add('hidden');
      thankYouView.classList.remove('hidden');
    });
  });

  // Skip feedback handler
  skipFeedback.addEventListener('click', () => {
    feedbackView.classList.add('hidden');
    initialView.style.display = 'block';
    scanButton.style.display = 'block';
  });

  // Back to home from thank you page
  backToHome.addEventListener('click', () => {
    thankYouView.classList.add('hidden');
    initialView.style.display = 'block';
    scanButton.style.display = 'block';
  });

  // Export JSON handler
  exportJson.addEventListener('click', () => {
    exportFeedbackToJson()
      .then(() => {
        showTemporaryMessage("JSON file downloaded successfully!");
      })
      .catch(error => {
        console.error('Export error:', error);
        showError("Failed to export data. Please try again.");
      });
  });

  // Export CSV handler
  exportCsv.addEventListener('click', () => {
    exportFeedbackToCsv()
      .then(() => {
        showTemporaryMessage("CSV file downloaded successfully!");
      })
      .catch(error => {
        console.error('Export error:', error);
        showError("Failed to export data. Please try again.");
      });
  });

  // Download all feedback button handler
  downloadAllFeedback.addEventListener('click', () => {
    exportFeedbackToCsv()
      .then(() => {
        showTemporaryMessage('Feedback data downloaded successfully!');
      })
      .catch((error) => {
        console.error('Error exporting feedback:', error);
        showError('Failed to download feedback data.');
      });
  });

  // Show temporary message in thank you view
  function showTemporaryMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'export-message';
    messageEl.textContent = message;

    // Add to thank you content
    document.querySelector('.thank-you-content').appendChild(messageEl);

    // Remove after 3 seconds
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }

  // Turn a raw error from the background script into something a user can act on
  function friendlyErrorMessage(errorText) {
    const text = String(errorText).toLowerCase();
    if (text.includes('high demand') || text.includes('overloaded') || text.includes('timeout') || text.includes('aborted')) {
      return 'The AI service is busy right now. Please try again in a minute.';
    }
    if (text.includes('quota') || text.includes('rate limit') || text.includes('resource has been exhausted')) {
      return 'Scan limit reached. Please try again later.';
    }
    if (text.includes('cut off')) {
      return 'This page has too much to analyse in one go. Please try again.';
    }
    if (text.includes('declined to analyse')) {
      return 'The AI service declined to analyse this page.';
    }
    if (text.includes('api key')) {
      return 'The AI service rejected the API key. Check config.js.';
    }
    if (text.includes('failed to fetch') || text.includes('network')) {
      return 'Could not reach the AI service. Check your internet connection.';
    }
    return 'Failed to analyze page. Please try again.';
  }

  // Show an informational note at the top of the results
  function showNotice(message) {
    const notice = document.createElement('div');
    notice.className = 'results-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    patternsList.insertAdjacentElement('beforebegin', notice);
  }

  // Show error message
  // anchor: element the message is shown after (must be visible, e.g. the
  // submit button when validating the feedback form)
  function showError(message, anchor = scanButton) {
    loadingSpinner.style.display = 'none';
    scanButton.style.display = 'block';

    // Replace any error that's still showing instead of stacking them
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    // Create an error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.textContent = message;

    anchor.insertAdjacentElement('afterend', errorDiv);

    // Remove after 6 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 6000);
  }
}); 