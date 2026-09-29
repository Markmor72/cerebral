// ky039-dsp.ts
// Procesamiento de la señal del KY-039 (fotopletismografía, PPG).
//
// Este archivo NO usa ninguna función de micro:bit: recibe números y devuelve
// números. Por eso se puede probar en Node (ver herramientas/prueba-node).
//
// Pasos por cada muestra:
//   1. Quitar la componente continua (línea de base) con una media exponencial.
//   2. Suavizar con un promedio móvil corto (~40 ms) para bajar el ruido.
//   3. Seguir el pico reciente de la señal (decae con vida media de 1,5 s).
//   4. Detectar un latido cuando la señal cruza hacia arriba el umbral
//      (fracción del pico), respetando un período refractario de 300 ms.
//   5. Calcular BPM como mediana de los últimos intervalos RR.

class DetectorPulsoKY039 {
    // ---- Parámetros ajustables ----
    sensibilidad: number = 0.6      // umbral = pico * sensibilidad (0.2 a 0.9)
    amplitudMinima: number = 6      // cuentas ADC (0-1023) para considerar que hay pulso
    invertir: boolean = false       // true si la señal sube cuando debería bajar
    refractarioMs: number = 300     // tiempo mínimo entre latidos (máx. 200 BPM)

    // ---- Resultados (solo lectura) ----
    filtrado: number = 0
    umbral: number = 0
    latidos: number = 0
    rrMs: number = 0
    amplitud: number = 0
    hayPulso: boolean = false

    private fs: number = 100
    private base: number = 0
    private hayBase: boolean = false
    private alfa: number = 0
    private ventana: number[] = []
    private vIdx: number = 0
    private pico: number = 0
    private decaimiento: number = 0
    private arriba: boolean = false
    private ultimoLatido: number = -1
    private rrs: number[] = []
    private tInicio: number = 0
    private tVentana: number = 0
    private vMax: number = 0
    private vMin: number = 0

    constructor(fs: number) {
        this.fs = fs
        // Constante de tiempo de 0,7 s para la línea de base
        this.alfa = 1 - Math.exp(-1 / (fs * 0.7))
        // Vida media de 1,5 s para el seguidor de pico
        this.decaimiento = Math.pow(0.5, 1 / (fs * 1.5))
        const n = Math.max(2, Math.round(fs * 0.04))
        this.ventana = []
        for (let i = 0; i < n; i++) this.ventana.push(0)
        this.reiniciar()
    }

    reiniciar(): void {
        this.hayBase = false
        this.base = 0
        this.vIdx = 0
        for (let i = 0; i < this.ventana.length; i++) this.ventana[i] = 0
        this.pico = 0
        this.arriba = false
        this.ultimoLatido = -1
        this.rrs = []
        this.latidos = 0
        this.rrMs = 0
        this.amplitud = 0
        this.hayPulso = false
        this.filtrado = 0
        this.umbral = 0
        this.vMax = 0
        this.vMin = 0
    }

    // Procesa una muestra. Devuelve una máscara de bits:
    //   1 = se detectó un latido
    //   2 = cambió el estado de "hay pulso"
    procesar(crudo: number, ahoraMs: number): number {
        let resultado = 0
        if (!this.hayBase) {
            this.base = crudo
            this.hayBase = true
            this.tInicio = ahoraMs
            this.tVentana = ahoraMs
        }

        // 1. Línea de base
        this.base += (crudo - this.base) * this.alfa
        let x = crudo - this.base
        if (this.invertir) x = -x

        // 2. Promedio móvil (se recalcula la suma para no acumular error)
        this.ventana[this.vIdx] = x
        this.vIdx = (this.vIdx + 1) % this.ventana.length
        let suma = 0
        for (let i = 0; i < this.ventana.length; i++) suma += this.ventana[i]
        const f = suma / this.ventana.length
        this.filtrado = f

        // Calentamiento: 1,5 s para que la línea de base se estabilice
        if (ahoraMs - this.tInicio < 1500) {
            this.vMax = f
            this.vMin = f
            this.tVentana = ahoraMs
            return 0
        }

        // 3. Seguidor de pico y umbral
        this.pico = Math.max(this.pico * this.decaimiento, f)
        this.umbral = this.pico * this.sensibilidad

        // Presencia de pulso: amplitud pico a pico en ventanas de 2 s
        if (f > this.vMax) this.vMax = f
        if (f < this.vMin) this.vMin = f
        if (ahoraMs - this.tVentana >= 2000) {
            this.amplitud = Math.round(this.vMax - this.vMin)
            const nuevo = this.amplitud >= this.amplitudMinima
            if (nuevo != this.hayPulso) {
                this.hayPulso = nuevo
                resultado |= 2
            }
            this.vMax = f
            this.vMin = f
            this.tVentana = ahoraMs
        }

        // 4. Detección con histéresis
        if (this.arriba) {
            if (f < this.umbral * 0.4) this.arriba = false
        } else if (f > this.umbral && this.pico >= this.amplitudMinima * 0.5) {
            this.arriba = true
            if (this.ultimoLatido < 0 || ahoraMs - this.ultimoLatido >= this.refractarioMs) {
                this.registrarLatido(ahoraMs)
                resultado |= 1
            }
        }
        return resultado
    }

    private registrarLatido(ahoraMs: number): void {
        this.latidos++
        if (this.ultimoLatido >= 0) {
            const rr = ahoraMs - this.ultimoLatido
            if (rr <= 2000) {
                this.rrMs = rr
                this.rrs.push(rr)
                if (this.rrs.length > 8) this.rrs.shift()
            } else {
                // Pasó demasiado tiempo: empezar de nuevo
                this.rrs = []
                this.rrMs = 0
            }
        }
        this.ultimoLatido = ahoraMs
    }

    // 5. BPM como mediana de los últimos (hasta 5) intervalos RR
    frecuencia(ahoraMs: number): number {
        if (this.ultimoLatido < 0 || ahoraMs - this.ultimoLatido > 3000) return 0
        const n = Math.min(this.rrs.length, 5)
        if (n < 2) return 0
        const a: number[] = []
        for (let i = this.rrs.length - n; i < this.rrs.length; i++) a.push(this.rrs[i])
        // orden por inserción
        for (let i = 1; i < a.length; i++) {
            const v = a[i]
            let j = i - 1
            while (j >= 0 && a[j] > v) {
                a[j + 1] = a[j]
                j--
            }
            a[j + 1] = v
        }
        let mediana = 0
        if (n % 2 == 1) mediana = a[Math.floor(n / 2)]
        else mediana = (a[n / 2 - 1] + a[n / 2]) / 2
        return Math.round(60000 / mediana)
    }

    // Milisegundos desde el último latido, o -1 si todavía no hubo ninguno
    msDesdeUltimoLatido(ahoraMs: number): number {
        if (this.ultimoLatido < 0) return -1
        return ahoraMs - this.ultimoLatido
    }
}

// Señal PPG sintética: un pico sistólico y una onda dicrótica más chica.
// Sirve en el simulador y para probar sin sensor.
function ky039SenalSimulada(tMs: number, bpm: number, ruido: number): number {
    const periodo = Math.round(60000 / bpm)
    const fase = (tMs % periodo) / periodo
    const a = (fase - 0.15) / 0.06
    const b = (fase - 0.45) / 0.09
    return 512 + 30 * Math.exp(-0.5 * a * a) + 10 * Math.exp(-0.5 * b * b) + ruido
}
