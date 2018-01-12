require('nativescript-websockets');
var http = require("http");
var textView = require('ui/text-view');
var textField = require('ui/text-field');
var label = require('ui/label');
var button = require('ui/button');
var image = require('ui/image');
var absoluteLayout = require('ui/layouts/absolute-layout');
var stackLayout = require('ui/layouts/stack-layout');
var gridLayout = require('ui/layouts/grid-layout');
var scrollView = require('ui/scroll-view');
var enums = require("ui/enums");
var styleProperties = require("ui/styling/style-properties");
var color = require('color');
var platform = require("platform")
var dialogs = require("ui/dialogs");

var username, ws, page, modalContainer, leftContainer, rightContainer, logContainer, chatContainer, chatInputField;

exports.sendChat = function (args) {
    if (ws == null) return;
    ws.send("chat:" + username + ":" + chatInputField.text);
    chatInputField.text = "";
    chatContainer.parent.scrollToVerticalOffset(chatContainer.parent.scrollableHeight, false);
};

exports.pageLoaded = function (args) {
    page = args.object;

    resize(page.getViewById("absoluteLayout"), 1, 1);
    resize(page.getViewById("slackLayout"), 1, 1);

    leftContainer = page.getViewById("leftStackLayout");
    resize(leftContainer.parent, 0.8, 1);
    absoluteReposition(leftContainer.parent, -0.8, 0);
    leftContainer.parent.style.backgroundColor = new color.Color("White");

    rightContainer = page.getViewById("rightStackLayout");
    resize(rightContainer.parent, 0.8, 1);
    absoluteReposition(rightContainer.parent, 1, 0);
    rightContainer.parent.style.backgroundColor = new color.Color("White");

    modalContainer = page.getViewById("modalLayout");
    resize(modalContainer.parent, 0.8, 0.8);
    resize(modalContainer, 0.8, 0.8);
    absoluteReposition(modalContainer.parent, 0.1, -1.8);
    modalContainer.parent.style.backgroundColor = new color.Color("White");

    logContainer = page.getViewById("logContainer");
    resize(logContainer.parent, 0.8, 0.4);

    chatContainer = page.getViewById("chatContainer");
    resize(chatContainer.parent, 0.8, 0.4 + 0.1 / 2);

    chatInputField = page.getViewById("chatInputField");
    resize(chatInputField, 0.8, 0.1 / 2);
};

exports.join = function () {
    var admin = false;
    var gameStarted = false;
    var thegamename;

    username = page.getViewById("username").text;
    var gamename = page.getViewById("gamename").text;
    var password = page.getViewById("password").text;

    var layout = page.getViewById("slackLayout");
    clearLayout(layout);
    page._removeView(page.getViewById("actionBar"));

    var titleField = new textView.TextView();
    layout.addChild(titleField);

    var messageField = new textView.TextView();
    layout.addChild(messageField);

    ws = new WebSocket("ws://192.168.1.3:8181");

    ws.addEventListener('open', function (evt) {
        messageField.text = "connection open";
        ws.send("new:" + username + ":" + gamename + ":" + password);
    });

    ws.addEventListener('close', function (evt) {
        messageField.text = "connection closed";
    });

    ws.addEventListener('message', function (evt) {
        var message = evt.data;

        if (!gameStarted) {
            if (message == "admin") {
                admin = true;

                var loadingLabel = new label.Label();
                loadingLabel.text = "Loading games...";
                layout.addChild(loadingLabel);

                http.request({
                    url: "http://192.168.1.3:5000/ContentCreator/GetGames",
                    method: "POST"
                }).then(function (response) {
                    layout._removeView(loadingLabel);

                    var allGames = response.content.toString();
                    allGames.substring(0, allGames.length - 1);

                    games = allGames.split(":");

                    for (let i = 0; i < games.length; i++) {
                        if (games[i] == "") continue;
                        var btn = new button.Button();
                        btn.text = games[i];
                        btn.on(button.Button.tapEvent, function (eventData) {
                            ws.send('start:' + this.text);
                        }, btn);
                        layout.addChild(btn);
                    }

                }, function (e) {});
            } else if (message == "wrong-password") {
                messageField.text = "wrong password";
            } else if (message == "username-taken") {
                messageField.text = "username taken";
            } else if (message == "start") {
                clearLayout(layout);
                ws.send("ready");
                gameStarted = true;

                addContainerOpeners(page.getViewById("topStackLayout"), leftContainer, rightContainer);

                moneyContainer = new label.Label();
                moneyContainer.text = "Money: ";
                leftContainer.addChild(moneyContainer);
            } else {
                messageField.text = message;
                titleField.text = "Waiting for all players to join.";
            }
            return;
        }

        if (message == "ready") {
            ws.send("ready");
        } else if (message.startsWith("item:")) {
            clearLayout(modalContainer);

            var msg = message.substring(2 + message.split(":")[1].length + message.split(":")[0].length);

            var modalTitleField = new textView.TextView();
            modalTitleField.text = message.split(":")[1];
            modalContainer.addChild(modalTitleField);

            var modalMessageField = new textView.TextView();

            if (msg.indexOf("IMG(") != -1) {
                var img = new image.Image();
                img.src = msg.substring(msg.indexOf("IMG(") + 4, msg.indexOf(") "))
                img.height = 400 + "px";
                modalContainer.addChild(img);
                modalMessageField.text = msg.replace(msg.substring(msg.indexOf("IMG("), msg.indexOf(") ") + 1), "");
            } else
                modalMessageField.text = msg;
            modalContainer.addChild(modalMessageField);

            var btn = new button.Button();
            btn.text = "Continue";

            btn.on(button.Button.tapEvent, function (eventData) {
                ws.send("item:" + message.split(":")[1]);
            }, btn);
            modalContainer.addChild(btn);

            if (msg.startsWith("@Choice")) {
                clearLayout(modalContainer);
                modalContainer.addChild(modalTitleField);

                var title = msg.split("\n")[0].split("->")[1].trim();
                var choices = [];

                for (let i = 1; i < msg.split("\n").length; i++) {
                    choices.push({
                        n: parseInt(msg.split("\n")[i].split("->")[0].replace("@C", "").trim()),
                        text: msg.split("\n")[i].split("->")[1].split(";")[0].trim(),
                        action: msg.split("\n")[i].substring(msg.split("\n")[i].indexOf(";") + 1).trim()
                    });
                }

                if (title.indexOf("IMG(") != -1) {
                    var img = new image.Image();
                    img.src = title.substring(title.indexOf("IMG(") + 4, title.indexOf(") "));
                    img.height = 400 + "px";
                    modalContainer.addChild(img);
                    modalMessageField.text = title.replace(title.substring(title.indexOf("IMG("), title.indexOf(") ") + 1), "");
                } else
                    modalMessageField.text = title;

                modalContainer.addChild(modalMessageField);

                for (i in choices) {
                    var btn = new button.Button();
                    btn.text = choices[i].text;
                    btn.id = i + "";

                    btn.on(button.Button.tapEvent, function (eventData) {
                        ws.send("item:" + message.split(":")[1] + ":" + choices[parseInt(this.id)].action);
                    }, btn);
                    modalContainer.addChild(btn);
                }
            }

            absoluteReposition(modalContainer.parent, 0.1, 0.1);
            if (message.split(":")[2].trim() == "@End") {
                clearLayout(modalContainer);
                absoluteReposition(modalContainer.parent, 0.1, -1.8);
            }
        } else if (message.startsWith("chat:")) {
            var sender = message.split(":")[1].trim();
            var sentMessage = message.substring(sender.length + 6);

            var chatMessage = new label.Label();
            chatMessage.text = "[" + sender + "] " + sentMessage;
            chatContainer.addChild(chatMessage);
            chatContainer.parent.scrollToVerticalOffset(chatContainer.parent.scrollableHeight, false);
        } else {
            var game = JSON.parse(message);

            var t = parseInt(game["Turn"]) % Object.keys(game["Players"]).length;
            var playingUsername = game["Players"][Object.keys(game["Players"])[t]]["Username"];

            var childCount = 0;
            logContainer.eachChildView((v) => childCount++);

            for (let i = childCount; i < game["Log"].length; i++) {
                var logMessage = new label.Label();
                logMessage.text = game["Log"][i].substring(game["Log"][i].indexOf("]") + 1);
                logContainer.addChild(logMessage);
            }
            logContainer.parent.scrollToVerticalOffset(logContainer.parent.scrollableHeight, false);

            var log = "";
            for (let i = 0; i < Object.keys(game["Players"]).length; i++)
                log += Object.keys(game["Players"])[i] + ": " + game["Players"][Object.keys(game["Players"])[i]]["Space"] + "\n";

            // set player to log

            clearLayout(leftContainer);
            addContainerOpeners(null, leftContainer, null);
            moneyContainer.text = "Money: " + game["Players"][username]["Money"];
            leftContainer.addChild(moneyContainer);

            for (let i = 0; i < game["Players"][username]["Items"].length; i++) {
                var btn = new button.Button();
                btn.text = game["Players"][username]["Items"][i]["Name"];
                btn.id = i + "";

                btn.on(button.Button.tapEvent, function (eventData) {
                    ws.send("item:" + game["Players"][username]["Items"][parseInt(this.id)]["Name"]);
                }, btn);

                leftContainer.addChild(btn);
            }

            messageField = new textView.TextView();
            clearLayout(layout);

            if (game["Scene"] == "end") {

            } else if (game["Scene"] == "roll") {
                var img = new image.Image();
                img.src = "https://i.imgur.com/F3LImXW.png";
                layout.addChild(img);

                var btn = new button.Button();
                btn.text = "Roll";
                layout.addChild(btn);

                if (playingUsername == username) {
                    btn.on(button.Button.tapEvent, function (eventData) {
                        ws.send("roll");
                    }, btn);
                }

            } else if (game["Scene"] == "choice") {
                var img = new image.Image();
                layout.addChild(img);
                layout.addChild(messageField);
                var title = game["Message"].split("\n")[0].split("->")[1].trim();
                var choices = [];

                for (let i = 1; i < game["Message"].split("\n").length; i++) {
                    choices.push({
                        n: parseInt(game["Message"].split("\n")[i].split("->")[0].replace("@C", "").trim()),
                        text: game["Message"].split("\n")[i].split("->")[1].split(";")[0].trim(),
                        action: game["Message"].split("\n")[i].substring(game["Message"].split("\n")[i].indexOf(";") + 1).trim()
                    });
                }

                img.src = title.substring(title.indexOf("IMG(") + 4, title.indexOf(") "));
                messageField.text = title.replace(title.substring(title.indexOf("IMG("), title.indexOf(") ") + 1), "");

                for (i in choices) {
                    var btn = new button.Button();
                    btn.text = choices[i].text;

                    if (playingUsername == username) {
                        btn.id = i + "";
                        btn.on(button.Button.tapEvent, function (eventData) {
                            ws.send("move:" + choices[parseInt(this.id)].action);
                        }, btn);
                    }

                    layout.addChild(btn);
                }
            } else if (game["Scene"] == "shop") {
                layout.addChild(messageField);

                var title = game["Message"];
                var items = [];

                for (let i = 0; i < Object.keys(game["Players"][playingUsername]["CurrentEvent"]["Items"]).length; i++) {
                    items.push({
                        name: Object.keys(game["Players"][playingUsername]["CurrentEvent"]["Items"])[i],
                        description: game["Players"][playingUsername]["CurrentEvent"]["Items"][Object.keys(game["Players"][playingUsername]["CurrentEvent"]["Items"])[i]][0]["Description"],
                        price: parseFloat(game["Players"][playingUsername]["CurrentEvent"]["Items"][Object.keys(game["Players"][playingUsername]["CurrentEvent"]["Items"])[i]][1])
                    });
                }

                messageField.text = title;

                for (i in items) {
                    var btn = new button.Button();
                    btn.id = i;

                    i = parseInt(i);
                    btn.text = items[i].name + " <i>(Cost: " + items[i].price + ")</i>";

                    if (playingUsername == username && items[i].price <= parseFloat(game["Players"][username]["Money"])) {
                        btn.on(button.Button.tapEvent, function (eventData) {
                            ws.send("move:" + "@Buy -> " + items[parseInt(this.id)].name);
                        }, btn);
                    }
                    layout.addChild(btn);
                }

                var btn = new button.Button();
                btn.text = "Cancel";
                layout.addChild(btn);

                if (playingUsername == username) {
                    btn.on(button.Button.tapEvent, function (eventData) {
                        ws.send("move");
                    }, btn);
                }
            } else if (game["Scene"] == "rolled") {
                layout.addChild(messageField);
                messageField.text = "You rolled " + game["LastRoll"] + ".";

                var btn = new button.Button();
                btn.text = "Move";
                layout.addChild(btn);

                if (playingUsername == username) {
                    btn.on(button.Button.tapEvent, function (eventData) {
                        ws.send("move");
                    }, btn);
                }
            } else if (game["Scene"] == "event") {
                var img = new image.Image();
                layout.addChild(img);
                layout.addChild(messageField);

                var btn = new button.Button();
                btn.text = "Continue";
                layout.addChild(btn);

                if (game["Message"].indexOf("IMG(") != -1) {
                    img.src = game["Message"].substring(game["Message"].indexOf("IMG(") + 4, game["Message"].indexOf(") "));
                    messageField.text = game["Message"].replace(game["Message"].substring(game["Message"].indexOf("IMG("), game["Message"].indexOf(") ") + 1), "");
                } else
                    messageField.text = game["Message"];

                if (playingUsername == username) {
                    btn.on(button.Button.tapEvent, function (eventData) {
                        ws.send("move");
                    }, btn);
                }
            }
        }
    });
};

var addContainerOpeners = function (main, left, right) {
    var leftLayout = page.getViewById("leftStackLayout");
    resize(leftLayout, 0.8, 1);
    var rightLayout = page.getViewById("rightStackLayout");
    resize(rightLayout, 0.8, 1);

    var leftOpener = new button.Button();
    leftOpener.text = "Items";

    resize(leftOpener, 0.5, null);

    var rightOpener = new button.Button();
    rightOpener.text = "Chat & Log";

    resize(rightOpener, 0.5, null);

    var close1 = new button.Button();
    var close2 = page.getViewById("closeButton");
    close1.text = "Close";
    close2.text = "Close";

    if (left != null)
        leftLayout.addChild(close1);

    if (main != null) {
        main.addChild(leftOpener);
        main.addChild(rightOpener);
    }

    leftOpener.on(button.Button.tapEvent, function (eventData) {
        if (styleProperties.PercentLength.toDevicePixels(rightLayout.parent.translateX) < platform.screen.mainScreen.widthPixels / 2)
            animateContainer(rightLayout.parent, 1);
        animateContainer(leftLayout.parent, 1);
    }, leftOpener);

    rightOpener.on(button.Button.tapEvent, function (eventData) {
        if (styleProperties.PercentLength.toDevicePixels(leftLayout.parent.translateX) > platform.screen.mainScreen.widthPixels / 2)
            animateContainer(leftLayout.parent, -1);
        animateContainer(rightLayout.parent, -1);
    }, rightOpener);

    close1.on(button.Button.tapEvent, function (eventData) {
        animateContainer(leftLayout.parent, -1);
    }, close1);
    close2.on(button.Button.tapEvent, function (eventData) {
        animateContainer(rightLayout.parent, 1);
    }, close2);
}

var animateContainer = function (view, _x) {
    view.animate({
        translate: {
            x: _x * view.width.value / 2.63,
            y: 0
        },
        duration: 1000,
        curve: enums.AnimationCurve.easeIn
    });
}

var clearLayout = function (layout) {
    layout.eachChildView(v => {
        if (v.parent != null)
            v.parent._removeView(v);
    });
};

var resize = function (view, width, height) {
    if (width != null)
        view.width = (platform.screen.mainScreen.widthPixels * width) + "px";
    if (height != null)
        view.height = (platform.screen.mainScreen.heightPixels * height) + "px";
};

var absoluteReposition = function (view, x, y) {
    if (x != null)
        absoluteLayout.AbsoluteLayout.setLeft(view, (platform.screen.mainScreen.widthPixels * x) + "px");
    if (y != null)
        absoluteLayout.AbsoluteLayout.setTop(view, (platform.screen.mainScreen.heightPixels * y) + "px");
};