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

    // Get the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      currentUrl = currentTab.url;

      // Send message to content script to get page content
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'getPageContent' },
        (response) => {
          if (chrome.runtime.lastError) {
            // If content script isn't ready yet, inject it
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content.js']
            }, () => {
              // Try again after script is injected
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  currentTab.id,
                  { action: 'getPageContent' },
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

        // Store detected patterns for feedback
        detectedPatterns = result.darkPatterns;

        // Display results
        displayResults(result.darkPatterns);
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

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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

    // Highlight All button handler
    highlightAllButton.addEventListener('click', function () {
      const isActive = this.classList.contains('active');
      const highlightBtns = document.querySelectorAll('.highlight-btn');

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
      showError("Please select an option for how helpful the extension was.");
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