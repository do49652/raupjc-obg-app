require('nativescript-websockets');
var textView = require('ui/text-view');
var button = require('ui/button');
var image = require('ui/image');
var absoluteLayout = require('ui/layouts/absolute-layout');
var stackLayout = require('ui/layouts/stack-layout');
var gridLayout = require('ui/layouts/grid-layout');
var enums = require("ui/enums");
var styleProperties = require("ui/styling/style-properties");
var color = require('color');
var platform = require("platform")

var page, leftContainer, rightContainer;

exports.pageLoaded = function (args) {
    page = args.object;

    resize(page.getViewById("absoluteLayout"), 1, 1);
    resize(page.getViewById("slackLayout"), 1, 1);

    leftContainer = page.getViewById("leftContainer");
    resize(leftContainer, 0.8, 1);
    absoluteReposition(leftContainer, -0.8, 0);
    leftContainer.style.backgroundColor = new color.Color("LightGray");

    rightContainer = page.getViewById("rightContainer");
    resize(rightContainer, 0.8, 1);
    absoluteReposition(rightContainer, 1, 0);
    rightContainer.style.backgroundColor = new color.Color("Gray");

    //------------

    addContainerOpeners(page.getViewById("topStackLayout"), leftContainer, rightContainer);
};

exports.join = function () {
    var admin = false;
    var gameStarted = false;
    var thegamename;

    var username = page.getViewById("username").text;
    var gamename = page.getViewById("gamename").text;
    var password = page.getViewById("password").text;

    var layout = page.getViewById("slackLayout");
    clearLayout(layout);
    page._removeView(page.getViewById("actionBar"));

    var titleField = new textView.TextView();
    layout.addChild(titleField);

    var messageField = new textView.TextView();
    layout.addChild(messageField);

    var ws = new WebSocket("ws://192.168.1.3:8181");

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
                // game select
            } else if (message == "wrong-password") {
                messageField.text = "wrong password";
            } else if (message == "username-taken") {
                messageField.text = "username taken";
            } else if (message == "start") {
                clearLayout(layout);
                ws.send("ready");
                gameStarted = true;

                // show all views

                // set up chat
                // ws.send("chat:" + username + ":" + $('#chatInput').val());

            } else {
                if (!admin); // hide start button
                messageField.text = message;
                titleField.text = "Waiting for all players to join.";
            }
            return;
        }

        if (message == "ready") {
            ws.send("ready");
        } else if (message.startsWith("item:")) {
            var msg = message.substring(2 + message.split(":")[1].length + message.split(":")[0].length);

            // open modal

        } else if (message.startsWith("chat:")) {
            var sender = message.split(":")[1].trim();
            var sentMessage = message.substring(sender.length + 6);

            // append sentMessage to chat

        } else {
            var game = JSON.parse(message);

            var t = parseInt(game["Turn"]) % Object.keys(game["Players"]).length;
            var playingUsername = game["Players"][Object.keys(game["Players"])[t]]["Username"];

            var log = "";
            for (let i = 0; i < game["Log"].length; i++)
                log += game["Log"][i];

            // append log to log

            log = "";
            for (let i = 0; i < Object.keys(game["Players"]).length; i++)
                log += Object.keys(game["Players"])[i] + ": " + game["Players"][Object.keys(game["Players"])[i]]["Space"] + "\n";

            // set player to log

            log = "Money: " + game["Players"][username]["Money"];
            for (let i = 0; i < game["Players"][username]["Items"].length; i++)
                log += '<button class="btn btn-default" id="item' + (i + 1) + '">' + game["Players"][username]["Items"][i]["Name"] + "</button>";

            // money and items

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

                messageField.text = title; // IMG()

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

            for (let i = 0; i < game["Players"][username]["Items"].length; i++) {
                /*$("#item" + (i + 1)).off("click").click(function () {
                    ws.send("item:" + game["Players"][username]["Items"][i]["Name"]);
                });*/
            }
        }
    });
};

var addContainerOpeners = function (main, left, right) {
    var leftOpener = new button.Button();
    leftOpener.text = "Items & Chat";

    resize(leftOpener, 0.5, null);

    var rightOpener = new button.Button();
    rightOpener.text = "Log";

    resize(rightOpener, 0.5, null);

    main.addChild(leftOpener);
    main.addChild(rightOpener);

    leftOpener.on(button.Button.tapEvent, function (eventData) {
        left.animate({
            translate: {
                x: styleProperties.PercentLength.toDevicePixels(this.width) / 2,
                y: 0
            },
            duration: 1000,
            curve: enums.AnimationCurve.easeIn
        });

        if (styleProperties.PercentLength.toDevicePixels(right.translateX) < platform.screen.mainScreen.widthPixels / 2) {
            right.animate({
                translate: {
                    x: styleProperties.PercentLength.toDevicePixels(this.width) / 2,
                    y: 0
                },
                duration: 1000,
                curve: enums.AnimationCurve.easeIn
            });
        }
    }, leftOpener);

    rightOpener.on(button.Button.tapEvent, function (eventData) {
        right.animate({
            translate: {
                x: -styleProperties.PercentLength.toDevicePixels(this.width) / 2,
                y: 0
            },
            duration: 1000,
            curve: enums.AnimationCurve.easeIn
        });

        if (styleProperties.PercentLength.toDevicePixels(left.translateX) > platform.screen.mainScreen.widthPixels / 2) {
            left.animate({
                translate: {
                    x: -styleProperties.PercentLength.toDevicePixels(this.width) / 2,
                    y: 0
                },
                duration: 1000,
                curve: enums.AnimationCurve.easeIn
            });
        }
    }, rightOpener);

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