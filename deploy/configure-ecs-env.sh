#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
umask 077

read -r -p "HireLens 管理员登录邮箱: " admin_email
read -r -s -p "HireLens 管理员登录密码: " admin_password
printf '\n'
read -r -s -p "新的 DeepSeek API Key: " model_api_key
printf '\n'

if [[ -z "$admin_email" || -z "$admin_password" || -z "$model_api_key" ]]; then
  echo "邮箱、登录密码和模型 Key 均不能为空。" >&2
  exit 1
fi

random_hex() { openssl rand -hex 32; }
postgres_password="$(random_hex)"
auth_secret="$(random_hex)"
candidate_secret="$(random_hex)"
settings_key="$(random_hex)"
rag_token="$(random_hex)"
s3_access_key="hl$(openssl rand -hex 10)"
s3_secret_key="$(random_hex)"

{
  printf 'IMAGE_TAG=v0.1.0\n'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf 'DATABASE_URL=postgres://hirelens:%s@postgres:5432/hirelens\n' "$postgres_password"
  printf '\n'
  printf 'AUTH_SECRET=%s\n' "$auth_secret"
  printf 'HR_ADMIN_EMAIL=%s\n' "$admin_email"
  printf 'HR_ADMIN_PASSWORD=%s\n' "$admin_password"
  printf 'DEMO_AUTH_BYPASS=false\n'
  printf 'CANDIDATE_LINK_SECRET=%s\n' "$candidate_secret"
  printf 'SETTINGS_ENCRYPTION_KEY=%s\n' "$settings_key"
  printf '\n'
  printf 'MODEL_BASE_URL=https://api.deepseek.com\n'
  printf 'MODEL_API_KEY=%s\n' "$model_api_key"
  printf 'MODEL_CONVERSATION=deepseek-chat\n'
  printf 'MODEL_INTERVIEW=deepseek-chat\n'
  printf 'MODEL_REVIEW=deepseek-chat\n'
  printf '\n'
  printf 'EMBEDDING_MODEL=intfloat/multilingual-e5-small\n'
  printf 'RERANK_MODEL=local-cosine\n'
  printf 'RAG_MODE=hybrid\n'
  printf 'RAG_LOCAL_URL=http://embeddings:3041\n'
  printf 'RAG_LOCAL_TOKEN=%s\n' "$rag_token"
  printf 'RAG_MODEL_HOST=https://modelscope.cn/\n'
  printf 'RAG_OFFLINE=false\n'
  printf '\n'
  printf 'S3_ENDPOINT=http://minio:9000\n'
  printf 'S3_BUCKET=hirelens\n'
  printf 'S3_ACCESS_KEY=%s\n' "$s3_access_key"
  printf 'S3_SECRET_KEY=%s\n' "$s3_secret_key"
  printf 'S3_FORCE_PATH_STYLE=true\n'
} > .env.server

chmod 600 .env.server
echo "已生成 deploy/.env.server；密钥未输出到终端。"
