const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io").listen(server);

app.use(express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/public'));

users = [];
connections = [];
socketUsername = {};
gameData = {};

const port = 80;
server.listen(process.env.PORT || port);
console.log("Server is running on port " + port);
const knex = require('knex')({
    client: 'pg',
    connection: {
        host: 'ec2-54-247-85-251.eu-west-1.compute.amazonaws.com',
        user: 'ruhvdzuuojglwa',
        password: '9ed3dea7f039090216c4106f450d62c3fad38b12388cf8b97ad0445d4d427224',
        database: 'd3o31f5iv71tmq',
        port: '5432',
        ssl: true
    }
});
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
        let username = data.username;
        let password = data.password;
        userExists(username).then((result) => {
            console.log("line 48, usernames:" + result);
            if (result.length === 1) {
                credentialsMatch(username, password).then((result) => {
                    if (result.length === 1) {
                        socket.username = username;
                        users.push(socket.username);
                        socketUsername[socket] = username;
                        socket.emit("new user", true);
                    } else {
                        socket.emit("new user", false);
                    }
                })

            } else {
                knex('users')
                    .insert({
                        username: username,
                        password: password
                    }).then((data) => console.log("userinfo insert successful"));
                socket.username = username;
                users.push(socket.username);
                socketUsername[socket] = username;
                socket.emit("new user", true);
            }

        })
            .catch((result) => console.log(result));
    });


    socket.on('join room', function (room) {
        roomExists(room).then(async (result) => {
            if (result.length === 1) {
                roomHasNoGameInProgress(room).then((result) => {
                    if (result.length === 1) {
                        addUserToUsersInGames(socket, room);
                        socket.join(room);
                        let usernamesInRoom = getUsersInRoom(room);
                        socket.emit('join room', {room: room, roomAvailable: true, numClients: usernamesInRoom.length});
                        io.to(room).emit('user joined', usernamesInRoom);
                    } else {
                        socket.emit('join room', {room: room, roomAvailable: false});
                    }
                });
            } else {

                knex('games')
                    .insert({
                        roomname: room,
                        round: 1,
                        lives: 4,
                        inprogress: false
                    }).then((data) => console.log("roominfo insert successful"));

                addUserToUsersInGames(socket, room);
                socket.join(room);
                let usernamesInRoom = getUsersInRoom(room);
                socket.emit('join room', {room: room, roomAvailable: true, numClients: usernamesInRoom.length});
                io.to(room).emit('user joined', usernamesInRoom);
            }
        });
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
            clientSocket.emit('round started', {
                numbers: numbers[i],
                lives: lives,
                round: round,
                players: getUsersInRoom(room)
            });
            i++;
        }

    });

    socket.on('clicked number', function (data) {
        let room = data.room;
        let number = data.number;
        let username = socket.username;

        if (isSmallest(number, room)) {
            io.to(room).emit('clicked number', {
                number: number,
                username: username,
                correct: true,
                numClients: getUsersInRoom(room).length,
                cardsLeft: gameData[room]["currentNumbers"].length - 1
            });
            gameData[room]["currentNumbers"].splice(gameData[room]["currentNumbers"].indexOf(parseInt(number)), 1);
            if (gameData[room]["currentNumbers"].length === 0) {
                io.to(room).emit('next round');
            }
        } else {
            io.to(room).emit('clicked number', {
                number: number,
                username: username,
                correct: false,
                numClients: getUsersInRoom(room).length
            });
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

function userExists(username) {
    return new Promise(function (resolve, reject) {
        resolve(knex
            .select("username")
            .from("users")
            .where("username", username));
        reject("couldn't resolve promise")
    })

}

function credentialsMatch(username, password) {
    return new Promise(function (resolve) {
        resolve(knex
            .select("username", "password")
            .from("users")
            .where("username", username)
            .andWhere("password", password));
    })
}

function roomHasNoGameInProgress(room) {
    return new Promise(function (resolve, reject) {
        resolve(knex
            .select("*")
            .from("games")
            .where("roomname", room)
            .andWhere("inprogress", false));

        reject("could not resolve promise");
    })
}

function roomExists(room) {
    return new Promise(function (resolve, reject) {
        resolve(knex
            .select("*")
            .from("games")
            .where("roomname", room));

        reject("could not resolve promise");
    })
}

function getGameIdByRoomName(roomname) {
    return new Promise(function (resolve, reject) {
        resolve(knex
            .select("game_id")
            .from("games")
            .where("roomname", roomname));
        reject("could not resolve promise");
    })
}

function getUserIdByUserName(username) {
    return new Promise(function (resolve, reject) {
        resolve(knex
            .select("users_id")
            .from("users")
            .where("username", username));
        reject("could not resolve promise");
    })
}

function addUserToUsersInGames(socket, room) {
    let user_id;
    let games_id;
    getUserIdByUserName(socket.username).then((id) => {
        user_id = id[0].users_id;
        getGameIdByRoomName(room).then((id) => {
            games_id = id[0].game_id;
            knex('users_in_games')
                .insert({
                    user_id: user_id,
                    games_id: games_id
                }).then((data) => console.log("users_in_games insert successful"))

        });
    });
}



