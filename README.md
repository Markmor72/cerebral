# cerebral — sensor de pulso KY-039 para micro:bit

Extensión de [MakeCode](https://makecode.microbit.org) para micro:bit (V1 y V2) con soporte
para el sensor de pulso **KY-039** (LED infrarrojo + fototransistor): lectura cruda y filtrada,
detección de latidos, frecuencia cardíaca (BPM), intervalos RR y eventos.

Basada en la estructura de [pxt-biomarcadores](https://github.com/martinferreiraHCA/pxt-biomarcadores)
(AD8232), pero para un sensor óptico (fotopletismografía) en lugar de ECG.

## Usar como extensión

1. Abrí [makecode.microbit.org](https://makecode.microbit.org) y creá un proyecto.
2. Menú ⚙ → **Extensiones** (o *Extensiones* al final de la lista de categorías).
3. Pegá la URL de este repositorio: `https://github.com/Markmor72/cerebral`.
4. Aparece la categoría **KY-039 (Pulso)**.

## Conexión del KY-039

| KY-039 | micro:bit |
| ------ | --------- |
| S      | P0        |
| + (medio) | 3V     |
| −      | GND       |

Usá **P0, P1 o P2** (los demás pines analógicos comparten señal con la matriz de LEDs).
Si usás otro, cambialo con el bloque *conectar sensor al pin*.

> ⚠️ El KY-039 es un módulo educativo/de experimentación. **No es un equipo médico** y no
> sirve para diagnóstico ni monitoreo clínico.

## Cómo colocar el dedo

- Apoyá la yema del dedo **entre el LED y el fototransistor**, con presión suave y constante.
- Mantené el dedo y la mano quietos: el movimiento genera más señal que el pulso.
- Evitá luz directa fuerte (sol, lámparas) sobre el sensor.
- Esperá unos 5 a 10 segundos hasta que el BPM se estabilice.

## Ejemplo: corazón que late al ritmo real

```blocks
ky039.iniciar(100)
ky039.alDetectarLatido(function () {
    basic.showIcon(IconNames.Heart)
    basic.pause(80)
    basic.showIcon(IconNames.SmallHeart)
})
input.onButtonPressed(Button.A, function () {
    basic.showNumber(ky039.frecuenciaCardiaca())
})
```

## Ejemplo: graficar la señal en la consola de MakeCode

```blocks
ky039.iniciar(100)
basic.forever(function () {
    ky039.enviarPorSerial()
    serial.writeValue("bpm", ky039.frecuenciaCardiaca())
    basic.pause(50)
})
```

En el simulador no hay sensor: la extensión genera automáticamente una señal de 72 BPM.
En el micro:bit real, el bloque **usar señal simulada a … BPM** sirve para probar sin sensor.

## Bloques

| Categoría | Bloques |
| --------- | ------- |
| Configuración | conectar sensor al pin · iniciar monitoreo a N Hz · detener · usar señal simulada · usar sensor real |
| Lectura | valor crudo · valor filtrado · ¿hay señal de pulso? · amplitud de la señal · enviar muestras por serial |
| Latidos | frecuencia cardíaca (BPM) · intervalo entre latidos · cantidad de latidos · ms desde el último latido |
| Eventos | al detectar latido · al aparecer señal de pulso · al perder señal de pulso |
| Avanzado | umbral de latido · amplitud mínima · invertir señal · ¿monitoreo activo? · ¿está en el simulador? |

## Cómo funciona

```
ky039.ts       bloques y bucle de muestreo (lee el pin analógico)
ky039-dsp.ts   filtro + detector de latidos (sin dependencias de micro:bit)
test.ts        prueba de humo para el simulador
herramientas/  pruebas del detector en Node
examples/      programas de ejemplo en TypeScript
docs/          guía de calibración y detalles del algoritmo
```

Todo el código es TypeScript (funciona igual en el simulador y en el micro:bit). El
procesamiento: quitar línea de base → suavizar → umbral adaptativo sobre el pico reciente →
período refractario de 300 ms → BPM como mediana de los últimos intervalos.

Más detalles y consejos de calibración en [docs/sensor-ky039.md](docs/sensor-ky039.md).

## Desarrollo

```
npm install -g pxt && pxt target microbit && pxt install
pxt build --cloud                                  # compila la extensión
npm install -g typescript && ./herramientas/prueba-node/probar.sh   # pruebas sin micro:bit
```

## Licencia

MIT.

## Supported targets

* for PXT/microbit
