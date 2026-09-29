// Graficar la señal en la consola de MakeCode (conectá el micro:bit por USB).
ky039.iniciar(100)
basic.forever(function () {
    ky039.enviarPorSerial()
    serial.writeValue("bpm", ky039.frecuenciaCardiaca())
    basic.pause(50)
})
