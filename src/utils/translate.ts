/**
 * Translate text using the free Google Translate endpoint.
 */
export async function translateText(
  text: string,
  targetLang: string
): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?" +
    new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: targetLang,
      dt: "t",
      q: text,
    });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Translation service unavailable");
  }

  const data = await response.json();
  const translated = (data[0] as [string, string][])
    .map((segment) => segment[0])
    .join("");

  if (!translated) throw new Error("No translation returned");
  return translated;
}
