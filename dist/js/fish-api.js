/*
 * AI assistance was used to simplify the HTTP request and error handling.
 * This module replaces GameServer.java from Marc Conrad's teaching example.
 * API documentation: https://marcconrad.com/uob/fish/doc.php
 * JSON has question (image), fish (answer), and chest (not the answer).
 */
export const API_URL =
  "https://marcconrad.com/uob/fish/api.php?out=json&base64=yes";

export function parseQuestion(data) {
  if (data === null || typeof data !== "object") {
    throw new Error("The API did not return a question.");
  }
  let answer = Number(data.fish);
  if (!Number.isInteger(answer) || answer < 0 || answer > 9) {
    throw new Error("The API fish count must be from 0 to 9.");
  }
  if (typeof data.question !== "string" || data.question.length < 20) {
    throw new Error("The API picture is missing.");
  }
  let image = "";
  if (data.question.startsWith("https://")) {
    image = data.question;
  } else if (data.question.startsWith("data:image/")) {
    image = data.question;
  } else if (/^[A-Za-z0-9+/=\s]+$/.test(data.question)) {
    image = "data:image/png;base64," + data.question.replace(/\s/g, "");
  } else {
    throw new Error("The API picture has an unexpected format.");
  }
  return { answer: answer, image: image, source: "live" };
}

export async function fetchQuestion(signal) {
  // I stop the request if the API takes more than 15 seconds.
  let controller = new AbortController();
  function cancelRequest() {
    controller.abort();
  }
  if (signal !== undefined) {
    signal.addEventListener("abort", cancelRequest, { once: true });
    if (signal.aborted) {
      controller.abort();
    }
  }
  let timeout = setTimeout(cancelRequest, 15000);
  try {
    let response = await fetch(API_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Fish API returned status " + response.status);
    }
    let data = await response.json();
    return parseQuestion(data);
  } finally {
    clearTimeout(timeout);
    if (signal !== undefined) {
      signal.removeEventListener("abort", cancelRequest);
    }
  }
}
