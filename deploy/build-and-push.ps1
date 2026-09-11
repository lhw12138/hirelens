param(
  [Parameter(Mandatory=$true)][string]$Registry,
  [Parameter(Mandatory=$true)][string]$Namespace,
  [string]$Tag="v0.1.0"
)
$ErrorActionPreference="Stop"
$prefix="$Registry/$Namespace"
docker build --target web -t "$prefix/hirelens-web:$Tag" .
docker build -f Dockerfile.worker -t "$prefix/hirelens-worker:$Tag" .
docker build -f Dockerfile.embeddings -t "$prefix/hirelens-rag:$Tag" .
docker push "$prefix/hirelens-web:$Tag"
docker push "$prefix/hirelens-worker:$Tag"
docker push "$prefix/hirelens-rag:$Tag"
Write-Host "Images pushed with tag $Tag"
