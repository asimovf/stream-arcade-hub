// ------ ------ ------ ------ ------ ------ 
// js/twitch-chat.js - Twitch IRC WebSocket connection manager
// ------ ------ ------ ------ ------ ------ 

let ws = null;

// Initialize global Twitch WebSocket connection for IRC chat listening
export function initTwitchConnection(channel, onMessageCallback) {
    ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    ws.onopen = () => {
        ws.send("PASS SCHMOOPIIE");
        ws.send("NICK justinfan12345");
        ws.send(`JOIN #${channel}`);
    };

    ws.onmessage = (event) => {
        const rawData = event.data;
        if (rawData.startsWith("PING")) {
            ws.send("PONG :tmi.twitch.tv");
            return;
        }

        if (rawData.includes("PRIVMSG")) {
            const usernameMatch = rawData.match(/:([a-zA-Z0-9_]+)![a-zA-Z0-9_]+@[a-zA-Z0-9_]+\.tmi\.twitch\.tv/);
            const username = usernameMatch ? usernameMatch[1] : "Unknown";
            const messageParts = rawData.split("PRIVMSG #" + channel + " :");
            const messageText = messageParts.length > 1 ? messageParts[1].trim() : "";

            onMessageCallback(username, messageText);
        }
    };
}

// Close active Twitch WebSocket connection
export function closeTwitchConnection() {
    if (ws) {
        ws.close();
        ws = null;
    }
}