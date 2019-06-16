Ractive  = require("ractive");
//var QRCode = require('qrcode')
require("howler");
require("!style-loader!css-loader!./res/bare.min.css");
//require('ractive-touch');
Ractive.prototype.unset = function(keypath){
    var lastDot = keypath.lastIndexOf( '.' ),
        parent = keypath.substr( 0, lastDot ),
        property = keypath.substring( lastDot + 1 );

    this.set(keypath);
    delete this.get(parent)[property];
    return this.update(keypath);
}
require('!style-loader!css-loader!./node_modules/alertifyjs/build/css/alertify.min.css');
alertify  = require('alertifyjs');

Ractive.defaults.isolated=true;
Ractive.DEBUG = false;
componentsHash = {};  // GLOBAL

Ractive.events.tap = require('ractive-events-tap');

// keyboard events
//var keys = require( 'ractive-events-keys' );
//Ractive.events.enter    = keys.enter;
//Ractive.events.space    = keys.space;
//Ractive.events.escape   = keys.escape;
//Ractive.components.Root                 =  require('ractive-component!./components/Root.html');
Ractive.components.Root                 =  require('./components/Root.html');
Ractive.components.QRCode               =  require('./components/QRCode.html');

cc = new Ractive.components.Root({
    el: 'body',
    data:function() {
        return {
            chatdata:[]
            , PEERS:{}
            , interim_transcript:''
            , final_transcript:[]
        }
    }
});

getQueryParameters = function (str) {
    return (str || document.location.search).replace(/(^\?)/, '').split("&").map(function (n) {
        return n = n.split("="), this[n[0]] = n[1], this
    }.bind({}))[0];
}  

//PEERS
var Peer = require('simple-peer')
PEERS = {};

console.log('xxx');
ring = new Howl( { src: ['components/ring.mp3'] } );
ring.seek(5);

var config = {
  //iceTransportPolicy: 'relay',
  iceServers: [
      {"urls":"turn:159.89.1.251:3478", "username":"test", "credential":"test", "credentialType": "password"},
      {"urls":"stun:stun.sipgate.net"},
      {"urls":"stun:217.10.68.152"},
      {"urls":"stun:stun.sipgate.net:10000"}
  ]
};

gotMedia = function(localstream){
    socket = io(); // GLOBAL
    //console.log('localstream', localstream);
    room = getQueryParameters()['room'] // GLOBAL 
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


//    if (localstream) cc.set('localsrc', URL.createObjectURL(localstream));
//    if (localstream) cc.set('localsrc', localstream);
    if (localstream) cc.nodes.localVideo.srcObject = localstream;


    socket.on('initp2p', function(remotepeer, initiator, trickle ){
        alertify.message('Connecting...');
        ring.play();
        var settings = { initiator: initiator, trickle: true, config:config  };
        if (localstream) settings.stream =localstream;
        // https://github.com/feross/simple-peer/issues/95
        //if (initiator) settings.offerConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: true }
        //else settings.answerConstraints = { offerToReceiveAudio: false, offerToReceiveVideo: false };
        
        var p = new Peer( settings );
        PEERS[remotepeer] = p;
        p.on('error', function (err) { 
            alertify.error('P2P error');            
            console.log('Peer error', remotepeer, err);
            delete(PEERS[remotepeer]);
            cc.unset('PEERS.'+remotepeer);
            // TODO:sock emit failure 
        })

        p.on('signal', function (data) {
            //console.log('SIGNAL', data);
            console.log('Sending signal to other peer', data);
            socket.emit('signal', remotepeer, data)
            //document.querySelector('#outgoing').textContent = JSON.stringify(data)
        })

        p.on('connect', function () {
            alertify.message('Connected');
            console.log('P2P CONNECT');
            ring.stop();//ring.fade(1,0,200);
            p.send('whatever' + Math.random())
        })

        p.on('close', function () {
            console.log('P2P close')
            if (PEERS[remotepeer]) { delete(PEERS[remotepeer]); cc.unset('PEERS.'+remotepeer); }
        })

        p.on('data', function (data) {
            console.log('P2P data: ' , data)
            cc.push('chatdata', {user:remotepeer, data:data})
        })   

        p.on('stream', function (stream) {
            alertify.message('Stream received');
            console.log('GOT STREAM');
//            cc.set('PEERS.'+remotepeer, {remotesrc:window.URL.createObjectURL(stream), ready:true, muted:false})
            cc.set('PEERS.'+remotepeer, {remotesrc:stream, ready:true, muted:false}).then(function(){
              cc.nodes[remotepeer].srcObject = stream;
            })
            // got remote video stream, now let's show it in a video tag
        })
    })
};

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia || navigator.msGetUserMedia;

navigator.getUserMedia(
    { //video: false,
       audio: true }
    , gotMedia
    , function (e) {console.log('getUserMedia error',e); gotMedia(null)}    
)

// screenshare example:
/*
//navigator.getUserMedia({ video: false, audio: true }, gotMedia, function (e) {console.log('getUserMedia error')})
if (!getQueryParameters()['screen'])
    gotMedia(null)
//    navigator.getUserMedia({ video: true, audio: true }, gotMedia, 
//    function (e) {console.log('getUserMedia error',e); gotMedia(null)}    
//    )
else
    getScreenId(function (error, sourceId, screen_constraints) {
        navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
        navigator.getUserMedia(screen_constraints, function (stream) {
                gotMedia(stream)
                //document.querySelector('video').src = URL.createObjectURL(stream);
        }, function (error) {
                console.error(error);
        });
});
*/


// recognition setup
showInfo = alertify.message;
//function speechRecognition(){
  var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition

  recognition = new SpeechRecognition();
  recognition.lang = 'sr-RS';//'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    recognizing = true;
    showInfo('info_speak_now');
  };

  recognition.onerror = function(event) {
    if (event.error == 'no-speech') {
      showInfo('info_no_speech');
      ignore_onend = true;
    }
    if (event.error == 'audio-capture') {
      showInfo('info_no_microphone');
      ignore_onend = true;
    }
    if (event.error == 'not-allowed') {
      if (event.timeStamp - start_timestamp < 100) {
        showInfo('info_blocked');
      } else {
        showInfo('info_denied');
      }
      ignore_onend = true;
    }
    setTimeout(function(){recognition.start()}, 1000);
  };

  recognition.onend = function() {
    recognizing = false;
    console.log('recognition.onend')
    setTimeout(function(){recognition.start()}, 1000);
    //recognition.start();
    //return;

    if (ignore_onend) {
      return;
    }
    if (!final_transcript) {
      showInfo('info_start');
      return;
    }
    showInfo('');
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
      var range = document.createRange();
      range.selectNode(document.getElementById('final_span'));
      window.getSelection().addRange(range);
    }
    if (create_email) {
      create_email = false;
      //createEmail();
    }
  };

  recognition.onresult = function(event) {
    var interim_transcript = '';
    if (typeof(event.results) == 'undefined') {
      recognition.onend = null;
      recognition.stop();
      //upgrade();
      return;
    }
    var final_transcript = '';
    var interim_transcript = '';
    for (var i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
      } else {
        interim_transcript += event.results[i][0].transcript;
      }
    }
    if (final_transcript) {
      final_transcript = capitalize(final_transcript);
      console.log('f', final_transcript)
      cc.push('final_transcript', final_transcript);
      cc.set('interim_transcript', '')
      broadcast2Peers(final_transcript);
    }
    if (interim_transcript) {
      interim_transcript = capitalize(interim_transcript);
      console.log('i', interim_transcript)
      cc.set('interim_transcript', interim_transcript)
      //broadcast2Peers(interim_transcript);
    }
//    showInfo(linebreak(final_transcript));
    //showInfo(linebreak(interim_transcript));
    if (final_transcript || interim_transcript) {
      //showButtons('inline-block');
    }
  };
//}


var final_transcript = '';
var interim_span = '';
var two_line = /\n\n/g;
var one_line = /\n/g;
function linebreak(s) {
  return s.replace(two_line, '<p></p>').replace(one_line, '<br>');
} 

var first_char = /\S/;
function capitalize(s) {
  return s.replace(first_char, function(m) { return m.toUpperCase(); });
}

recognition.start();
ignore_onend = false;

function broadcast2Peers(msg){
  Object.keys(PEERS).forEach(function(p){
    PEERS[p].send(msg)
  })
}