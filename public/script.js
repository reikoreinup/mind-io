$(document).ready(function () {
    var socket = io.connect();
    var strings = [
        " got ahead of themselves.",
        " is too eager for this game.",
        " was too fast for the rest.",
        " misclicked, probably...",
        " is trying to sabotage you!",
        " doesn't have a strong grasp on numbers yet.",
        ", hold your horses!"];
    var username;
    var currentRoom;
    var round = 1;
    var lives = 4;

    // $("#userForm").validate({
    //     rules: {
    //         username: {
    //             required: true,
    //             minlength: 2
    //         },
    //         password: {
    //             required: true,
    //             minlength: 8
    //         }
    //     }
    // });

    $("#userForm").submit(function (e) {
        if ($('#password').val() === '' || $('#username').val() === '') {
            e.preventDefault();
            alert("Fields can't be empty!");
        } else {
            e.preventDefault();
            username = $("#username").val();
            socket.emit("new user", {username: username, password: $('#password').val()});
        }
    });


    $("#joinGameForm").submit(function (e) {
        if ($('#roomID').val() === '') {
            e.preventDefault();
            alert("RoomID can't be empty!");
        } else {
            e.preventDefault();
            socket.emit("join room", $("#roomID").val());
        }
    });

    $("#startGameButton").click(function (e) {
        e.preventDefault();
        round = 1;
        lives = 4;
        socket.emit("round started", {round: round, lives: lives, room: currentRoom})
    });

    $("#leaveRoomButton").click(function (e) {
        e.preventDefault();
        socket.emit("leave room", currentRoom);
        $("#chooseActionArea").show();
        $("#waitingArea").hide();
    });

    $("#backToLoginButton").click(function (e) {
        e.preventDefault();
        socket.emit("remove user", username);
        $("#username").val("");
        $("#password").val("");
        $("#chooseActionArea").hide();
        $("#loginArea").show();
    });

    $(".yourNumbers").on("click", ".number", function(e){
        let clickedNumber = $(e.target).text();
        socket.emit("clicked number", {room: currentRoom, number: clickedNumber})
    });

    $("#restartRoundButton").click(function (e) {
        e.preventDefault();
        socket.emit("hide overlay", currentRoom);
        socket.emit("round started", {round: round, lives: lives, room: currentRoom})

    });

    $("#returnToLobbyButton").click(function (e) {
        e.preventDefault();
        socket.emit("hide overlay", currentRoom);
        socket.emit("clear game data", currentRoom);
        socket.emit("join room", currentRoom);

    });

    $("#nextRoundButton").click(function (e) {
        e.preventDefault();
        socket.emit("hide overlay", currentRoom);
        if (round % 2 === 0) {
            lives++;
        }
        round++;
        socket.emit("round started", {round: round, lives: lives, room: currentRoom})
    });



    socket.on("new user", data => {
        if (data) {
            $("#loginArea").hide();
            $("#chooseActionArea").show();
        } else {
            alert("Username and password do not match!")
        }
    });

    socket.on("join room", function (data) {
        let room = data.room;
        let successful = data.roomAvailable;
        let numClients = data.numClients;

        if (successful) {
            currentRoom = room;
            $("#chooseActionArea").hide();
            $("#waitingArea").show();
            console.log(currentRoom);
            $("#roomName").html("Room name: " + currentRoom);
        } else {
            alert("Can't join this room. Game in progress")
        }
    });

    socket.on("user joined", function (usernames) {
        let content = "";
        $("#gameArea").hide();
        $("#waitingArea").show();
        for (let i = 0; i < usernames.length; i++) {
            content += "<li class='list-group-item'>" + usernames[i] + "</li>"
        }
        $("#users").html(content);
    });


    socket.on("round started", function (data) {
        let myNumbers = data.numbers;
        lives = data.lives;
        round = data.round;
        let players = data.players;


        let myNumbersContent = "";
        let othersNamesContent = "";
        let othersCardsContent = "";
        $("#lastCard").html("");

        $("#waitingArea").hide();
        $("#gameArea").show();
        $("#currentCard").html("--").css("background-color", "white");
        for (let i = 0; i < myNumbers.length; i++) {
            myNumbersContent += "<span class='number p-1 m-1'>" + myNumbers[i] + "</span>";
        }

        for (let i = 0; i < players.length; i++) {
            if (players[i] !== username) {
                let cardEmoji = "🎴";
                othersNamesContent += "<th>" + players[i] + "</th>";
                othersCardsContent += "<td>" + cardEmoji.repeat(round)+ "</td>";
            }
        }

        $("#roundInfo").html(`Lives: ${lives}\nRound: ${round}`);
        $(".yourNumbers").html(myNumbersContent);
        $("#amountOfCards").html(othersCardsContent);
        $("#userNames").html(othersNamesContent);

    });

    socket.on("clicked number", function (data) {
        let number = data.number;
        let username = data.username;
        let correct = data.correct;
        let $currentCard = $("#currentCard");

        $("#lastCard").html(username + ":");
        $currentCard.html(number);
        removeCardIconByName(username);
        if (correct) {
            console.log(username + ": " + number + " -> correct number")
        } else {
            console.log(username + ": " + number + " -> wrong number");
            $currentCard.css("background-color", "red" );
        }

    });


    socket.on("remove from hand", function (number) {
        $(".yourNumbers").children("span").each(function () {
            if (number === $(this).text()) {
                $(this).remove()
            }
        });
    });

    socket.on("retry", function (data) {
        let username = data.username;
        lives = data.lives;
        $("#overlay").show();
        $("#text").html(username + strings[Math.floor(Math.random()*strings.length)]);
    });

    socket.on("hide overlay", function () {
        $("#overlay").hide();
        $("#endOverlay").hide();
        $("#nextRoundOverlay").hide();
    });

    socket.on("game over", function (username) {
        $("#endOverlay").show();
        $("#textFinal").html(username + strings[Math.floor(Math.random()*strings.length)] +
        `\nYou reached round ${round}.`);

    });

    socket.on("next round", function () {
        $("#nextRoundOverlay").show();
        if (round % 2 === 0) {
            $("#textNextRound").html("You passed this round! Have an extra life for the effort.");
        } else {
            $("#textNextRound").html("You passed this round!");
        }
    });

    function removeCardIconByName(username) {

    }

});