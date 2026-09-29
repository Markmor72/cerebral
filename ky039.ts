// ky039.ts
// Bloques de MakeCode para el sensor de pulso KY-039 (LED infrarrojo +
// fototransistor). El sensor entrega una señal analógica que varía un poco con
// cada latido cuando se apoya un dedo entre el LED y el fototransistor.
//
// La lógica de filtrado y detección está en ky039-dsp.ts.

//% weight=90 color=#d9415d icon="\uf21e" block="KY-039 (Pulso)"
//% groups='["Configuración","Lectura","Latidos","Eventos","Avanzado"]'
namespace ky039 {
    let pinSensor: AnalogPin = AnalogPin.P0
    let frecuenciaMuestreo = 100
    let detector: DetectorPulsoKY039 = null
    let activo = false
    let simulado = false
    let bpmSimulado = 72
    let ultimoCrudo = 0
    let sensibilidad = 0.6
    let amplitudMinima = 6
    let invertirSenal = false
    let alLatido: () => void = null
    let alAparecer: () => void = null
    let alPerder: () => void = null

    function esSimulador(): boolean {
        return control.deviceDalVersion() == "sim"
    }

    function bucleDeMuestreo(): void {
        const periodo = Math.round(1000 / frecuenciaMuestreo)
        let proximo = control.millis()
        while (activo) {
            const ahora = control.millis()
            if (simulado) {
                ultimoCrudo = Math.round(ky039SenalSimulada(ahora, bpmSimulado, randint(-2, 2)))
            } else {
                ultimoCrudo = pins.analogReadPin(pinSensor)
            }
            const r = detector.procesar(ultimoCrudo, ahora)
            if ((r & 1) != 0 && alLatido) control.inBackground(alLatido)
            if ((r & 2) != 0) {
                if (detector.hayPulso && alAparecer) control.inBackground(alAparecer)
                if (!detector.hayPulso && alPerder) control.inBackground(alPerder)
            }
            proximo += periodo
            const espera = proximo - control.millis()
            basic.pause(espera > 0 ? espera : 1)
        }
    }

    // ------------------------------------------------------------------
    // Configuración
    // ------------------------------------------------------------------

    /**
     * Elige el pin analógico donde está conectada la salida S del KY-039.
     * Usá P0, P1 o P2: los demás pines analógicos comparten señal con la matriz de LEDs.
     */
    //% blockId=ky039_configurar_pin
    //% block="KY-039 conectar sensor al pin %pin"
    //% pin.defl=AnalogPin.P0
    //% group="Configuración" weight=100
    export function configurarPin(pin: AnalogPin): void {
        pinSensor = pin
    }

    /**
     * Empieza a medir en segundo plano a la frecuencia indicada (muestras por segundo).
     * 100 Hz alcanza para pulso; más alto usa más CPU.
     */
    //% blockId=ky039_iniciar
    //% block="KY-039 iniciar monitoreo a %hz Hz"
    //% hz.min=25 hz.max=250 hz.defl=100
    //% group="Configuración" weight=90
    export function iniciar(hz: number = 100): void {
        detener()
        frecuenciaMuestreo = Math.max(25, Math.min(250, Math.round(hz)))
        if (esSimulador()) simulado = true
        detector = new DetectorPulsoKY039(frecuenciaMuestreo)
        detector.sensibilidad = sensibilidad
        detector.amplitudMinima = amplitudMinima
        detector.invertir = invertirSenal
        activo = true
        control.inBackground(bucleDeMuestreo)
    }

    /**
     * Detiene el monitoreo.
     */
    //% blockId=ky039_detener
    //% block="KY-039 detener monitoreo"
    //% group="Configuración" weight=80
    export function detener(): void {
        activo = false
        basic.pause(20)
    }

    /**
     * Genera una señal de pulso falsa (útil para probar sin sensor ni dedo).
     */
    //% blockId=ky039_usar_simulada
    //% block="KY-039 usar señal simulada a %bpm BPM"
    //% bpm.min=40 bpm.max=180 bpm.defl=72
    //% group="Configuración" weight=70
    export function usarSenalSimulada(bpm: number): void {
        bpmSimulado = Math.max(40, Math.min(180, Math.round(bpm)))
        simulado = true
    }

    /**
     * Vuelve a leer el sensor real (en el simulador de MakeCode siempre se usa la señal simulada).
     */
    //% blockId=ky039_usar_real
    //% block="KY-039 usar sensor real"
    //% group="Configuración" weight=60
    export function usarSensorReal(): void {
        simulado = esSimulador()
    }

    // ------------------------------------------------------------------
    // Lectura
    // ------------------------------------------------------------------

    /**
     * Última lectura analógica sin filtrar (0 a 1023).
     */
    //% blockId=ky039_valor_crudo
    //% block="KY-039 valor crudo"
    //% group="Lectura" weight=100
    export function valorCrudo(): number {
        return ultimoCrudo
    }

    /**
     * Señal sin componente continua y suavizada (positiva y negativa alrededor de 0).
     */
    //% blockId=ky039_valor_filtrado
    //% block="KY-039 valor filtrado"
    //% group="Lectura" weight=90
    export function valorFiltrado(): number {
        if (!detector) return 0
        return Math.round(detector.filtrado)
    }

    /**
     * Verdadero si la señal varía lo suficiente como para haber un dedo con pulso sobre el sensor.
     */
    //% blockId=ky039_hay_pulso
    //% block="KY-039 ¿hay señal de pulso?"
    //% group="Lectura" weight=80
    export function hayPulso(): boolean {
        if (!detector) return false
        return detector.hayPulso
    }

    /**
     * Amplitud pico a pico de la señal en los últimos 2 segundos (cuentas ADC).
     */
    //% blockId=ky039_amplitud
    //% block="KY-039 amplitud de la señal"
    //% group="Lectura" weight=70
    export function amplitudDeSenal(): number {
        if (!detector) return 0
        return detector.amplitud
    }

    /**
     * Envía por USB serie el valor crudo y el filtrado para verlos como gráfico en MakeCode.
     */
    //% blockId=ky039_enviar_serial
    //% block="KY-039 enviar muestras por serial"
    //% group="Lectura" weight=60
    export function enviarPorSerial(): void {
        serial.writeValue("crudo", ultimoCrudo)
        serial.writeValue("filtrado", valorFiltrado())
    }

    // ------------------------------------------------------------------
    // Latidos
    // ------------------------------------------------------------------

    /**
     * Frecuencia cardíaca en latidos por minuto (0 si todavía no hay datos suficientes).
     */
    //% blockId=ky039_bpm
    //% block="KY-039 frecuencia cardíaca (BPM)"
    //% group="Latidos" weight=100
    export function frecuenciaCardiaca(): number {
        if (!detector) return 0
        return detector.frecuencia(control.millis())
    }

    /**
     * Tiempo entre los dos últimos latidos, en milisegundos.
     */
    //% blockId=ky039_rr
    //% block="KY-039 intervalo entre latidos (ms)"
    //% group="Latidos" weight=90
    export function intervaloRR(): number {
        if (!detector) return 0
        return detector.rrMs
    }

    /**
     * Cantidad de latidos detectados desde que se inició el monitoreo.
     */
    //% blockId=ky039_cantidad
    //% block="KY-039 cantidad de latidos"
    //% group="Latidos" weight=80
    export function cantidadDeLatidos(): number {
        if (!detector) return 0
        return detector.latidos
    }

    /**
     * Milisegundos desde el último latido (-1 si todavía no hubo ninguno).
     */
    //% blockId=ky039_ms_ultimo
    //% block="KY-039 ms desde el último latido"
    //% group="Latidos" weight=70
    export function msDesdeUltimoLatido(): number {
        if (!detector) return -1
        return detector.msDesdeUltimoLatido(control.millis())
    }

    // ------------------------------------------------------------------
    // Eventos
    // ------------------------------------------------------------------

    /**
     * Se ejecuta cada vez que se detecta un latido.
     */
    //% blockId=ky039_al_latido
    //% block="KY-039 al detectar latido"
    //% group="Eventos" weight=100
    export function alDetectarLatido(handler: () => void): void {
        alLatido = handler
    }

    /**
     * Se ejecuta cuando aparece señal de pulso (se apoyó el dedo).
     */
    //% blockId=ky039_al_aparecer
    //% block="KY-039 al aparecer señal de pulso"
    //% group="Eventos" weight=90
    export function alAparecerSenal(handler: () => void): void {
        alAparecer = handler
    }

    /**
     * Se ejecuta cuando se pierde la señal de pulso (se retiró el dedo).
     */
    //% blockId=ky039_al_perder
    //% block="KY-039 al perder señal de pulso"
    //% group="Eventos" weight=80
    export function alPerderSenal(handler: () => void): void {
        alPerder = handler
    }

    // ------------------------------------------------------------------
    // Avanzado
    // ------------------------------------------------------------------

    /**
     * Ajusta qué tan alto debe subir la señal para contar un latido (porcentaje del pico reciente).
     * Bajalo si se pierden latidos; subilo si cuenta latidos de más.
     */
    //% blockId=ky039_sensibilidad
    //% block="KY-039 umbral de latido %porcentaje %"
    //% porcentaje.min=20 porcentaje.max=90 porcentaje.defl=60
    //% group="Avanzado" weight=100
    export function ajustarUmbral(porcentaje: number): void {
        sensibilidad = Math.max(20, Math.min(90, porcentaje)) / 100
        if (detector) detector.sensibilidad = sensibilidad
    }

    /**
     * Amplitud mínima (en cuentas de 0 a 1023) para considerar que hay pulso.
     */
    //% blockId=ky039_amplitud_minima
    //% block="KY-039 amplitud mínima %cuentas"
    //% cuentas.min=1 cuentas.max=200 cuentas.defl=6
    //% group="Avanzado" weight=90
    export function ajustarAmplitudMinima(cuentas: number): void {
        amplitudMinima = Math.max(1, Math.min(200, cuentas))
        if (detector) detector.amplitudMinima = amplitudMinima
    }

    /**
     * Invierte la señal. Probalo si el gráfico muestra picos hacia abajo y el BPM no coincide.
     */
    //% blockId=ky039_invertir
    //% block="KY-039 invertir señal %invertir"
    //% invertir.shadow="toggleOnOff"
    //% group="Avanzado" weight=80
    export function invertir(invertir: boolean): void {
        invertirSenal = invertir
        if (detector) detector.invertir = invertir
    }

    /**
     * Verdadero si el monitoreo está corriendo.
     */
    //% blockId=ky039_esta_activo
    //% block="KY-039 ¿monitoreo activo?"
    //% group="Avanzado" weight=70
    export function estaActivo(): boolean {
        return activo
    }

    /**
     * Verdadero cuando el programa corre en el simulador de MakeCode.
     */
    //% blockId=ky039_en_simulador
    //% block="KY-039 ¿está en el simulador?"
    //% group="Avanzado" weight=60
    export function enSimulador(): boolean {
        return esSimulador()
    }
}
