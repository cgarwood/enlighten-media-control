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
