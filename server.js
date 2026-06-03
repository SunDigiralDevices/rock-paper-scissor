const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('มีคนเชื่อมต่อเข้ามา: ' + socket.id);

    // ---------------------------------------------
    // 1. ระบบการกดเข้าห้อง / สร้างห้อง (Join Room)
    // ---------------------------------------------
    socket.on('joinRoom', ({ roomName, username }) => {
        if (rooms[roomName] && rooms[roomName].players.includes(socket.id)) {
            return;
        }

        if (rooms[roomName] && rooms[roomName].players.length >= 2) {
            socket.emit('errorMsg', 'ห้องนี้เต็มแล้วครับเพื่อน!');
            return;
        }

        socket.join(roomName);

        if (!rooms[roomName]) {
            rooms[roomName] = {
                players: [],
                scores: {},
                choices: {},
                usernames: {}
            };
        }

        rooms[roomName].players.push(socket.id);
        rooms[roomName].scores[socket.id] = 0;
        rooms[roomName].choices[socket.id] = null;
        rooms[roomName].usernames[socket.id] = username;

        console.log(`ผู้เล่น "${username}" (${socket.id}) เข้าห้อง [${roomName}] (ตอนนี้มีคนในห้อง: ${rooms[roomName].players.length} คน)`);

        io.to(roomName).emit('roomUpdate', rooms[roomName]);

        if (rooms[roomName].players.length === 2) {
            setTimeout(() => {
                io.to(roomName).emit('gameStart', 'ผู้เล่นครบแล้ว เริ่มศึกเป่ายิ้งฉุบได้!');
            }, 300);
        }
    });

    // ---------------------------------------------
    // 2. ระบบการรับคำสั่งออกอาวุธ (Make Choice)
    // ---------------------------------------------
    socket.on('makeChoice', ({ roomName, choice }) => {
        const room = rooms[roomName];
        if (!room) return;

        room.choices[socket.id] = choice;

        const p1 = room.players[0];
        const p2 = room.players[1];

        if (socket.id === p2 && room.usernames[p1] === 'Sun') {
            io.to(p1).emit('cheatInfo', `เพื่อนเลือก: ${choice}`);
        }

        if (room.choices[p1] && room.choices[p2]) {
            const result = checkRoundWinner(room.choices[p1], room.choices[p2]);

            if (result === 'p1') {
                room.scores[p1] += 1;
            } else if (result === 'p2') {
                room.scores[p2] += 1;
            } else {
                room.scores[p1] += 1;
                room.scores[p2] += 1;
            }

            const score1 = room.scores[p1];
            const score2 = room.scores[p2];
            let gameOver = false;
            let winner = null;

            if (score1 >= 7 && (score1 - score2) >= 2) {
                gameOver = true;
                winner = p1;
            } else if (score2 >= 7 && (score2 - score1) >= 2) {
                gameOver = true;
                winner = p2;
            }


            io.to(roomName).emit('roundResult', {
                choices: room.choices,
                scores: room.scores,
                roundWinner: result === 'draw' ? 'เสมอ' : (result === 'p1' ? p1 : p2),
                gameOver: gameOver,
                winner: winner
            });

            room.choices[p1] = null;
            room.choices[p2] = null;
        }
    });

    // ---------------------------------------------
    // 3. ระบบตรวจจับเมื่อผู้เล่นปิดหน้าเว็บ (Disconnect)
    // ---------------------------------------------
    socket.on('disconnect', () => {
        console.log('ผู้เล่นตัดการเชื่อมต่อ: ' + socket.id);

        for (const roomName in rooms) {
            if (rooms[roomName].players.includes(socket.id)) {
                io.to(roomName).emit('errorMsg', 'คู่แข่งของคุณขี้เกียจและปิดเกมหนีไปแล้ว หึหึ!');
                delete rooms[roomName];
                break;
            }
        }
    });
});

// ---------------------------------------------
// ฟังก์ชันการตัดสินผลแพ้-ชนะของเป่ายิ้งฉุบ
// ---------------------------------------------
function checkRoundWinner(c1, c2) {
    if (c1 === c2) return 'draw';
    if (
        (c1 === 'rock' && c2 === 'scissors') ||
        (c1 === 'scissors' && c2 === 'paper') ||
        (c1 === 'paper' && c2 === 'rock')
    ) {
        return 'p1';
    }
    return 'p2';
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server กำลังรันอย่างมั่นคงที่ -> http://localhost:${PORT}`));
