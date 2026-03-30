#!/usr/bin/env bash
# ============================================================
# deploy.sh — Brickify full-stack deployment to Firebase + Cloud Run
#
# Prerequisites:
#   gcloud CLI installed & authenticated (gcloud auth login)
#   firebase CLI installed (npm install -g firebase-tools)
#   firebase login
#   Docker daemon running (for Cloud Run build)
#
# Usage:
#   ./deploy.sh [--skip-backend] [--skip-frontend]
# ============================================================
set -euo pipefail

PROJECT_ID="brickify999"
REGION="asia-southeast2"
SERVICE_NAME="brickify-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
FRONTEND_URL="https://${PROJECT_ID}.web.app"

SKIP_BACKEND=false
SKIP_FRONTEND=false
for arg in "$@"; do
  case $arg in
    --skip-backend)  SKIP_BACKEND=true  ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
  esac
done

echo "🔧  Project: ${PROJECT_ID}"
echo "🌍  Region:  ${REGION}"
echo ""

# ── 1. Deploy Backend to Cloud Run ─────────────────────────────────────────
if [ "$SKIP_BACKEND" = false ]; then
  echo "📦  Building and deploying backend…"

  gcloud config set project "${PROJECT_ID}"

  # Enable required APIs (idempotent)
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --quiet

  # Load secrets from .env
  set +x
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  else
    echo "⚠️  .env file not found. Deploying without secrets."
  fi
  set -x

  # Deploy to Cloud Run from source
  gcloud run deploy "${SERVICE_NAME}" \
    --source ./backend \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 2 \
    --timeout 120 \
    --set-env-vars "ENV=production,FIREBASE_PROJECT_ID=${PROJECT_ID},ADMIN_EMAILS=${ADMIN_EMAILS:-amuhr4@gmail.com},ALLOWED_ORIGINS=${FRONTEND_URL},FIREBASE_API_KEY=${FIREBASE_API_KEY:-},FIREBASE_APP_ID=${FIREBASE_APP_ID:-},FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID:-},FIREBASE_MEASUREMENT_ID=${FIREBASE_MEASUREMENT_ID:-},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET:-brickify999.firebasestorage.app}" \
    --quiet


  BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --format "value(status.url)")
  echo "✅  Backend deployed: ${BACKEND_URL}"
else
  echo "⏭️   Skipping backend deployment"
  BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --format "value(status.url)" 2>/dev/null || echo "NOT_DEPLOYED")
fi

# ── 2. Deploy Firestore Security Rules ─────────────────────────────────────
echo ""
echo "🔒  Deploying Firestore security rules…"
firebase deploy --only firestore:rules --project "${PROJECT_ID}"
echo "✅  Firestore rules deployed"

# ── 3. Deploy Frontend to Firebase Hosting ─────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  echo ""
  echo "🌐  Deploying frontend to Firebase Hosting…"
  firebase deploy --only hosting --project "${PROJECT_ID}"
  echo "✅  Frontend deployed: ${FRONTEND_URL}"
else
  echo "⏭️   Skipping frontend deployment"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  🎉 Deployment complete!"
echo "  Frontend:  ${FRONTEND_URL}"
echo "  Backend:   ${BACKEND_URL:-check Cloud Run console}"
echo "════════════════════════════════════════════"

# ── 3. Done ────────────────────────────────────────────
