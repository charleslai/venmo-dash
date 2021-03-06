module.exports = function(app, request, async, passport, cron) {

    app.get('/', isLoggedIn, function(req, res) {
        res.sendfile('public/pages/app.html');
    });

    app.get('/login', function(req, res) {
        res.sendfile('public/pages/login.html');
    });

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/auth/venmo', passport.authenticate('venmo', { scope: [
        'make_payments',
        'access_payment_history',
        'access_feed',
        'access_profile',
        'access_email',
        'access_phone',
        'access_balance',
        'access_friends'
    ]}));

    app.get('/auth/venmo/callback',
        passport.authenticate('venmo', { failureRedirect: '/login'}),
        function(req, res) {
            res.redirect('/');    
    });

    app.get('/friends', isLoggedIn, function(req, res) {
        getFriendsList(req.user.uid, req.user.access_token, function(error, friendsList) {
            getPayHistoryFriendsList(req.user.access_token, friendsList, function(error, newFriendsList) {
                res.send(newFriendsList);
            });
        });
    });

    app.get('/profile', isLoggedIn, function(req, res) {
        payHistory(req.user.access_token, req.user.username, function(error, data) {
            var user = req.user;
            var profileData = {
                profile: user,
                graph: data
            };
            res.send(profileData);
        });
    });

    app.post('/payment', isLoggedIn, function(req, res) {
        var body = req.body;
        console.log("PAYMENT BODY="+JSON.stringify(req.body));
        var user_id = body.user_id;
        var note = body.note; 
        var amount= body.amount;
        var date = body.date;
        var time = body.time; //assume time in hh:mm:ss
        var social = body.social ? 'public' : 'private';

        if (!date) {
            pay(req.user.access_token, user_id, note, amount, social);  
            res.status(200).send('{}');
        } else {  
            // Parse date to create date object
            var datearr = date.split("-");
            var timearr = time.split(":");
            var dateobj = new Date(datearr[0], datearr[1], datearr[2], timearr[0], timearr[1], timearr[2]);
            cron.scheduleJob(dateobj, function(){
                pay(req.user.access_token, user_id, note, amount, social); 
            });
            res.status(200).send('{}');
        }
    });

    app.post('/recurrence', isLoggedIn, function(req, res) {
        var body = req.body;
        console.log("PAYMENT BODY="+JSON.stringify(req.body));
        var user_id = body.user_id;
        var note = body.note;
        var amount= body.amount;
        var date = body.date;
        var time = body.time; //assume time in hh:mm:ss
        var social = body.social ? 'public' : 'private';

        if (!date) {
            pay(req.user.access_token, user_id, note, amount, social);
            res.status(200).send('{}');
        } else {
            // Parse date to create date object
            var datearr = date.split("-");
            var timearr = time.split(":");
            var rule = new cron.RecurrenceRule();
            rule.month = int(timearr[1])-1;
            rule.hour = int(timearr[0]);
            rule.minute = int(timearr[1]);
            rule.second = int(timearr[2]);
            cron.scheduleJob(dateobj, function(){
                pay(req.user.access_token, user_id, note, amount, social);
            });
            res.status(200).send('{}');
        }
    });

    function pay(userToken, user_id, note, amount, social) {
        var venmoUrl = 'https://api.venmo.com/v1/payments?access_token='+userToken+'&user_id='+user_id+'&note='+note+'&amount='+amount+'&audience='+social; 

        var options = {
            url: venmoUrl
        };
        console.log("Payment URL "+venmoUrl);
        request.post(options, function(error, response, body) {
            if (!error) {
                console.log(response);
                console.log("PAYMENT CREATED");
                console.log(body);
            };
        });
    };


    function getFriendsList(userId, userToken, callback) {
        var venmoUrl = 'https://api.venmo.com/v1/users/'+userId+'/friends?access_token='+userToken+'&limit=300'; 
        var options = {
            url: venmoUrl
        };
        console.log("venmoUrl="+venmoUrl);
        console.log("User Token="+userToken);
        
        request.get(options, function(error, response, body) {
            if (!error) {
                //console.log("BODY= "+body);
                var bodyData = JSON.parse(body);
                console.log("WE AMDE IT TO THE REQ "+bodyData);
                callback(error, bodyData);
            }
        });
    };

    function getPayHistoryFriendsList(userToken, friendsList, callback) {
        var venmoUrl ='https://api.venmo.com/v1/payments?access_token='+userToken+'&limit=1000';
        var options = {
            url: venmoUrl
        };
        var newFriendsList = [];
        
        request.get(options, function(error, response, body) {
            if(!error) {
                var bodyData = JSON.parse(body);
                for(var i in friendsList.data) {
                    var friendPayed = 0;
                    var friendCharged = 0;
                    var friend = friendsList.data[i];
                    console.log("FRIEND= "+ JSON.stringify(friend));
                    console.log("FRIEND USERNAME= "+friend.username);
                    for (var z in bodyData.data) {
                        if(bodyData.data[z].status === "settled" || bodyData.data[z].status === "pending") {
                            if (bodyData.data[z].action === "pay") {
                                if (bodyData.data[z].target.user.username === friend.username) {
                                    friendCharged += bodyData.data[z].amount;
                                } else if (bodyData.data[z].actor.username === friend.username) {
                                    friendPayed += bodyData.data[z].amount;
                                }
                            } else if (bodyData.data[z].action === "charge") {
                                if (bodyData.data[z].target.user.username === friend.username) {
                                    friendPayed += bodyData.data[z].amount;
                                } else if (bodyData.data[z].actor.username === friend.username) {
                                    friendCharged += bodyData.data[z].amount;
                                }
                            } 
                        }
                    }
                    var friend = {
                        profile: friend,
                        graph: {
                            payed: friendPayed,
                            charged: friendCharged,
                            payedPercent: friendPayed / (friendCharged + friendPayed) * 100,
                            chargedPercent: friendCharged / (friendCharged + friendPayed) * 100
                        }
                    };
                    newFriendsList.push(friend);
                }
                callback(error, newFriendsList);
            }
        });
    };

    function payHistory(userToken, username, callback) {
        var venmoUrl ='https://api.venmo.com/v1/payments?access_token='+userToken+'&limit=1000';
        var options = {
            url: venmoUrl
        };
        var charged = 0;
        var payed = 0;
        
        console.log("URL: "+venmoUrl);
        console.log("Before request to payment"); 
        request.get(options, function(error, response, body) {
            if (!error) {
                var bodyData = JSON.parse(body);
                console.log("BODY COUNT="+bodyData.data.count);
                for(var i in bodyData.data) {
                    if(bodyData.data[i].status === "settled" || bodyData.data[i].status === "pending") {
                        if (bodyData.data[i].action === "pay") {
                            if (bodyData.data[i].actor.username != username) {
                                charged += bodyData.data[i].amount;
                            } else {
                                payed += bodyData.data[i].amount;
                            }
                        } else if (bodyData.data[i].action === "charge") {
                            if (bodyData.data[i].actor.username != username) {
                                payed += bodyData.data[i].amount;
                            } else {
                                charged += bodyData.data[i].amount;
                            }
                        } 
                    }
                }
                var results = {
                    charged: charged,
                    payed: payed
                };
                callback(error, results);
            }
        });
    };
    
    function isLoggedIn(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/login');
    };
};
