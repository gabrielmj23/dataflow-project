input.onButtonPressed(Button.A, function () {
    basic.showString("A")
    serial.writeLine("BTN:A")
    bluetooth.uartWriteLine("BTN:A")
})
// Indicador mientras la tarjeta procesa una operación
let operationIndicator = false
let indicatorRunning = false

function startIndicator() {
    if (indicatorRunning) return
    indicatorRunning = true
    control.inBackground(function () {
        while (operationIndicator) {
            led.toggle(3, 0)
            led.toggle(4, 0)
            led.toggle(3, 1)
            led.toggle(4, 1)
            basic.pause(300)
        }
        led.unplot(3, 0)
        led.unplot(4, 0)
        led.unplot(3, 1)
        led.unplot(4, 1)
        indicatorRunning = false
    })
}
function handleCommand (msg: string) {
    msg = (msg || "").trim()
if (!(true)) {
        return
    }
    if (msg.indexOf("TXT:") == 0) {
        contenido = msg.substr(4)
        if (contenido.length > 0) {            
            basic.showString(contenido)
        }
        return
    }
    if (msg.indexOf("SUM:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            sum = a + b
            operationIndicator = true
            startIndicator()
            basic.showNumber(sum)
            operationIndicator = false
            const out = "SUM:" + sum
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
        }
        return
    }
    if (msg.indexOf("SUB:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            result = a - b
            operationIndicator = true
            startIndicator()
            const out = "SUB:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("MUL:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            result = a * b
            operationIndicator = true
            startIndicator()
            const out = "MUL:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("DIV:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            if (b == 0) {
                result = 0
            } else {
                result = a / b
            }
            operationIndicator = true
            startIndicator()
            const out = "DIV:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("MOD:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            if (b == 0) {
                result = 0
            } else {
                result = a % b
            }
            operationIndicator = true
            startIndicator()
            const out = "MOD:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("POW:") == 0) {
        const payload = msg.substr(4).trim()
        parts = payload.split(",")
        a = parseFloat((parts[0] || "").trim())
        b = parseFloat((parts[1] || "").trim())
        if (!(isNaN(a)) && !(isNaN(b))) {
            result = Math.pow(a, b)
            operationIndicator = true
            startIndicator()
            const out = "POW:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("FLOOR:") == 0) {
        const payload = msg.substr(6).trim()
        a = parseFloat(payload)
        if (!(isNaN(a))) {
            result = Math.floor(a)
            operationIndicator = true
            startIndicator()
            const out = "FLOOR:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("CEIL:") == 0) {
        const payload = msg.substr(5).trim()
        a = parseFloat(payload)
        if (!(isNaN(a))) {
            result = Math.ceil(a)
            operationIndicator = true
            startIndicator()
            const out = "CEIL:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("ROUND:") == 0) {
        const payload = msg.substr(6).trim()
        a = parseFloat(payload)
        if (!(isNaN(a))) {
            result = Math.round(a)
            operationIndicator = true
            startIndicator()
            const out = "ROUND:" + result
            serial.writeLine(out)
            bluetooth.uartWriteLine(out)
            operationIndicator = false
        }
        return
    }
    if (msg.indexOf("CONCAT:") == 0) {
        const payload = msg.substr(7)
        parts = payload.split("|")
        textA = parts[0] || ""
        textB = parts[1] || ""
        operationIndicator = true
        startIndicator()
        const out = "CONCAT:" + textA + textB
        serial.writeLine(out)
        bluetooth.uartWriteLine(out)
        operationIndicator = false
        return
    }
    if (msg.indexOf("SND:") == 0) {
        const payload = msg.substr(4).trim()
ms = 250
        if (payload.indexOf(",") >= 0) {
            parts = payload.split(",")
            freq = parseInt((parts[0] || "").trim())
            d = parseInt((parts[1] || "").trim())
            if (!(isNaN(d)) && d > 0) {
                ms = d
            }
        } else {
            freq = parseInt(payload)
        }
        if (!(isNaN(freq)) && freq > 0) {
            operationIndicator = true
            startIndicator()
            music.playTone(freq, ms)
            operationIndicator = false
        }
        return
    }
}
// --- RECEPCIÓN BLUETOOTH UART
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    mensaje = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    handleCommand(mensaje)
})
input.onButtonPressed(Button.B, function () {
    basic.showString("B")
    serial.writeLine("BTN:B")
    bluetooth.uartWriteLine("BTN:B")
})
// --- RECEPCIÓN USB SERIAL
serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    mensaje = serial.readUntil(serial.delimiters(Delimiters.NewLine))
    handleCommand(mensaje)
})
let mensaje = ""
let d = 0
let freq = 0
let parts: string[] = []
let sum = 0
let b = 0
let a = 0
let result = 0
let textB = ""
let textA = ""
let ms = 0
let contenido = ""
bluetooth.startUartService()
// --- SETUP (una sola vez)
serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)
