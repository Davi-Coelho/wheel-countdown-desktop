let countDownDate = null
let countDownWorker = null
let timeLeft = 0
let maxTimeValue = 0
let running = false
let pause = false
let ws = null

const channelName = document.querySelector('#channel-name')
const startButton = document.querySelector('#start-button')
const pauseButton = document.querySelector('#pause-button')
const hoursLabel = document.getElementById('hours')
const minutesLabel = document.getElementById('mins')
const secondsLabel = document.getElementById('secs')
const maxTime = document.querySelector('#max-time')
const maxTimeDiv = document.querySelector('#max-time-div')
const timeLimit = document.querySelector('#time-limit')
const dateLimit = document.querySelector('#date-limit')
const enableLimit = document.querySelector('#enable-limit')

startButton.onclick = startCountDown
pauseButton.onclick = pauseCountDown
timeLimit.oninput = updateTimeLeft
dateLimit.oninput = updateTimeLeft
maxTime.oninput = updateDeadEnd
enableLimit.onclick = showLimits

async function startCountDown() {
    if (channelName.value !== '') {
        if (startButton.value === 'Começar') {
            saveData()
            switchMode(true)
            maxTimeValue = new Date().getTime() + parseFloat(maxTime.value) * 60 * 60 * 1000
            countDownDate = new Date().getTime() + (timeLeft > 0 ? timeLeft + 1000 : 1000)
            countDownWorker = new Worker('js/worker.js')
            countDownWorker.onmessage = countDownFunction
            ws = new WebSocket(`wss:davicoelho.com.br/?channel=${channelName.value}`)

            ws.onopen = function () {
                ws.send('conectado!')
            }
            
            ws.onmessage = function (msg) {
                console.log(msg.data)
                if (!enableLimit.checked || (countDownDate + parseFloat(msg.data)) <= maxTimeValue) {
                    countDownDate += parseFloat(msg.data)
                } else {
                    countDownDate = maxTimeValue
                }
            }
        } else {
            pauseButton.value = 'Pausar'
            pauseButton.classList.remove('paused')
            pause = false
            switchMode(false)
            timeLeft = 0
            updateTimer()
            countDownWorker.terminate()
            countDownWorker = undefined
            ws.close()
            await Neutralino.filesystem.writeFile('./timer.txt', "00:00:00")
        }
    }
}

async function updateTimer() {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    hoursLabel.innerHTML = hours >= 10 ? hours : "0" + hours
    minutesLabel.innerHTML = minutes >= 10 ? minutes : "0" + minutes
    secondsLabel.innerHTML = seconds >= 10 ? seconds : "0" + seconds
    await Neutralino.filesystem.writeFile('./timer.txt', `${hoursLabel.innerHTML}:${minutesLabel.innerHTML}:${secondsLabel.innerHTML}`)
}

async function countDownFunction() {
    const now = new Date().getTime();
    timeLeft = countDownDate - now;

    updateTimer()

    if (timeLeft < 0) {
        pauseButton.value = 'Pausar'
        pauseButton.classList.remove('paused')
        pause = false
        switchMode(false)
        timeLeft = 0
        updateTimer()
        countDownWorker.terminate()
        countDownWorker = undefined
        ws.close()
        await Neutralino.filesystem.writeFile('./timer.txt', "00:00:00")
    }
}

function pauseCountDown() {
    if (pause) {
        pause = false
        pauseButton.value = 'Pausar'
        pauseButton.classList.remove('paused')
        countDownDate = new Date().getTime() + timeLeft
        countDownWorker = new Worker('js/worker.js')
        countDownWorker.onmessage = countDownFunction
    } else {
        pause = true
        pauseButton.value = 'Resumir'
        pauseButton.classList.add('paused')
        countDownWorker.terminate()
        countDownWorker = undefined
    }
}

async function changeTimer(element) {
    const command = element.id.split('-')
    let value = null

    switch (command[2]) {
        case 'hours':
            value = 1000 * 60 * 60
            break
        case 'minutes':
            value = 1000 * 60
            break
        case 'seconds':
            value = 1000
            break
    }

    value = command[1] === 'unit' ? value : value * 10
    value = command[0] === 'add' ? value : value * (-1)

    if (value < 0 && Math.abs(value) > timeLeft) {
        return
    }

    if (pause || !running) {
        timeLeft += value
        updateTimer()
    } else {
        countDownDate += value
    }
}

function switchMode(state) {
    if (state) {
        startButton.value = 'Parar'
        startButton.classList.add('connected')
        pauseButton.removeAttribute('hidden')

    } else {
        startButton.value = 'Começar'
        startButton.classList.remove('connected')
        pauseButton.setAttribute('hidden', true)
    }

    running = state
    channelName.disabled = state
}

function updateTimeLeft() {
    const now = new Date().getTime()
    const limit = new Date(`${dateLimit.value}T${timeLimit.value}`).getTime()
    let timeLeft = limit - now
    timeLeft = timeLeft / (1000 * 60 * 60)
    maxTime.value = timeLeft.toFixed(1)
}

function updateDeadEnd() {
    if (maxTime.value === '' || isNaN(parseFloat(maxTime.value))) {
        maxTime.value = ''
    } else {
        const now = new Date().getTime()
        const timeLeft = parseFloat(maxTime.value) * 60 * 60 * 1000
        const deadEnd = new Date(now + timeLeft)
        const hours = deadEnd.getHours() < 10 ? "0" + deadEnd.getHours() : deadEnd.getHours()
        const minutes = deadEnd.getMinutes() < 10 ? "0" + deadEnd.getMinutes() : deadEnd.getMinutes()
        const day = (deadEnd.getDate() < 10) ? "0" + deadEnd.getDate() : deadEnd.getDate()
        const month = (deadEnd.getMonth() + 1) < 10 ? "0" + (deadEnd.getMonth() + 1) : deadEnd.getMonth() + 1
        const year = deadEnd.getFullYear()
    
        timeLimit.value = `${hours}:${minutes}`
        dateLimit.value = `${year}-${month}-${day}`
    }
}

function showLimits() {
    if (enableLimit.checked) {
        maxTimeDiv.removeAttribute('hidden')
        timeLimit.removeAttribute('hidden')
        dateLimit.removeAttribute('hidden')
    } else {
        maxTimeDiv.setAttribute('hidden', true)
        timeLimit.setAttribute('hidden', true)
        dateLimit.setAttribute('hidden', true)
    }
}

async function saveData() {
    await Neutralino.storage.setData('wheelConfig',
        JSON.stringify({
            channelName: channelName.value
        })
    )
}

async function loadConfig() {
    try {
        const data = JSON.parse(await Neutralino.storage.getData('wheelConfig'))

        if (data) {
            channelName.value = data.channelName
        }
    } catch (e) {
        console.log(e)
    }
}

function onWindowClose() {
    Neutralino.app.exit()
}

Neutralino.init()
Neutralino.events.on('windowClose', onWindowClose)

loadConfig()