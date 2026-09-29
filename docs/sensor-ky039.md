# Sensor KY-039: conexión, calibración y algoritmo

## Qué mide

El KY-039 tiene un LED infrarrojo y un fototransistor enfrentados. Al poner un dedo en medio,
la cantidad de luz que llega al fototransistor cambia un poco con cada latido (cambia el
volumen de sangre en el dedo). Esa técnica se llama fotopletismografía (PPG).

La salida es analógica: una tensión grande casi constante (componente continua) con una
pequeña variación (la componente de pulso, de unas pocas decenas de cuentas de 0 a 1023).

## Conexión

| KY-039 | micro:bit |
| ------ | --------- |
| S      | P0        |
| + (medio) | 3V     |
| −      | GND       |

El módulo está pensado para 5 V; con 3 V funciona pero con menos amplitud. Si la señal es
muy chica, bajá la *amplitud mínima* (bloque Avanzado) y probá con más presión del dedo.

## Calibración paso a paso

1. Corré el ejemplo del gráfico serial y mirá `crudo` y `filtrado` en la consola.
2. Sin dedo, `filtrado` debe quedar cerca de 0 y `¿hay señal de pulso?` en falso.
3. Con el dedo, `filtrado` debe oscilar con cada latido.
4. Si el BPM no coincide con lo que ves en el gráfico:
   - Cuenta latidos de más → subí el **umbral de latido** (por ejemplo 70 %).
   - Se pierden latidos → bajalo (por ejemplo 45 %).
   - Los picos del gráfico apuntan hacia abajo → activá **invertir señal**.
5. Si dice que no hay pulso aunque la señal se ve → bajá la **amplitud mínima**.

## Algoritmo (ky039-dsp.ts)

1. **Línea de base**: media exponencial (constante de 0,7 s), se resta a cada muestra.
2. **Suavizado**: promedio móvil de ~40 ms.
3. **Calentamiento**: se ignoran los primeros 1,5 s.
4. **Pico reciente**: se sigue el máximo de la señal filtrada con vida media de 1,5 s.
5. **Umbral**: `pico × umbral de latido` (60 % por defecto), con histéresis (se rearma al
   bajar del 40 % del umbral).
6. **Período refractario**: 300 ms entre latidos (máximo 200 BPM).
7. **BPM**: `60000 / mediana` de los últimos hasta 5 intervalos RR; devuelve 0 si pasaron más
   de 3 s sin latido o si hay menos de 2 intervalos.
8. **Presencia de pulso**: amplitud pico a pico en ventanas de 2 s comparada con la amplitud mínima.

## Pruebas sin hardware

`herramientas/prueba-node/probar.sh` genera señales PPG sintéticas (60, 72, 90, 120 BPM a
distintas frecuencias de muestreo, señal invertida y señal plana) y verifica que el
detector acierte el BPM (±2) y que no cuente latidos sin señal.

Estas pruebas validan la lógica, **no** la calidad de la señal de un sensor real: hay que
calibrar con el KY-039 en mano.
