/*
 * This file contains utility functions for handling user feedback in the extension.
 * It manages the storage and export of user feedback data.
 *
 * 1. It provides functions to store pattern-specific feedback from users.
 * 2. It handles storage of overall extension helpfulness feedback.
 * 3. It implements export functionality for feedback data in JSON and CSV formats.
 * 4. It offers utilities to retrieve and clear all feedback data from storage.
 */

// Store a feedback instance for a specific pattern
async function storeFeedbackForPattern(patternIndex, patternType, wasAware, pageUrl) {
  try {
    const timestamp = new Date().toISOString();
    const feedback = {
      patternIndex,
      patternType,
      wasAware, // true or false
      pageUrl,
      timestamp
    };
    
    // Get existing feedback
    const data = await chrome.storage.local.get(['patternFeedback']);
    const patternFeedback = data.patternFeedback || [];
    
    // Add new feedback
    patternFeedback.push(feedback);
    
    // Store updated feedback
    await chrome.storage.local.set({ patternFeedback });
    
    console.log('Pattern feedback stored:', feedback);
    return true;
  } catch (error) {
    console.error('Error storing pattern feedback:', error);
    return false;
  }
}

// Store overall extension helpfulness feedback
async function storeHelpfulnessFeedback(isHelpful, name, comments, detectedPatternsCount, pageUrl) {
  try {
    const timestamp = new Date().toISOString();
    const feedback = {
      isHelpful, // true or false
      name,
      comments,
      detectedPatternsCount,
      pageUrl,
      timestamp
    };
    
    // Get existing feedback
    const data = await chrome.storage.local.get(['helpfulnessFeedback']);
    const helpfulnessFeedback = data.helpfulnessFeedback || [];
    
    // Add new feedback
    helpfulnessFeedback.push(feedback);
    
    // Store updated feedback
    await chrome.storage.local.set({ helpfulnessFeedback });
    
    console.log('Helpfulness feedback stored:', feedback);
    return true;
  } catch (error) {
    console.error('Error storing helpfulness feedback:', error);
    return false;
  }
}

// Export feedback data as JSON
function exportFeedbackToJson() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['patternFeedback', 'helpfulnessFeedback'], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const feedbackData = {
        patternFeedback: data.patternFeedback || [],
        helpfulnessFeedback: data.helpfulnessFeedback || [],
        exportDate: new Date().toISOString()
      };
      
      // Create a JSON file
      const blob = new Blob([JSON.stringify(feedbackData, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      // Create a dated filename
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const filename = `dark-patterns-feedback-${dateStr}.json`;
      
      // Trigger download
      chrome.downloads.download({
        url: url,
        filename: filename
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  });
}

// Convert feedback data to CSV
function exportFeedbackToCsv() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['patternFeedback', 'helpfulnessFeedback'], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const patternFeedback = data.patternFeedback || [];
      const helpfulnessFeedback = data.helpfulnessFeedback || [];
      
      // Create CSV for pattern feedback
      let patternCsv = 'Pattern Index,Pattern Type,Was User Aware,Page URL,Timestamp\n';
      patternFeedback.forEach(feedback => {
        patternCsv += `${feedback.patternIndex},${feedback.patternType.replace(/,/g, ';')},"${feedback.wasAware}","${feedback.pageUrl}","${feedback.timestamp}"\n`;
      });
      
      // Create CSV for helpfulness feedback
      let helpfulnessCsv = 'Was Helpful,Name,Comments,Detected Patterns Count,Page URL,Timestamp\n';
      helpfulnessFeedback.forEach(feedback => {
        helpfulnessCsv += `"${feedback.isHelpful}","${feedback.name}","${(feedback.comments || "").replace(/"/g, '""')}",${feedback.detectedPatternsCount},"${feedback.pageUrl}","${feedback.timestamp}"\n`;
      });
      
      // Create a combined CSV file with multiple sheets
      const combinedCsv = `PATTERN FEEDBACK\n${patternCsv}\n\nHELPFULNESS FEEDBACK\n${helpfulnessCsv}`;
      
      // Create a CSV file
      const blob = new Blob([combinedCsv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      
      // Create a dated filename
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const filename = `dark-patterns-feedback-${dateStr}.csv`;
      
      // Trigger download
      chrome.downloads.download({
        url: url,
        filename: filename
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  });
}

// Get all feedback data
function getAllFeedbackData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['patternFeedback', 'helpfulnessFeedback'], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve({
          patternFeedback: data.patternFeedback || [],
          helpfulnessFeedback: data.helpfulnessFeedback || []
        });
      }
    });
  });
}

// Clear all feedback data
function clearAllFeedbackData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(['patternFeedback', 'helpfulnessFeedback'], () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
} 