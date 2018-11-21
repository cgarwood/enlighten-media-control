# enlighten-media-control

Open source audio visual control and automation system, targeted towards church use

## Development

Recommend developing with VSCode, and using the `ESLint` and `Prettier - Code formatter` extensions to keep consistent coding styles.

# Components

## ProPresenter

Implements the ProPresenter6 API documented here: https://github.com/jeffmikels/ProPresenter-API

### Component Contents

```javascript
component = {
    // emitted events: message, update, error, connect, disconnect
    EventEmitter events,

    function connect(),

    // emitted events: message, update, error, connect, disconnect
    EventEmitter stageDisplayApi = {
        String clock_string,
        Object current_slide = {
            String uid,
            String content,
            String notes,
        },
        Object next_slide = {
            String uid,
            String content,
            String notes,
        },
    }

    // emitted events: message, update, error, connect, disconnect
    EventEmitter remoteControlApi = {
        Array library,
        Array playlists,
        Array presentation,

        // all functions are simply wrappers around the
        // ProPresenter API websocket protocol.
        // they send a websocket packet, and return true
        // or false depending on whether there was a connection.
        function getLibrary(),
        function getPlaylists(),
        function getCurrentPresentation(), // only works if a presentation is active
        function getCurrentSlideIndex(),   // only works if a slide is selected
        function getPresentation(String presentationPath),
        function triggerSlide(int slideIndex, String presentationPath),
    }
}
```

## Spotify

Implements the Spotify AppleScript API. This module controls the spotify player by either of two methods. It can address spotify directly using applescript and the 'node-osascript' module or if the enlighten server is on a platform without node-osascript, this component can make use of a "spotify server" that runs on a mac that also is running spotify. The spotify server must be a websocket server implementing the same functions as this component.

### Component Contents

```javascript
component = {
    // emitted events: message, update, error, connect, disconnect
    EventEmitter events,

    function connect(),

    // updates the current track data
    function check(),

    // probably will be deprecated
    int volume,
    float position,
    String state,  // paused, playing
    bool repeating,
    bool shuffling,

    // for sending commands to a server that supports more
    // commands than the core component
    function serverCmd(String customCommand, List args, callback),

    // should be overridden to handle messages not understood
    // by the core component
    function handleExtra(),

    // read all relevant track data into this component
    function getCurrentTrack(callback),
    function getAppState(callback),
    function setVolume(int n),  // 0-100
    function setPosition(float seconds),
    function setShuffling(bool b),
    function setRepeating(bool b),
    function playTrack(String spotifyurl),
    function nextTrack(),
    function previousTrack(),
    function play(),
    function pause(),
    function fadeTo(int targetVol, float duration) // duration in seconds
}
```
