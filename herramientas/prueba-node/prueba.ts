// Pruebas del detector del KY-039 en Node (sin micro:bit).
// Se compila junto con ky039-dsp.ts: ver probar.sh

function simular(fs: number, bpm: number, segundos: number, opciones: any): any {
    const d = new DetectorPulsoKY039(fs)
    if (opciones.invertir) d.invertir = true
    const paso = 1000 / fs
    let semilla = 12345
    function azar(): number {
        semilla = (semilla * 1103515245 + 12345) % 2147483648
        return semilla / 2147483648
    }
    for (let t = 0; t < segundos * 1000; t += paso) {
        const ruido = Math.round((azar() - 0.5) * 4)
        let v = opciones.plano ? 512 + ruido : ky039SenalSimulada(t, bpm, ruido)
        if (opciones.invertir) v = 1023 - v
        d.procesar(Math.round(v), Math.round(t))
    }
    return { bpm: d.frecuencia(Math.round(segundos * 1000)), latidos: d.latidos, hayPulso: d.hayPulso }
}

function verificar(nombre: string, condicion: boolean, detalle: string): void {
    console.log((condicion ? "OK   " : "FALLA") + " " + nombre + " -> " + detalle)
    if (!condicion) throw new Error("Falló: " + nombre)
}

const casos = [[100, 60], [100, 72], [100, 120], [200, 72], [50, 90]]
for (let i = 0; i < casos.length; i++) {
    const fs = casos[i][0]
    const bpm = casos[i][1]
    const r = simular(fs, bpm, 30, {})
    verificar(bpm + " BPM a " + fs + " Hz", Math.abs(r.bpm - bpm) <= 2 && r.hayPulso, JSON.stringify(r))
}

const inv = simular(100, 72, 30, { invertir: true })
verificar("señal invertida con invertir=true", Math.abs(inv.bpm - 72) <= 2, JSON.stringify(inv))

const plano = simular(100, 72, 30, { plano: true })
verificar("sin dedo (señal plana con ruido)", plano.latidos == 0 && !plano.hayPulso, JSON.stringify(plano))

console.log("Todas las pruebas pasaron")
