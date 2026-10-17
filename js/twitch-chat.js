// ------ ------ ------ ------ ------ ------ 
// js/twitch-chat.js - Authenticated Twitch IRC WebSocket connection manager with sending support
// ------ ------ ------ ------ ------ ------ 

let ws = null;
let currentChannel = "";

export function initTwitchConnection(channel, username, oauthToken, onMessageCallback) {
    if (ws) {
        closeTwitchConnection();
    }

    currentChannel = channel ? channel.toLowerCase().trim() : "";
    const cleanUsername = username ? username.toLowerCase().trim() : "";
    
    if (!currentChannel || !oauthToken || !cleanUsername) {
        console.error("Missing IRC connection parameters.");
        return;
    }

    ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    ws.onopen = () => {
        // Authenticate officially using the user's OAuth token and username with full chat scope
        ws.send(`PASS oauth:${oauthToken}`);
        ws.send(`NICK ${cleanUsername}`);
        ws.send(`JOIN #${currentChannel}`);
    };

    ws.onmessage = (event) => {
        const rawData = event.data;
        if (rawData.startsWith("PING")) {
            ws.send("PONG :tmi.twitch.tv");
            return;
        }

        // Trigger welcome message or confirmation once successfully connected to IRC
        if (rawData.includes(" 001 ")) {
            console.log("Successfully connected and authenticated to Twitch IRC.");
        }

        if (rawData.includes("PRIVMSG")) {
            const usernameMatch = rawData.match(/:([a-zA-Z0-9_]+)![a-zA-Z0-9_]+@[a-zA-Z0-9_]+\.tmi\.twitch\.tv/);
            const msgUser = usernameMatch ? usernameMatch[1] : "Unknown";
            const messageParts = rawData.split("PRIVMSG #" + currentChannel + " :");
            const messageText = messageParts.length > 1 ? messageParts[1].trim() : "";

            onMessageCallback(msgUser, messageText);
        }
    };
}

// Send a message directly to the Twitch channel chat via authenticated WebSocket
export function sendTwitchMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN && currentChannel) {
        ws.send(`PRIVMSG #${currentChannel} :${message}`);
    } else {
        console.error("WebSocket is not connected. Cannot send message.");
    }
}

export function closeTwitchConnection() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

// WORKING ANONIMOUS WAY
/* let ws = null;

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
} */