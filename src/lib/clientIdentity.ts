// Zero-friction identity shared by predictions and comments: a random id the
// browser generates once and keeps in localStorage, plus the nickname the
// person last used. Never a login; upgraded to a real email only if they opt
// into "save my profile" (see SaveProfilePrompt).
const KEY_STORAGE = "wfp_predictor_key";
const NICKNAME_STORAGE = "wfp_predictor_nickname";

export function getOrCreatePredictorKey(): string {
  let id = localStorage.getItem(KEY_STORAGE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY_STORAGE, id);
  }
  return id;
}

// Used by the emailed sign-in link to restore a saved profile on this browser.
export function setPredictorKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key);
}

export function getStoredNickname(): string {
  return localStorage.getItem(NICKNAME_STORAGE) ?? "";
}

// Fired whenever a nickname is saved, so other forms on the same page (the
// predict form and the comment form) can pick it up without a reload.
export const IDENTITY_CHANGED_EVENT = "wfp:identity-changed";

export function storeNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_STORAGE, nickname);
  window.dispatchEvent(new Event(IDENTITY_CHANGED_EVENT));
}

// Fired after anything new is posted on a project so other components on
// the page (the Comments list) can refresh without sharing state.
export const DISCUSSION_CHANGED_EVENT = "wfp:discussion-changed";
