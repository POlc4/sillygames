"use client";

// Détection WebGL sans mismatch d'hydratation : le serveur répond null, le client true/false.

import { useSyncExternalStore } from "react";

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function useWebGL(): boolean | null {
  return useSyncExternalStore(subscribe, detectWebGL, () => null);
}
