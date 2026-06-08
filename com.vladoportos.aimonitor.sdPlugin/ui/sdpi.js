// Minimal vanilla Property Inspector shim for Stream Deck SDK 6.
// Wraps the websocket-based PI protocol and exposes a tiny API:
//
//   SDPI.onReady((settings) => { ... fill the form ... });
//   SDPI.setSettings(newSettings);
//
// Bind it from page <script> after the DOM is ready.

(function (global) {
  let ws = null;
  let uuid = null;
  let registerEvent = null;
  let actionInfo = null;
  let readyHandlers = [];
  let currentSettings = {};

  // Stream Deck invokes this global at startup.
  global.connectElgatoStreamDeckSocket = function (inPort, inUUID, inRegister, _info, inActionInfo) {
    uuid = inUUID;
    registerEvent = inRegister;
    try {
      actionInfo = JSON.parse(inActionInfo);
    } catch (_e) {
      actionInfo = {};
    }
    currentSettings = (actionInfo && actionInfo.payload && actionInfo.payload.settings) || {};

    ws = new WebSocket("ws://127.0.0.1:" + inPort);
    ws.onopen = function () {
      ws.send(JSON.stringify({ event: registerEvent, uuid: uuid }));
      // Notify everyone listening
      readyHandlers.forEach(function (h) {
        try { h(currentSettings); } catch (_e) {}
      });
      readyHandlers = [];
    };
    ws.onmessage = function (event) {
      let msg;
      try { msg = JSON.parse(event.data); } catch (_e) { return; }
      if (msg && msg.event === "didReceiveSettings") {
        currentSettings = (msg.payload && msg.payload.settings) || {};
      }
    };
  };

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  global.SDPI = {
    onReady: function (handler) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { handler(currentSettings); } catch (_e) {}
      } else {
        readyHandlers.push(handler);
      }
    },
    getSettings: function () { return currentSettings; },
    setSettings: function (next) {
      currentSettings = Object.assign({}, currentSettings, next);
      send({ event: "setSettings", context: uuid, payload: currentSettings });
    },
  };
})(window);
