// ─── Chrome Message Types ───

export interface GetAuthTokenMessage {
  type: "GET_AUTH_TOKEN";
}

export interface SaveTextMessage {
  type: "SAVE_TEXT";
  text: string;
  url: string;
  tag: string;
  originalText?: string;
}

export interface TranslateTextMessage {
  type: "TRANSLATE_TEXT";
  text: string;
  targetLang: string;
}

export interface ShowNotificationMessage {
  type: "SHOW_NOTIFICATION";
  message: string;
}

export type ExtensionMessage =
  | GetAuthTokenMessage
  | SaveTextMessage
  | TranslateTextMessage
  | ShowNotificationMessage;

// ─── Response Types ───

export interface SuccessTokenResponse {
  success: true;
  token: string;
}

export interface SuccessResponse {
  success: true;
}

export interface TranslateSuccessResponse {
  success: true;
  translatedText: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type AuthResponse = SuccessTokenResponse | ErrorResponse;
export type SaveResponse = SuccessResponse | ErrorResponse;
export type TranslateResponse = TranslateSuccessResponse | ErrorResponse;
