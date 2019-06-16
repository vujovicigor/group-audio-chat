var Peer = require('simple-peer')
var wrtc = require('wrtc')
var io = require('socket.io-client');

//io = socket.connect('https://www.jeebochat.com:81');


//var peer1 = new SimplePeer({ initiator: true, wrtc: wrtc })
//var peer2 = new SimplePeer({ wrtc: wrtc })

PEERS = {};

var config = { iceServers: [ 
    {
        url: 'turn:numb.viagenie.ca',
        urls: 'turn:numb.viagenie.ca',
        credential: 'ticketbird',
        username: 'vujovichigor@gmail.com'
    },
    {
        url: 'stun:numb.viagenie.ca',
        urls: 'stun:numb.viagenie.ca',
        credential: 'ticketbird',
        username: 'vujovichigor@gmail.com'
    },
    { url: 'stun:stun1.l.google.com:19302', urls: 'stun:stun1.l.google.com:19302' } 
  ]};

///
  socket = io.connect('https://www.jeebochat.com:81');
//  room = getQueryParameters()['room'] // GLOBAL 
  room = '123'; 
  if (room) socket.emit('cjoinroom', room );

  socket.on('roommate', function (data) {
      console.log('roommate',data);
  });

  socket.on('signal', function(remotepeer, data){
      console.log('p2p client signal received', remotepeer, PEERS )
      if (PEERS[remotepeer])  PEERS[remotepeer].signal(data);
  })

  // hangup, on websock dissconect
  socket.on('wsdisconnect', function(remotepeer){
      console.log('wsdisconnect received', remotepeer )
      if (PEERS[remotepeer]) {
          PEERS[remotepeer].destroy();
          delete(PEERS[remotepeer]);
      }
  })



  socket.on('initp2p', function(remotepeer, initiator, trickle ){
      console.log('Connecting...');
      var settings = { initiator: initiator, trickle: trickle, config:config, wrtc: wrtc  };
//      if (localstream) settings.stream =localstream;
      // https://github.com/feross/simple-peer/issues/95
      if (initiator) settings.offerConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: true }
      else settings.answerConstraints = { offerToReceiveAudio: false, offerToReceiveVideo: false };
      
      var p = new Peer( settings );
      PEERS[remotepeer] = p;
      p.on('error', function (err) { 
          console.log('P2P error');            
          console.log('Peer error', remotepeer, err);
          delete(PEERS[remotepeer]);
          // TODO:sock emit failure 
      })

      p.on('signal', function (data) {
          //console.log('SIGNAL', data);
          console.log('Sending signal to other peer', data);
          socket.emit('signal', remotepeer, data)
          //document.querySelector('#outgoing').textContent = JSON.stringify(data)
      })

      p.on('connect', function () {
          console.log('P2P CONNECT');
           p.send('whatever' + Math.random())
      })

      p.on('close', function () {
          console.log('P2P close')
          if (PEERS[remotepeer]) delete(PEERS[remotepeer]);            
      })

      p.on('data', function (data) {
          console.log('P2P data: ' + data)
      })   

      p.on('stream', function (stream) {
          console.log('Stream received');
          console.log('GOT STREAM');
          // got remote video stream
      })
  })
