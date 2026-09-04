#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="landing-zone-demo-341118"
REGION="us-west1"
SERVICE="gemini-migration-assistant"

# Vertex AI location used by the app at runtime (server/index.ts) — kept
# separate from the Cloud Run service region above. "global" is used
# because gemini-3.8-flash is not available in us-central1 for this project.
VERTEX_LOCATION="global"

RUNTIME_SA="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
RUNTIME_SA="${RUNTIME_SA:-$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com}"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  >/dev/null

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}" \
  --allow-unauthenticated
