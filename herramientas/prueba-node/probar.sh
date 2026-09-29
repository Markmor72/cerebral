#!/bin/sh
# Compila el DSP + las pruebas y las corre con Node. Requiere: npm install -g typescript
set -e
cd "$(dirname "$0")"
rm -rf /tmp/ky039-out
tsc -p .
cat /tmp/ky039-out/ky039-dsp.js /tmp/ky039-out/herramientas/prueba-node/prueba.js > /tmp/ky039-prueba.js
node /tmp/ky039-prueba.js
