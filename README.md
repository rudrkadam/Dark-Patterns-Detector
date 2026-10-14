![Dark Patterns Detector](Title.png)

# Dark Patterns Detector

A Chromium browser extension that automatically detects dark patterns on any webpage you visit using a Large Language Model (LLM). Dark patterns are deceptive design practices that manipulate users into doing things they might not otherwise do.

Learn more about dark patterns on [Deceptive Design](https://www.deceptive.design/). 

## ✨ Features

- **Simple Interface**: Minimalist design with a "Scan This Page" button
- **Pattern Detection**: Uses Gemini AI to analyze and identify dark patterns
- **Highlighting**: Highlight specific dark patterns or all patterns at once
- **Informative Tooltips**: View descriptions of each dark pattern and how it affects users
- **Educational Resource**: Links to more information about dark patterns

**What we detect and why:** see [docs/DARK_PATTERNS.md](docs/DARK_PATTERNS.md) for the 19 types the extension looks for, with examples. The research behind the selection is in [research/taxonomy](research/taxonomy/README.md).

## 🔧 Installation

### 1. Development Mode 💻

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory

### 2. API Key Setup 🔑

1. Copy `config.template.js` to `config.js`
2. Obtain a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Replace `YOUR_GEMINI_API_KEY_HERE` in `config.js` with your actual API key
4. The API key is stored locally and NOT shared when you commit code to GitHub

## 📋 Usage

1. Click on the extension icon in your browser toolbar
2. Click the "Scan This Page" button
3. Review the list of detected dark patterns
4. Use the "Highlight" buttons to visually identify dark patterns on the page
5. Click "Highlight All" to show all detected patterns at once
6. Hover over highlighted sections to see information about the dark pattern

## 🔄 Version Management

This extension uses semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Incompatible API changes
- **MINOR**: New features in a backward-compatible manner
- **PATCH**: Bug fixes in a backward-compatible manner

### 1. Development Scripts 📜

Install the development tools once with `npm install`. Then:

| Command | What it does |
|---|---|
| `npm run check` | Runs ESLint and the test suite (`npm run lint` and `npm test` separately) |
| `npm run build` | Packages the extension as `dist/dark-patterns-detector-v<version>.zip`. Files are discovered from what the extension references, and the build fails if one is missing |
| `npm run bump-patch`, `bump-minor`, `bump-major` | Updates the version in `manifest.json` |

GitHub Actions runs lint, tests and a build on every push and pull request (`.github/workflows/ci.yml`). The packaged zip is attached to each run.

> ⚠️ The build includes `config.js`, so anyone with the zip can read the API key. Don't publish it to the Chrome Web Store until the key is moved to a backend.

### 2. Rollback Procedure 🔙

If you need to roll back to a previous version:

1. Check out the release's git tag (or download its zip from the GitHub Actions run) and run `npm run build`
2. Load the unpacked extension in Chrome developer mode
3. Test thoroughly to ensure it works as expected

### 3. Version History 📊

See the [CHANGELOG.md](CHANGELOG.md) file for a detailed version history.

## 🛠️ Technical Implementation

- **Popup Interface**: HTML/CSS/JavaScript that provides the user interface
- **Content Script**: Handles DOM manipulation and highlighting
- **AI Integration**: Sends page content to Gemini API for dark pattern detection
- **Storage**: Saves detection results between page refreshes

## 🎓 Project Purpose

This extension was developed as a **Final Year (Capstone) project** for the Bachelor of Engineering (IT) degree at Pune Institute of Computer Technology (PICT) Pune, by the following students:
1. [Rudra Kadam](https://www.linkedin.com/in/rudrkadam/)
2. [Mugdha Kulkarni](https://www.linkedin.com/in/mugdha-kulkarni-243752229/)
3. [Diya Oswal](https://www.linkedin.com/in/diya-oswal-74b003226/)
4. [Gargi Meshram](https://www.linkedin.com/in/gargi-meshram-3b0932251/)

- This research was presented at [ICTIS 2026 ](https://ictisthailand.com/) on 10th of April 2026. 
- You can view the presentation [here](https://docs.google.com/presentation/d/1oiNMNfWHm4qANeMR_wFwiYmeluyKcEBR/edit?usp=sharing&ouid=113386920571018637509&rtpof=true&sd=true).

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
