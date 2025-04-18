# Dark Patterns Detector - User Feedback Implementation

This document describes the user feedback system implemented in Dark Patterns Detector version 2.0.0.

## Overview

The user feedback system collects two types of data:

1. **Pattern-specific feedback**: For each detected dark pattern, users can indicate whether they were already aware of this dark pattern being used.
2. **Overall extension feedback**: Users can rate how helpful the extension was and provide additional comments.

## Implementation Details

### Files Modified/Created

1. **feedback-utils.js** (New)
   - Core utility functions for storing and exporting feedback data
   - Functions for JSON and CSV export

2. **popup.html**
   - Added feedback view with overall extension feedback form
   - Added thank you view with export options
   - Added feedback button to results view

3. **popup.css**
   - Added styles for feedback components, buttons, and forms
   - Added pulse animation for feedback button
   - Added styling for export options and messages

4. **popup.js**
   - Added handlers for feedback collection
   - Implemented pattern-specific feedback with thumbs up/down
   - Added export functionality for feedback data

5. **content.js**
   - Enhanced tooltips to include feedback options
   - Added message sending to store pattern feedback

6. **styles.css**
   - Added styles for tooltip feedback components

7. **background.js**
   - Added message handling for feedback storage
   - Implemented local storage for feedback data

8. **manifest.json**
   - Added downloads permission for exporting data
   - Added feedback-utils.js to web accessible resources
   - Updated version to 2.0.0

## Data Collection

### Pattern Feedback Data Structure
```json
{
  "patternIndex": 0,
  "patternType": "Urgency",
  "wasAware": true,
  "pageUrl": "https://example.com",
  "timestamp": "2023-04-20T12:00:00.000Z"
}
```

### Helpfulness Feedback Data Structure
```json
{
  "isHelpful": "yes",
  "comments": "User's comments here",
  "detectedPatternsCount": 3,
  "pageUrl": "https://example.com",
  "timestamp": "2023-04-20T12:00:00.000Z"
}
```

## Storage

All feedback data is stored in Chrome's local storage using:
- `patternFeedback` key for pattern-specific feedback
- `helpfulnessFeedback` key for overall extension feedback

## Export Options

Users can export feedback data in two formats:
1. **JSON**: Complete structured data
2. **CSV**: Tabular format suitable for spreadsheet analysis

## User Interface

The feedback system appears in three places:
1. **In the pattern list**: Each dark pattern has thumbs up/down buttons
2. **In the page tooltips**: Each highlighted element has feedback options
3. **Overall feedback form**: Available after scanning via "Give Feedback" button

## Privacy Considerations

- Only the page URL is stored, no personal data is collected
- All data remains in the user's browser until explicitly exported
- No automatic sharing of feedback data with any server

## Future Enhancements

Potential future improvements:
- Add server-side storage option if needed for research
- Implement more detailed analytics on collected data
- Add visualization of feedback statistics
- Add option to clear stored feedback data 