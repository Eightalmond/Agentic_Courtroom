export type DisplayError = Readonly<{ code: string; message: string }>;

export function toDisplayError(error: { code: string; message: string }): DisplayError {
  const code = error.code;

  if (code === "DEMO_RATE_LIMITED") {
    return { code, message: "This public demo has reached its temporary usage limit. Try again after the limit resets." };
  }
  if (code.includes("RATE_LIMIT")) {
    return { code, message: "The model provider is temporarily rate-limited. Try again after the provider limit resets." };
  }
  if (code.includes("API_KEY_MISSING") || code.includes("MODEL_MISSING") || code === "LLM_PROVIDER_INVALID") {
    return { code, message: "This deployment has not configured an LLM provider yet. Ask the demo owner to finish setup." };
  }
  if (code.includes("AUTHENTICATION") || code === "PROVIDER_AUTHENTICATION") {
    return { code, message: "The configured model-provider credentials were rejected. Ask the demo owner to check deployment settings." };
  }
  if (code.includes("TIMEOUT")) {
    return { code, message: "The model provider did not respond in time. Try the request again." };
  }
  if (code.includes("STRUCTURED_OUTPUT") || code.includes("INVALID_RESPONSE") || code === "MALFORMED_PROVIDER_RESPONSE") {
    return { code, message: "The model could not produce a valid structured result. Try the request again." };
  }
  if (code.includes("NETWORK")) {
    return { code, message: "The request could not reach the server or model provider. Check the connection and try again." };
  }
  if (code.includes("REQUEST_IN_PROGRESS")) {
    return { code, message: "A model request is already running for this test. Wait for it to finish before trying again." };
  }

  return { code, message: error.message };
}
