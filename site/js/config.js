// ─── APP CONFIG ───────────────────────────────────────────────────────────────
// These values are populated after `terraform apply` – update them from outputs.
const APP_CONFIG = {
  COGNITO_USER_POOL_ID: "REPLACE_AFTER_TERRAFORM_APPLY",
  COGNITO_CLIENT_ID: "REPLACE_AFTER_TERRAFORM_APPLY",
  COGNITO_DOMAIN: "REPLACE_AFTER_TERRAFORM_APPLY",
  API_ENDPOINT: "REPLACE_AFTER_TERRAFORM_APPLY",
  REDIRECT_URI: "https://spanish-tutor.vizeet.me",
  REGION: "ap-south-1",
};
