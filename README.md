# SpanishAI – IGCSE Vocab Trainer

A full-stack Spanish vocabulary trainer hosted on AWS with Terraform IaC.

**Live URL:** https://spanish-tutor.vizeet.me

## Architecture

| Component | AWS Service |
|---|---|
| Static hosting | S3 |
| CDN + HTTPS | CloudFront |
| DNS | Route53 (vizeet.me) |
| TLS certificate | ACM (us-east-1) |
| Authentication | Cognito User Pool |
| Progress tracking | DynamoDB + Lambda |
| AI Chatbot | Lambda + OpenAI API |
| Backend API | API Gateway (HTTP) |
| Secrets | SSM Parameter Store |
| IaC | Terraform |
| CI/CD | GitHub Actions |

## Project Structure

```
SpanishTutorApp/
├── .github/workflows/
│   ├── infrastructure.yml    # Terraform + deploy pipeline
│   └── deploy-frontend.yml   # Frontend-only deploy
├── terraform/
│   ├── bootstrap/main.tf     # One-time: S3 state bucket + DynamoDB locks
│   ├── main.tf               # All AWS resources
│   ├── variables.tf
│   ├── outputs.tf
│   └── backend.tf            # Remote state config
├── lambda/
│   ├── progress/index.mjs    # GET/PUT /api/progress
│   └── chatbot/index.mjs     # POST /api/chat (Profesora Luna)
└── site/
    ├── index.html
    ├── css/
    │   ├── app.css
    │   └── chatbot.css
    └── js/
        ├── config.js          # Populated by CI/CD from Terraform outputs
        ├── auth.js            # Cognito PKCE auth (no SDK)
        ├── progress.js        # Local + cloud progress sync
        ├── chatbot.js         # Profesora Luna chatbot UI
        ├── vocab-data.js      # 705 IGCSE vocab words
        └── app.js             # Main app logic
```

## Setup

### Prerequisites

- AWS CLI configured with admin access
- Terraform >= 1.5
- Domain `vizeet.me` hosted zone in Route53
- OpenAI API key

### 1. Bootstrap Terraform State Backend (one-time)

```bash
cd terraform/bootstrap
terraform init
terraform apply
```

This creates the S3 bucket and DynamoDB table for Terraform remote state.

### 2. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan -var="openai_api_key=sk-your-key-here"
terraform apply -var="openai_api_key=sk-your-key-here"
```

### 3. Update Frontend Config

After `terraform apply`, copy the outputs into `site/js/config.js`:

```bash
terraform output
```

### 4. Deploy Frontend

```bash
aws s3 sync site/ s3://spanish-tutor.vizeet.me --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

## GitHub Actions CI/CD

### Required Secrets

Set these in your GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `AWS_ROLE_ARN` | IAM role ARN for GitHub OIDC (see below) |
| `OPENAI_API_KEY` | OpenAI API key |

### GitHub OIDC Setup

Create an IAM OIDC identity provider for GitHub Actions:

```bash
# 1. Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Create IAM role with trust policy for your repo
# Replace YOUR_GITHUB_ORG/YOUR_REPO with your actual values
```

### Workflows

- **`infrastructure.yml`** – Runs on changes to `terraform/` or `lambda/`. Does `terraform plan` on PRs, `terraform apply` + site deploy on merge to `main`.
- **`deploy-frontend.yml`** – Runs on changes to `site/` only. Reads Terraform outputs and syncs to S3 + invalidates CloudFront.

## Features

- **705 IGCSE vocab words** across 12 topic categories
- **5 study modes:** Flashcards, Multiple Choice, Fill in Blank, Match, AI Quiz
- **Cognito authentication** with PKCE flow (no SDK)
- **Progress tracking** synced to DynamoDB across devices
- **Profesora Luna** AI chatbot tutor with headshot avatar
- **Text-to-speech** via browser SpeechSynthesis
- **Priority filtering** (★★★ / ★★)
