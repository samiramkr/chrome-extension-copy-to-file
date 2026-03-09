# Chrome Extension: Save Selected Text to Google Docs

## 🎯 Core Functionality

1. User selects text on any webpage
2. Right-click context menu appears with "Save to Google Docs" option
3. Text is saved to a designated Google Doc (with source URL and timestamp)

---

## 📐 Architecture

### Components

| Component | Purpose |
|-----------|---------|
| **manifest.json** | Extension config (Manifest V3) |
| **background.js** | Service worker — handles context menu, Google Docs API calls |
| **content.js** | Content script — captures selected text from the page |
| **popup.html/js/css** | Settings UI — authenticate, choose target doc |
| **utils/google-docs.js** | Google Docs API helper functions |
| **auth (OAuth 2.0)** | `chrome.identity` for Google authentication |

### User Flow

```
Select text → Right-click → "Save to Google Docs"
    → Authenticate (first time only)
    → Append text + URL + timestamp to Google Doc
    → Show success notification
```

### Key Technical Decisions

- **Manifest V3** — Required for new Chrome extensions
- **Google Identity API** — `chrome.identity` for OAuth 2.0 authentication
- **Google Docs API** — To append text to a doc
- **Context Menu API** — `chrome.contextMenus` for right-click integration
- **Storage API** — `chrome.storage` to save user preferences (target doc ID)

---

## 📁 File Structure

```
chrome-extension-copy-to-file/
├── manifest.json          # Extension manifest (V3)
├── background.js          # Service worker (context menu + API calls)
├── content.js             # Content script (get selected text)
├── popup.html             # Settings/auth popup UI
├── popup.js               # Popup logic
├── popup.css              # Popup styling
├── utils/
│   └── google-docs.js     # Google Docs API helper functions
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── PLAN.md                # This file
└── README.md
```

---

## 🚀 Features (Prioritized)

### Phase 1 — MVP

- [x] Context menu "Save to Google Docs"
- [x] Google OAuth 2.0 authentication
- [x] Append selected text to a single Google Doc
- [x] Include source URL and timestamp with each snippet
- [x] Success/error notification
- [x] Google Cloud project setup & OAuth Client ID
- [x] End-to-end testing in Chrome

### Phase 2 — Enhancements

- [x] Choose which Google Doc to save to
- [x] Create a new doc from popup
- [x] Organize saved texts with headings/horizontal dividers
- [x] Keyboard shortcut (`Ctrl+Shift+S` / `Cmd+Shift+S`)
- [x] Floating "Save" button near text selection
- [x] Save history in popup (last 20 saves)
- [ ] Toggles to include/exclude URL and timestamp (#13)
- [ ] Customizable keyboard shortcut (#9)

### Phase 3 — Future

- [ ] Translate text before saving — Google Translate API (#6)
- [ ] Tag/categorize saved snippets (#7)
- [ ] Export snippets as Markdown (#8)
- [ ] Edit selected text before saving (#10)
- [ ] Save locally with destination choice (#11)
- [ ] Export to different file formats — Excel, CSV, PDF, etc. (#12)

---

## ⚙️ Google Cloud Setup (Prerequisites)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the **Google Docs API**
4. Configure **OAuth Consent Screen**
5. Create **OAuth 2.0 Client ID** (Application type: Chrome Extension)
6. Copy the **Client ID** into `manifest.json`

---

## 📝 Implementation Steps

### Step 1 — Google Cloud Project Setup ✅
- [x] Create project, enable APIs, get OAuth Client ID
- [x] Replace placeholder in `manifest.json`

### Step 2 — Scaffold Extension ✅
- [x] `manifest.json` — Manifest V3 with permissions & OAuth config
- [x] `background.js` — Service worker (context menu + Docs API)
- [x] `content.js` — Content script (toast notifications)
- [x] `utils/google-docs.js` — Google Docs API helpers
- [x] `popup.html` — Popup UI structure
- [x] `popup.css` — Popup styling
- [x] `popup.js` — Popup logic (auth, doc config)
- [x] `icons/` — Extension icons (16, 48, 128px)

### Step 3 — Implement Auth Flow ✅
- [x] Wire up `chrome.identity.getAuthToken`
- [x] Handle login/logout in popup
- [x] Token revocation on sign-out

### Step 4 — Build Context Menu + Save Logic ✅
- [x] Register context menu in background.js
- [x] Capture selected text via context menu selection
- [x] Append to Google Doc via Docs API
- [x] Include timestamp and source URL

### Step 5 — Build Popup UI ✅
- [x] Show auth status
- [x] Allow user to set/change target Google Doc
- [x] Create new Google Doc from popup
- [x] Show recent save history

### Step 6 — Polish & Test ✅
- [x] Error handling (auth, API, no doc configured)
- [x] Edge cases (no text selected, auth expired, etc.)
- [x] Icons and branding
- [x] Load unpacked in Chrome and test end-to-end

---

## 📌 Status

**Current Phase:** Phase 2 complete — working on remaining enhancements & Phase 3  
**Last Updated:** March 9, 2026

### Completed
- ✅ Phase 1 MVP — fully functional
- ✅ Phase 2 core — keyboard shortcut, floating button, save history
- ✅ Google Cloud setup & end-to-end testing

### Open Issues
- #6 — Translate text before saving
- #7 — Tag/categorize snippets
- #8 — Export as Markdown
- #9 — Customizable keyboard shortcut
- #10 — Edit text before saving
- #11 — Save locally with destination choice
- #12 — Export to different file formats
- #13 — Toggles for URL/timestamp inclusion
