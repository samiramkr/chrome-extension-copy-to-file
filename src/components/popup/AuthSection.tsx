interface AuthSectionProps {
  onSignIn: () => void;
}

export function AuthSection({ onSignIn }: AuthSectionProps) {
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-2.5">Not connected</p>
      <button
        onClick={onSignIn}
        className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
      >
        Sign in with Google
      </button>
    </div>
  );
}
