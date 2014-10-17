var
    app = require('http').createServer(handler)
    , io = require('socket.io').listen(app)
    , fs = require('fs')
    , bombers = []
    , port = process.env.PORT || 5000
;

app.listen(port);

function handler(req, res) {
    fs.readFile(
        __dirname + '/index.html', 
        function(err, data) {
            res.writeHead(200);
            res.end(data);
        }
    );
}

function randInt(min, max) {
    return parseInt( Math.random()*max + min );
}

function Bomber( name ) {
    this.id = 'bomber-' + bombers.length;
    this.name = name;
    this.color = 'rgb(' + [ randInt(64, 255), randInt(64, 255), randInt(64, 255) ].join(',') + ')';
    this.x = 0;
    this.y = 0;
    this.exploding = false;
    this.score = 0;

    bombers.push(this);
}

Bomber.prototype.addPoints = function(points) {
    this.score += points;
};

Bomber.prototype.move = function(x,y) {
    if ( !this.exploding ) {
        this.x = x;
        this.y = y;
        io.sockets.emit('move', this);
    }
};

Bomber.prototype.ignite = function() {
    if ( !this.exploding ) {
        this.exploding = true;

        io.sockets.emit('ignite', this);
        setTimeout( this.explode.bind(this), 500 );
    }
};

Bomber.prototype.explode = function() {
    // take out any bombs within 100 pixels of the bomber
    var i, b;
  
    for ( i in bombers ) {
        b = bombers[i];
        if ( b !== this && !b.exploding && Math.sqrt( Math.pow(b.x - this.x, 2) + Math.pow(b.y - this.y, 2) ) <= 100 ) {
            b.ignite();
            this.addPoints(50);
        }
    }

    io.sockets.emit('explode', this);
    setTimeout( this.reset.bind(this) , 1000 );
};

Bomber.prototype.reset = function() {
    this.exploding = false;
    io.sockets.emit('reset', this);
}

// socket stuff

io.sockets.on('connection', function(socket) {
    socket.on('join', function(name) {
        var bomber, i;
    
        // tell the new client about everyone else
    
        for (i in bombers) {
            socket.emit('join', bombers[i]);
        }
    
        // create a new bomber for this player
    
        bomber = new Bomber(name);
    
        // tell everyone else that we joined
    
        io.sockets.emit('join', bomber );
    
        // handle our move, ignite, and disconnect actions
    
        socket.on('move', function( x, y ) {
            bomber.move( x, y );
        });
    
        socket.on('ignite', function() {
            bomber.ignite();
        });
    
        socket.on('disconnect', function() {
            delete bombers[bombers.indexOf(bomber)];
            io.sockets.emit('disconnect', bomber );
        });
    });
});

setInterval( function() {
    var 
        i,
        scores = []
    ;

    for (i=0; i<bombers.length; i++) {
        if ( !!bombers[i] ) {
            scores.push({
                color: bombers[i].color,
                name: bombers[i].name,
                score: bombers[i].score
            });
        }

        scores.sort(function(a,b) { return b.score - a.score; });
    }

    io.sockets.emit( 'score', scores );
}, 2000);

