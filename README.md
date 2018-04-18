![partychurch](https://github.com/forivall/partychurch/blob/master/icon/partychurch.png)

# partychurch
A web-based pseudo-livestreaming site accompanied by ephemeral chat that lets viewers send simple,
short messages along with a short video of themselves.

## Proof of Concept Features

### Broadcaster ("BC")
- Can record looping video up to 30 seconds long, and change the record duration, playback duration,
  and recording fps
- Can login with username/password

### Viewers
- Send a message to anyone connected to the same partychurch server / room (must include gif)
- Provides jpeg (filmstrip-style) videos alongside chats
- No signup required for viewers
- Allows for muting users based on their ID, removing all their current messages and blocking any
  future ones

## Future Features

### Admin
- Analytics tracking (google analytics)

### Broadcaster
- Can login with slack or discord (or hoodie?) organization login
- Can send messages inline with chat, with or without gif
- Can set room theme, title, chat message settings, etc.
- Can preview a gif before it is sent
- Can pause recording
- Frame by frame recording

### Viewers
- Show count of viewers
- Playback is synchronised globally, so that you can have many computers showing the same broadcast
  and it will all be in unison (will need to allow some config for display lag with TVs etc)
- Forbid users from sending messages without a webcam (configurable by BC)

## Running a server

partychurch requires [node](http://nodejs.org) >=8.0.0. Recommended deployment
is with zeit.

## Socket Protocol
The protocol of partychurch is built around socket.io 2.0, making use of binary frames where
appropriate. socket.io acks are used for all messages from the client to the server. 

### Connecting
Upon connecting, clients must send a fingerprint to the server. This fingerprint should uniquely
identify a particular client, and be relatively stable. Examples of good choices for this would be
a hardware identifier (e.g. Android ID), or a fingerprint constructed from many data points that
don't change often (e.g. fingerprintjs). Bad choices are things like IP addresses, since these could
potentially change a lot, as well as collide for multiple users.

To send the fingerprint, clients simply emit a `fingerprint` message with the fingerprint data as
the body, i.e.
```javascript
io.emit('fingerprint', 'myCoolFingerprint')
```

The server will reply with a `userid` message containing the ID it has calculated for this client,
which should be saved so that a client can recognize which messages are its own. This ID will be
constant for the lifetime of the websocket connection. An example of handling the message would be:
```javascript
io.on('userid', function(userId) {
  myId = userId
})
```

Clients should then specify what they want to watch / broadcast

```javascript
io.emit('join', {
  room: 'sanctuary',
  role: 'broadcaster', // or 'viewer'
  credentials: {
    password: 'imthebroadcaster'
  }
})
```

A user can only be in one room at a time.

### Messages

#### Receiving
Messages are transmitted to clients using the `chat` message. The format of the data passed in this
message is:
```javascript
{
  "video": { 
    "data": ArrayBuffer(),
    "type": "jpg",
    "mime": "image/jpeg",
    "frames": 25,
    "duration": 5000
  },
  "text": "The text the user sent",
  "sent": 1421135370231,
  "userId": "TheUserIDOftheSender"
}
```

Currently, `type` and `mime` will always be 'jpg' and 'image/jpg'. `sent` is a
unix timestamp corresponding to when the message was originally sent.

#### Sending
Clients can send messages by sending a `chat` message themselves, with the first parameter in the
following format:
```json
{
  "text": "The text the user wants to send",
  "ack": "AUniqueIdTheServerShouldAckWith",
  "video": {
    "format": "image/jpeg",
    "frames": 10,
    "duration": 2000
  }
}
```

Clients should send an array of `n` frames (as binary) as the second parameter, e.g.
```javascript
io.emit('chat', message, frames)
```

`format` specifies what format these frames are in. At present, only `image/jpeg` is accepted.
`frames` specifies how many frames are being sent. `duration` indicates how long the video will play

### Broadcasts

Broadcasts are transmitted to clients using the `broadcast` message. The format of the data passed
in this message is as follows:

```javascript
{
  "video": { 
    "data": ArrayBuffer(),
    "type": "jpg",
    "mime": "image/jpeg",
    "frames": 25,
    "duration": 5000
  },
  "image": {
    "data": ArrayBuffer(),
    "mime": "image/jpeg",
  },
  "text": "The text the broadcaster sent",
  "sent": 1421135370231,
  "userId": "TheUserIDOftheSender"
}
```

#### Sending
Broadcasters can send messages by sending a `broadcast` message, with the first parameter in the
following format:
```js
{
  "text": "The text the broadcaster wants to show",
  "video": {
    "format": "image/jpeg",
    "frames": 10,
    "duration": 2000,
    "frameData": [ArrayBuffer()...]
  },
  "image": {
    "format": "image/jpeg", // or "image/png", "image/gif"
    "data": ArrayBuffer()
  }
}
```

### Status updates
The server will send clients a number of different status updates to allow things like user counts
to be known. These are all handled through seperate messages, which are:

#### active
Specifies how many users are currently connected.
```javascript
io.on('active', function(numActive) {
  alert('There are ' + numActive + ' viewers in your room!')
})
```

#### settings
Updates the room settings, set by the broadcaster. Title, theme, chat message
settings, etc.

## License
MIT
