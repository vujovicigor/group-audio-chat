var fs = require('fs');
//var app = require('http').createServer(handler)
//var https = require('https');
var https = require('http');

var serveStatic = require('serve-static') 
// Serve up public/ftp folder
var serve = serveStatic('www', { 'index': ['index.html', 'index.htm'] })

var app = https.createServer(function(req, res) {
  serve(req, res, ()=>{})
})

/*
var app = https.createServer(
  {
    key:  fs.readFileSync('/etc/letsencrypt/live/jeebochat.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/jeebochat.com/cert.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/jeebochat.com/chain.pem'),
    requestCert: false,
    rejectUnauthorized: false
}, 
handler);
*/

var io = require('socket.io')(app);
var url = require('url');

var PORT = 81//443
app.listen(PORT);
console.log('listening on '+PORT);

var ROOMS={}; // roomname:{sockid1:{...}, sockid2}
var SOCKS={}; // socid1:roomid, sock2:roomid
io.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });

  socket.on('cjoinroom', function (room) {
    console.log('cjoinroom', room, socket.id);
    if (room && (typeof room=='string')){
      // if client is already in some room - kick him out 
      if (SOCKS[socket.id]) { 
          var oldroom = SOCKS[socket.id];
          socket.leave(oldroom);  
          delete(SOCKS[socket.id])
          if (ROOMS[oldroom] && ROOMS[oldroom][socket.id] ) delete(ROOMS[oldroom][socket.id])  
        } 
      socket.join(room);
      if (!ROOMS[room]) ROOMS[room]={} 
      ROOMS[room][socket.id]=true;

      SOCKS[socket.id]=room;
      io.to(room).emit('roommate', ROOMS[room] );

      for (var sid in ROOMS[room]) {
          if (sid!=socket.id){
            socket.emit('initp2p', sid, true, true ); // initiator
            io.in(sid).emit('initp2p', socket.id, false, true );
          }
      }

    }
  });

  // P2P signal exchange
  socket.on('signal', function (remotepeer, data) {
//    console.log('signal from', remotepeer, data);
    console.log('signal from', remotepeer);
    io.to(remotepeer).emit('signal', socket.id, data)
  });

  socket.on('disconnect', function () {
    console.log('disconnect', socket.id);
      if (!socket.id) return
      var room = SOCKS[socket.id];
      if (room){
        if (ROOMS[room] && ROOMS[room][socket.id]) delete(ROOMS[room][socket.id]); 
        delete(SOCKS[socket.id]);        
        io.to(room).emit('roommate', ROOMS[room] );
        // obavjestenje webrtc-u da je socket.id prekinuo vezu
        io.to(room).emit('wsdisconnect', socket.id)
      }

  });

});
