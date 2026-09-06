#!/bin/bash
echo "============================================="
echo "  DIAGNÓSTICO Y MONITOREO ÓPTICA INTEGRAL   "
echo "============================================="

echo "\n1. ESTADO DE CONTENEDORES DOCKER:"
docker compose ps

echo "\n2. PRUEBA DE CONEXIÓN BACKEND API (Puerto 3000):"
curl -s -i http://localhost:3000/api/auth/me | head -n 10

echo "\n3. PRUEBA DE FRONTEND WEB NGINX (Puerto 80):"
curl -s -i http://localhost/ | head -n 10

echo "\n4. ÚLTIMOS LOGS DEL BACKEND (15 líneas):"
docker compose logs --tail=15 backend

echo "\n5. ÚLTIMOS LOGS DEL FRONTEND WEB (15 líneas):"
docker compose logs --tail=15 frontend

echo "\n============================================="
