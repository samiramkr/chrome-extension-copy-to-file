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

- [ ] Context menu "Save to Google Docs"
- [ ] Google OAuth 2.0 authentication
- [ ] Append selected text to a single Google Doc
- [ ] Include source URL and timestamp with each snippet
- [ ] Success/error notification

### Phase 2 — Enhancements

- [ ] Choose which Google Doc to save to
- [ ] Create a new doc from popup
- [ ] Organize saved texts with headings/horizontal dividers
- [ ] Keyboard shortcut (e.g., `Ctrl+Shift+S`)
- [ ] Floating "Save" button near text selection

### Phase 3 — Future

- [ ] Translate text before saving (Google Translate API)
- [ ] Tag/categorize saved snippets
- [ ] View saved snippets history in popup
- [ ] Export snippets as markdown

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

### Step 1 — Google Cloud Project Setup
- Create project, enable APIs, get OAuth Client ID

### Step 2 — Scaffold Extension
- Create all files with boilerplate code
- Set up manifest.json with permissions and OAuth config

### Step 3 — Implement Auth Flow
- Wire up `chrome.identity.getAuthToken`
- Handle login/logout in popup

### Step 4 — Build Context Menu + Save Logic
- Register context menu in background.js
- Capture selected text via content.js
- Append to Google Doc via Docs API

### Step 5 — Build Popup UI
- Show auth status
- Allow user to set/change target Google Doc
- Show recent save history

### Step 6 — Polish & Test
- Error handling
- Edge cases (no text selected, auth expired, etc.)
- Icons and branding

---

## 📌 Status

**Current Phase:** Planning  
**Last Updated:** March 8, 2026
