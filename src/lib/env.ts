function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get cogneeBaseUrl() {
    return required("COGNEE_BASE_URL").replace(/\/$/, "");
  },
  get cogneeApiKey() {
    return required("COGNEE_API_KEY");
  },
  get cogneeTenantId() {
    return process.env.COGNEE_TENANT_ID ?? "";
  },
  get kvUrl() {
    return required("KV_REST_API_URL");
  },
  get kvToken() {
    return required("KV_REST_API_TOKEN");
  },
  /** Optional: empty string disables the actions layer entirely. */
  get groqApiKey() {
    return process.env.GROQ_API_KEY ?? "";
  },
};
