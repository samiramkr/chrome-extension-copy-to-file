interface MessageProps {
  type: "success" | "error" | "info";
  text: string;
}

const styles: Record<string, string> = {
  success: "bg-green-50 text-green-700 border border-green-200",
  error: "bg-red-50 text-red-700 border border-red-200",
  info: "bg-blue-50 text-blue-700 border border-blue-200",
};

export function Message({ type, text }: MessageProps) {
  return (
    <div className={`mt-3 p-2.5 rounded-lg text-xs leading-relaxed ${styles[type]}`}>
      {text}
    </div>
  );
}
