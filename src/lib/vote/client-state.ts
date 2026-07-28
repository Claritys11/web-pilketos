"use client";

export interface VotingCandidate {
  id: string;
  electionId: string;
  orderNumber: number;
  name: string;
  className: string;
  vision: string;
  missions: string[];
  photoUrl: string | null;
}

export interface VotingSession {
  token: string;
  electionId: string;
  electionTitle: string;
  selectedCandidate?: VotingCandidate;
}

const SESSION_KEY = "pilketos.voting.session";
const DONE_KEY = "pilketos.voting.done";

export function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function loadVotingSession(): VotingSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as VotingSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveVotingSession(session: VotingSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearVotingSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function markVotingDone() {
  window.sessionStorage.setItem(DONE_KEY, String(Date.now()));
}

export function consumeVotingDone() {
  const value = window.sessionStorage.getItem(DONE_KEY);
  window.sessionStorage.removeItem(DONE_KEY);
  return Boolean(value);
}
