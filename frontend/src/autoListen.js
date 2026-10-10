import { apiUrl } from "./api.js";

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(binary);
}

function toInt16(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

// Splits a recorded clip into ~256 ms chunks of base64 16-bit PCM (what the Live API expects).
export function float32ToPcmChunks(samples, chunkSamples = 4096) {
  const chunks = [];
  for (let start = 0; start < samples.length; start += chunkSamples) {
    const end = Math.min(samples.length, start + chunkSamples);
    const bytes = new Uint8Array((end - start) * 2);
    const view = new DataView(bytes.buffer);
    for (let i = start; i < end; i += 1) view.setInt16((i - start) * 2, toInt16(samples[i]), true);
    chunks.push(bytesToBase64(bytes));
  }
  return chunks;
}

export function pcmToWavBase64(samples, sampleRate = 16000) {
  const dataLength = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataLength));
  const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + dataLength, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, dataLength, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, toInt16(samples[i]), true);
  return bytesToBase64(new Uint8Array(view.buffer));
}

// Asks the backend whether this clip is a companion request, an explicit quiet command, or reading aloud.
export async function classifyUtterance(samples, { companionName = "", book = "", signal } = {}) {
  const body = JSON.stringify({ audio: pcmToWavBase64(samples), companionName, book });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 12_000);
    const onAbort = () => controller.abort(signal.reason || new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    let response;
    try {
      response = await fetch(apiUrl("/api/reading/classify-utterance"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
    if (response.ok) {
      const data = await response.json();
      return { ask: data.ask === true, reading: data.reading === true };
    }
    if (attempt === 0 && [502, 503, 504].includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      continue;
    }
    throw new Error(`classify_${response.status}`);
  }
  throw new Error("classify_unavailable");
}