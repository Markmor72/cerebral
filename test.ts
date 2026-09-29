// Prueba de humo: corre en el simulador de MakeCode (no en el micro:bit).
ky039.usarSenalSimulada(72)
ky039.iniciar(100)
basic.pause(12000)
if (ky039.cantidadDeLatidos() < 5) {
    control.panic(1)
}
ky039.detener()
