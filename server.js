const express = require("express");
const cors = require('cors');
const app = express();
const dotenv = require('dotenv');
const server = require("http").createServer(app);
const io = require("socket.io").listen(server);

app.use(cors);
app.use(express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/public'));

users = [];
connections = [];
badRooms = [];
gameData = {};

const port = 6969;
server.listen(process.env.PORT || port);
console.log("Server is running on port " + port);

app.get('/', function (req, res) {
    res.sendFile(__dirname + "public/index.html")
});

io.sockets.on('connection', function (socket) {
    connections.push(socket);
    console.log("connected: %s sockets connected", connections.length);

    socket.on('disconnect', function (data) {

        users.splice(users.indexOf(socket.username), 1);

        connections.splice(connections.indexOf(socket), 1);
        console.log("disconnected: %s sockets connected", connections.length);
    });

    socket.on('new user', function (data) {
        if (!users.includes(data)) {
            socket.username = data;
            users.push(socket.username);
            socket.emit("new user", true)
        } else {
            socket.emit("new user", false)
        }

    });

    socket.on('join room', function (room) {
        if (!Object.keys(gameData).includes(room)) {
            socket.join(room);
            let usernamesInRoom = getUsersInRoom(room);
            socket.emit('join room', {room: room, roomAvailable: true});
            io.to(room).emit('user joined', usernamesInRoom);
        } else {
            socket.emit('join room', {room: room, roomAvailable: false});
        }
    });

    socket.on('game started', function (currentRoom) {

        io.to(currentRoom).emit('game started');
    });

    socket.on('round started', function (data) {
        let round = data.round;
        let room = data.room;
        let lives = data.lives;


        let clients = io.sockets.adapter.rooms[room].sockets;
        let numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

        let numbers = dealNumbers(round, numClients);
        gameData[room] = {currentNumbers: flatten(numbers), lives: lives};
        console.log(gameData);
        console.log(numbers);
        console.log("round: " + round + "\nplayers: " + numClients);
        let i = 0;

        for (let clientId in clients) {
            let clientSocket = io.sockets.connected[clientId];
            clientSocket.emit('round started', {numbers: numbers[i], lives: lives, round: round, players: getUsersInRoom(room)});
            i++;
        }

    });

    socket.on('clicked number', function (data) {
        let room = data.room;
        let number = data.number;
        let username = socket.username;

        if (isSmallest(number, room)) {
            io.to(room).emit('clicked number', {number: number, username: username, correct: true});
            gameData[room]["currentNumbers"].splice(gameData[room]["currentNumbers"].indexOf(parseInt(number)), 1);
            if (gameData[room]["currentNumbers"].length === 0) {
                io.to(room).emit('next round');
            }
        } else {
            io.to(room).emit('clicked number', {number: number, username: username, correct: false});
            gameData[room].lives--;
            console.log('remaining lives: ' + gameData[room].lives);
            if (gameData[room].lives === 0) {
                io.to(room).emit('game over', username);
            } else {
                io.to(room).emit('retry', {username: username, lives: gameData[room].lives})
            }
        }
        socket.emit('remove from hand', number);

    });


    socket.on('hide overlay', function (room) {
        io.to(room).emit('hide overlay');
    });

    socket.on('clear game data', function (room) {
        delete gameData[room];
    });

    socket.on('remove user', function (username) {
        users.splice(users.indexOf(username), 1);
    });

    socket.on('leave room', function (room) {
        socket.leave(room);
        io.to(room).emit('user joined', getUsersInRoom(room));
    })


});

function isSmallest(number, room) {
    let numbers = gameData[room]["currentNumbers"];
    let minNumber = Math.min(...numbers);
    console.log("Clicked: " + number + "\nMinNumber: " + minNumber);
    return minNumber === parseInt(number);

}

function dealNumbers(round, amountOfPlayers) {
    let allNumbers = [];
    let result = [];
    for (let i = 0; i < round * amountOfPlayers; i++) {
        let num = Math.floor(Math.random() * 100) + 1;
        while (allNumbers.includes(num)) {
            num = Math.floor(Math.random() * 100) + 1;
        }
        allNumbers.push(num);
    }
    for (let i = 0; i < allNumbers.length; i += round) {
        result.push(allNumbers.slice(i, i + round))
    }

    return result;


}

function getUsersInRoom(room) {
    try {
        let clients = io.sockets.adapter.rooms[room].sockets;
        let usernamesInRoom = [];
        for (let clientID in clients) {
            usernamesInRoom.push(io.sockets.connected[clientID].username);
        }
        return usernamesInRoom;
    } catch (TypeError) {
        return [];
    }
}

function flatten(arr) {
    return [].concat(...arr)
}

