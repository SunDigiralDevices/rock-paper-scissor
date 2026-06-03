const socket = io();
let currentRoom = "";
let myUsername = "";
const MAX_SCORE = 7;
let timerInterval = null;

// ==========================================
// Utility — Render dot scoreboard
// ==========================================
function renderDots(containerId, wins) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for (let i = 0; i < MAX_SCORE; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot' + (i < wins ? ' win' : '');
        container.appendChild(dot);
    }
}

function updateScores(myWins, enemyWins) {
    document.getElementById('myScore').textContent = myWins;
    document.getElementById('enemyScore').textContent = enemyWins;
    renderDots('myDots', myWins);
    renderDots('enemyDots', enemyWins);
}

// ==========================================
// Countdown Timer
// ==========================================
function startTimer(seconds, onEnd) {
    clearInterval(timerInterval);
    const ring = document.getElementById('timerRing');
    const circle = document.getElementById('timerCircle');
    const numEl = document.getElementById('timerNum');
    const total = 169.6;
    let t = seconds;

    function tick() {
        numEl.textContent = t;
        circle.style.strokeDashoffset = total * (1 - t / seconds);
        ring.className = 'timer-ring' + (t <= 3 ? ' urgent' : '');
        if (t <= 0) {
            clearInterval(timerInterval);
            if (onEnd) onEnd();
            return;
        }
        t--;
    }

    tick();
    timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const circle = document.getElementById('timerCircle');
    const ring = document.getElementById('timerRing');
    const numEl = document.getElementById('timerNum');
    if (circle) circle.style.strokeDashoffset = 0;
    if (ring) ring.className = 'timer-ring';
    if (numEl) numEl.textContent = '10';
}

// ==========================================
// 1. สร้างรหัสห้อง
// ==========================================
function generateRoomCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('roomInput').value = code;
    document.getElementById('generatedRoomCode').innerText = code;
    document.getElementById('generatedRoomArea').style.display = 'block';
}

// ==========================================
// 2. เข้าห้อง
// ==========================================
function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const room = document.getElementById('roomInput').value.trim();

    if (!username) { alert('กรอกชื่อผู้เล่นก่อนสิเพื่อน!'); return; }
    if (!room) { alert('กรอกรหัสห้องก่อนนะ!'); return; }

    myUsername = username;
    currentRoom = room;

    // ส่ง username ไปด้วย
    socket.emit('joinRoom', { roomName: currentRoom, username: myUsername });

    document.getElementById('lobby').style.display = 'none';
    document.getElementById('gameRoom').style.display = 'block';
    document.getElementById('roomTitle').innerText = `ห้อง: ${currentRoom}  ·  คุณ: ${myUsername}`;

    updateScores(0, 0);
}

// ==========================================
// 3. ส่งตัวเลือก
// ==========================================
function sendChoice(choice) {
    socket.emit('makeChoice', { roomName: currentRoom, choice });
    stopTimer();
    document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; });
    document.getElementById('status').innerText = 'รอคู่แข่งเลือก...';
}

// ==========================================
// 4. Socket Events
// ==========================================

socket.on('gameStart', () => {
    document.getElementById('status').innerText = 'เลือกอาวุธของคุณ!';
    document.getElementById('actionButtons').style.display = 'flex';
    startRound();
});

socket.on('roundResult', (data) => {
    const myId = socket.id;
    const enemyId = Object.keys(data.scores).find(id => id !== myId);

    updateScores(data.scores[myId] ?? 0, data.scores[enemyId] ?? 0);

    const choiceMap = { rock: '✊ ค้อน', scissors: '✌️ กรรไกร', paper: '✋ กระดาษ' };
    const myChoice = choiceMap[data.choices[myId]] || '';
    const enemyChoice = choiceMap[data.choices[enemyId]] || '';

    const resultEl = document.getElementById('roundResultText');

    if (data.roundWinner === 'เสมอ') {
        resultEl.className = 'draw';
        resultEl.innerText = `🤝 เสมอ!  ${myChoice} vs ${enemyChoice}`;
    } else if (data.roundWinner === myId) {
        resultEl.className = 'win';
        resultEl.innerText = `✅ คุณชนะตานี้!  ${myChoice} สู้ ${enemyChoice}`;
    } else {
        resultEl.className = 'lose';
        resultEl.innerText = `❌ คุณแพ้ตานี้!  ${myChoice} สู้ ${enemyChoice}`;
    }

    if (data.gameOver) {
        stopTimer();
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('status').innerText = data.winner === myId
            ? '🏆 คุณชนะ! จบเกม!'
            : '💀 คุณแพ้! จบเกม!';
        return;
    }

    setTimeout(() => {
        resultEl.className = '';
        resultEl.innerText = '';
        startRound();
    }, 2500);
});

socket.on('errorMsg', (msg) => {
    alert(msg);
    stopTimer();
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('gameRoom').style.display = 'none';
});

// แอบรับข้อมูลลับ (เฉพาะ Sun เท่านั้นที่ server จะส่งมาให้)
socket.on('cheatInfo', (msg) => {
    console.log('🤫 ' + msg);
    stopTimer();
    document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = false; });
    document.getElementById('status').innerText = `🤫 ${msg} — เลือกได้เลย!`;
});

// ==========================================
// Helper — เริ่มตาใหม่
// ==========================================
function startRound() {
    document.querySelectorAll('.choice-btn').forEach(b => {
        b.disabled = false;
        b.classList.remove('selected');
    });
    document.getElementById('status').innerText = 'เลือกอาวุธของคุณ!';

    startTimer(10, () => {
        document.getElementById('status').innerText = 'หมดเวลา! ถูกนับเป็นสละสิทธิ์';
        document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; });
        socket.emit('makeChoice', { roomName: currentRoom, choice: 'timeout' });
    });
}
