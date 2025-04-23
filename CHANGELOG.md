# Changelog
All notable changes to the Dark Patterns Detector extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-04-23
### Added
- Added "Download All Feedback" button at the bottom of the popup for easy access to feedback data
- Added ability to download feedback in CSV format directly from the main popup

### Changed
- Fixed loading spinner behavior to not show "Scanning page for dark patterns..." when the extension is first opened
- Improved UX by only showing loading spinner after user clicks "Scan This Page"

## [2.0.0] - 2025-04-20
### Added
- User feedback system to collect data on dark pattern awareness
- Thumbs up/down buttons for each detected dark pattern to indicate if users were aware of them
- Overall extension helpfulness feedback form
- Export functionality for feedback data (JSON and CSV formats)
- Added downloads permission to enable exporting feedback data
- New utilities for managing and storing feedback data

### Changed
- Updated UI to include feedback options
- Enhanced tooltip functionality to include feedback collection
- Reorganized popup UI to accommodate feedback button

## [1.0.0] - 2025-04-18
### Added
- Initial release of the Dark Patterns Detector extension
- Ability to scan web pages for dark patterns using Gemini API
- Highlight dark patterns on the page
- Blue-themed UI design
- Tooltip system showing dark pattern types with expandable descriptions
- Pattern listing in the extension popup
- Ability to highlight individual patterns or all at once

### Changed
- Updated tooltip behavior to only show details when "More" is clicked
- Changed highlight button color from green to blue for consistency 