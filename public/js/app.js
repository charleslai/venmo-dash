$(document).ready(function() {

    var ProfileCard = Backbone.Model.extend({});

    var ProfileView = Backbone.View.extend({

        el: $('#card-grid'),

        tagName: 'div',

        template: '<div class="col l4 m6 s12"><div class="card-panel"><div class="row content"><div class="col s3 avatar"><img src="{{profile.profile_picture_url}}" alt="" class="circle responsive-img"></div><div class="col s9 info"><div class="username">{{profile.display_name}}</div><div class="progress"> <div class="progress-bar progress-bar-success" style="width: {{graph.payedPercent}}%"> <span class="sr-only">{{graph.payed}}</span> </div> <div class="progress-bar progress-bar-danger" style="width: {{graph.chargedPercent}}%"> <span class="sr-only">{{graph.charged}}</span> </div> </div><a class="modal-trigger waves-effect waves-light  btn light-blue lighten-3" href="#modal1">Details</a></div></div></div></div>',

        initialize: function() {
            this.render();
        },

        render: function() {
            this.$el.append((Mustache.render(this.template, this.model.toJSON())));
            return this;
        },

        hide: function() {
            this.$el.hide();
        },

        show: function() {
            this.$el.show();
        }

    });

    var MainView = Backbone.View.extend({

        el: $('#main-view-anchor'),

        template: '<div id="maincard" class="col s12"> <div class="card-panel"> <div class="row content"> <div class="col s3 avatar-div"> <img src="{{profile.venmo.profile_picture_url}}" alt="" class="avatar responsive-img"> </div> <div class="col s5 info"> <h3 class="username">{{profile.venmo.display_name}}</h3> <div class="email">{{profile.email}}</div> <div class="balance">Current Balance: <span class="green-font">{{profile.balance}}</span></div> <div class="graph">graph?</div> </div> <div class="col s4"> <div id="my-graph" class="ct-chart ct-perfect-fourth"></div> </div> </div> </div> </div>',

        initialize: function() {
            console.log(this.model);
            this.render();
            var graph_data = this.model.toJSON().graph;
            new Chartist.Pie('.ct-chart', {
            series: [graph_data.payed, graph_data.charged],
            labels: ["$"+graph_data.payed, "$"+graph_data.charged],
            }, {
                donut: true,
                donutWidth: 35,
            });
        },

        render: function() {
            // TODO MAKE THIS.MODEL.TOJSON()
            this.$el.append((Mustache.render(this.template, this.model.toJSON())));
            //var graph_data = this.model.toJSON().graph;
            return this;
        },

    });

    ProfileCollection = Backbone.Collection.extend({
        comparator: function(model) {
            // based on highest paid
        }
    });
 
    var profileCollection = new ProfileCollection();

    ProfileCollectionView = Backbone.View.extend({
        collection: null,

        render: function() {
            this.collection.forEach(function(item) {
                var view = new ProfileView({model: item});
            });
        }
    });


    $.ajax({
        type: "GET",
        url: "/profile"
    })
    .done(function(body) {
        console.log("BEFORE THE BODY");
        var MainCard = new ProfileCard(body);
        var MainCardView = new MainView({model: MainCard});
        // Update graph with graph data
        console.log(body);
        
        $.ajax({
            type: "GET",
            url: "/friends"
        })
        .done(function(body) {
            var data = body;
            console.log(body);
            for(var i in data) {
                var profileCard = new ProfileCard(data[i]);
                profileCollection.add(profileCard);
            }
            console.log(profileCollection);
            var profileCollectionView = new ProfileCollectionView({collection: profileCollection});
            profileCollectionView.render();
        })
        .fail(function() {
            console.log("FAILED");
        });
    })
    .fail(function() {
        console.log("PROFILE FAILED");
    });

});
