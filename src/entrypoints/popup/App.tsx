import { useState, useEffect } from "react";
import { AuthSection } from "@/components/popup/AuthSection";
import { ConnectedSection } from "@/components/popup/ConnectedSection";
import { Message } from "@/components/popup/Message";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    // Check for existing token (non-interactive)
    chrome.identity.getAuthToken({ interactive: false }, (t) => {
      if (t) setToken(t);
      setLoading(false);
    });
  }, []);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSignIn = () => {
    chrome.identity.getAuthToken({ interactive: true }, (t) => {
      if (chrome.runtime.lastError || !t) {
        showMessage(
          "error",
          chrome.runtime.lastError?.message || "Sign-in failed."
        );
        return;
      }
      setToken(t);
    });
  };

  const handleSignOut = () => {
    chrome.identity.getAuthToken({ interactive: false }, (t) => {
      if (t) {
        chrome.identity.removeCachedAuthToken({ token: t }, () => {
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${t}`)
            .then(() => {
              setToken(null);
              showMessage("info", "Signed out successfully.");
            })
            .catch(() => setToken(null));
        });
      } else {
        setToken(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="w-80 p-4">
        <div className="animate-pulse text-center text-sm text-gray-400 py-8">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 min-h-[200px] bg-white font-sans text-sm text-gray-800">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-200">
          <img src="/icon/128.png" alt="Logo" className="w-8 h-8" />
          <h1 className="text-base font-semibold text-gray-900">
            Save to Google Docs
          </h1>
        </div>

        {/* Auth / Connected */}
        {!token ? (
          <AuthSection onSignIn={handleSignIn} />
        ) : (
          <ConnectedSection
            token={token}
            onSignOut={handleSignOut}
            showMessage={showMessage}
          />
        )}

        {/* Status Message */}
        {message && <Message type={message.type} text={message.text} />}
      </div>
    </div>
  );
}
