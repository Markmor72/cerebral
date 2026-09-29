// Corazón que late al ritmo del pulso; botón A muestra el BPM.
ky039.configurarPin(AnalogPin.P0)
ky039.iniciar(100)
ky039.alDetectarLatido(function () {
    basic.showIcon(IconNames.Heart)
    basic.pause(80)
    basic.showIcon(IconNames.SmallHeart)
})
input.onButtonPressed(Button.A, function () {
    basic.showNumber(ky039.frecuenciaCardiaca())
})
