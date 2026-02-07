#!/bin/bash

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Iniciando Finance Pro (API + WEB)...${NC}"

# 1. Limpieza de procesos previos
fuser -k 3000/tcp 2>/dev/null
fuser -k 5000/tcp 2>/dev/null

# 2. Iniciar el API SCRAPER (api_bcv.py)
echo -e "${BLUE}🐍 Lanzando API Scraper (${GREEN}api_bcv.py${BLUE})...${NC}"
python3 api_bcv.py & 

# 3. Bucle de espera hasta que el puerto 5000 responda
echo -n "⏳ Esperando respuesta del API..."
until $(curl --output /dev/null --silent --head --fail http://localhost:5000/all); do
    printf '.'
    sleep 1
done

echo -e "\n${GREEN}✅ API en línea!${NC}"

# 4. Iniciar Servidor Node.js
echo -e "${BLUE}🌐 Lanzando Servidor Node.js...${NC}"
node server.js