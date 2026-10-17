// ------ ------ ------ ------ ------ ------ 
// main.js - Core application hub 02-10-2026
// ------ ------ ------ ------ ------ ------ 
import { initWordle, stopWordle, processWordleGuess, nextRound } from './wordle.js';
import { initHangman, stopHangman, processHangmanGuess, nextHangmanWord } from './hangman.js';
import { initNerd, stopNerd, processNerdGuess, nextNerdRound } from './nerd.js';
import { initScramble, stopScramble, processScrambleGuess, nextScrambleRound } from './scramble.js';
import { initQuiz, stopQuiz, processQuizGuess, nextQuizRound } from './quiz.js';
import { initSentence, stopSentence, processSentenceGuess, nextSentenceRound } from './sentence.js';
import { initBattleship, stopBattleship, processBattleshipGuess, nextBattleshipRound } from './battleship.js';
import { initSkribbl, stopSkribbl, processSkribblGuess } from './skribbl.js';
import { initMemory, stopMemory, processMemoryGuess } from './memory.js';
import { initTrueCrime, stopTrueCrime, processTrueCrimeAccusation } from './true_crime.js';

import { initTwitchConnection, closeTwitchConnection } from './twitch-chat.js';
import { initNeonGrid } from './neon-grid.js';

const authorizedUsers = {
    "kiho_85": "a",
    "mod_anna": "modpass123",
    "mod_marco": "modpass456"
};

let TWITCH_CHANNEL = ""; 
let activeGame = null;

// DOM elements
const loginForm = document.getElementById("login-form");
const loginContainer = document.getElementById("login-container");
const menuContainer = document.getElementById("menu-container");
const errorMsg = document.getElementById("error-msg");
const chatFeed = document.getElementById("chat-feed");
const placeholderContainer = document.getElementById("placeholder-container");
const placeholderTitle = document.getElementById("placeholder-title");

// Game Containers
const wordleContainer = document.getElementById("wordle-container");
const hangmanContainer = document.getElementById("hangman-container");
const skribblContainer = document.getElementById("skribbl-container");
const scrambleContainer = document.getElementById("scramble-container"); 
const nerdContainer = document.getElementById("nerd-container");
const battleshipContainer = document.getElementById("battleship-container");
const truecrimeContainer = document.getElementById("truecrime-container");
const sentenceContainer = document.getElementById("sentence-container");
const quizContainer = document.getElementById("quiz-container");
const memoryContainer = document.getElementById("memory-container");

// Setup & Gameplay blocks
const wordleSetup = document.getElementById("wordle-setup");
const wordleGameplay = document.getElementById("wordle-gameplay");
const roundsInput = document.getElementById("rounds-input");
const startWordleBtn = document.getElementById("start-wordle-btn");

const startNerdBtn = document.getElementById("start-nerd-btn");
const nerdRoundsInput = document.getElementById("nerd-rounds-input");
const nerdSetup = document.getElementById("nerd-setup");
const nerdGameplay = document.getElementById("nerd-gameplay");

const startScrambleBtn = document.getElementById("start-scramble-btn");
const scrambleRoundsInput = document.getElementById("scramble-rounds-input");

const startBattleshipBtn = document.getElementById("start-battleship-btn");
const battleshipRoundsInput = document.getElementById("battleship-rounds-input");
const battleshipSetup = document.getElementById("battleship-setup");
const battleshipGameplay = document.getElementById("battleship-gameplay");

const startTrueCrimeBtn = document.getElementById("start-truecrime-btn");
const truecrimeRoundsInput = document.getElementById("truecrime-rounds-input");
const truecrimeSetup = document.getElementById("truecrime-setup");
const truecrimeGameplay = document.getElementById("truecrime-gameplay");

const startSentenceBtn = document.getElementById("start-sentence-btn");
const sentenceRoundsInput = document.getElementById("sentence-rounds-input");
const sentenceSetup = document.getElementById("sentence-setup");
const sentenceGameplay = document.getElementById("sentence-gameplay");

const startQuizBtn = document.getElementById("start-quiz-btn");
const quizSetup = document.getElementById("quiz-setup");
const quizGameplay = document.getElementById("quiz-gameplay");

const startMemoryBtn = document.getElementById("start-memory-btn");
const memorySetup = document.getElementById("memory-setup");
const memoryGameplay = document.getElementById("memory-gameplay");

// Handle Login Form Submission
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;
    const channelInput = document.getElementById("channel").value.trim().toLowerCase();

    if (!authorizedUsers[user] || authorizedUsers[user] !== pass) {
        errorMsg.innerText = "Credenziali non valide!";
        return;
    }

    if (!channelInput) {
        errorMsg.innerText = "Inserisci il nome del canale Twitch!";
        return;
    }

    TWITCH_CHANNEL = channelInput;

    loginContainer.classList.add("hidden");
    menuContainer.classList.remove("hidden");
    
    document.getElementById("menu-streamer-name").innerText = user;
    document.getElementById("menu-channel-name").innerText = `TWITCH CHANNEL: ${TWITCH_CHANNEL}`;
    document.getElementById("menu-streamer-logo").innerText = user.charAt(0).toUpperCase();
    
    initTwitchConnection(TWITCH_CHANNEL, handleGlobalChat);
});

// Route incoming chat messages to active game
function handleGlobalChat(username, text) {
    if (chatFeed) {
        // Create a wrapper element for the new message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `<b>${username}:</b> ${text}`;
        
        // Prepend the new message to the top of the feed
        chatFeed.prepend(messageDiv);
        
        // Limit the maximum number of messages to prevent DOM bloat and memory leaks
        const maxMessages = 50;
        while (chatFeed.children.length > maxMessages) {
            chatFeed.removeChild(chatFeed.lastChild);
        }
    }

    if (activeGame === "wordle" && text.toLowerCase().startsWith("!w ")) {
        const guess = text.substring(3).trim().toUpperCase();
        if (guess.length === 5 && /^[A-Z]+$/.test(guess)) {
            processWordleGuess(guess, username);
        }
    }

    if (activeGame === "hangman" && (text.toLowerCase().startsWith("!h ") || text.toLowerCase().startsWith("!impiccato "))) {
        const parts = text.split(" ");
        if (parts.length >= 2) {
            let letter = parts[1].trim().toUpperCase();
            if (letter.length > 0) {
                letter = letter[0];
                if (letter >= 'A' && letter <= 'Z') {
                    processHangmanGuess(letter, username);
                }
            }
        }
    }
    
    if (activeGame === "skribbl") {
        processSkribblGuess(text, username);
    }
    
    if (activeGame === "scramble" && text.toLowerCase().startsWith("!a ")) {
        const guess = text.substring(3).trim().toUpperCase();
        if (guess.length > 0) {
            processScrambleGuess(guess, username);
        }
    }

    if (activeGame === "nerd" && text.toLowerCase().startsWith("!n ")) {
        const guess = text.substring(3).trim();
        if (guess.length > 0) {
            processNerdGuess(guess, username);
        }
    }

    if (activeGame === "memory" && text.toLowerCase().statsWith("!m ")) {
        const guess = text.substring(3).trim();
        if (guess.length > 0) {
            processMemoryGuess(guess, username);
        }
    }    
    
    if (activeGame === "battleship" && text.toLowerCase().startsWith("!b ")) {
        const coord = text.substring(3).trim();
        if (coord.length >= 2) {
            processBattleshipGuess(coord, username);
        }
    }

    if (activeGame === "truecrime" && text.toLowerCase().startsWith("!accusa ")) {
        const acc = text.substring(8).trim();
        if (/^[1-4]$/.test(acc)) {
            processTrueCrimeAccusation(parseInt(acc), username);
        }
    }
    
    if (activeGame === "sentence" && text.toLowerCase().startsWith("!s ")) {
        const guess = text.substring(3).trim();
        if (guess.length > 0) {
            processSentenceGuess(guess, username);
        }
    }    
    
    if (activeGame === "quiz" && text.toLowerCase().startsWith("!q ")) {
        const guess = text.substring(3).trim();
        if (guess.length > 0) {
            processQuizGuess(guess, username);
        }
    }    
}

// Menu Card Selection
document.querySelectorAll(".game-card").forEach(card => {
    card.addEventListener("click", () => {
        const rawGame = card.getAttribute("data-game");
        const game = rawGame ? rawGame.trim().toLowerCase() : "";
        menuContainer.classList.add("hidden");

        if (game === "wordle") {
            activeGame = "wordle";
            if (wordleContainer) wordleContainer.classList.remove("hidden");
            if (wordleSetup) wordleSetup.classList.remove("hidden");
            if (wordleGameplay) wordleGameplay.classList.add("hidden");
        } 
        else if (game === "hangman") {
            activeGame = "hangman";
            if (hangmanContainer) hangmanContainer.classList.remove("hidden");
            document.getElementById("hangman-setup")?.classList.remove("hidden");
            document.getElementById("hangman-gameplay")?.classList.add("hidden");
            initHangman(); 
        } 
        else if (game === "skribbl") {
            activeGame = "skribbl";
            if (skribblContainer) skribblContainer.classList.remove("hidden");
            document.getElementById("skribbl-setup")?.classList.remove("hidden");
            document.getElementById("skribbl-gameplay")?.classList.add("hidden");
            initSkribbl();
        } 
        else if (game === "scramble") {
            activeGame = "scramble";
            if (scrambleContainer) scrambleContainer.classList.remove("hidden");
            document.getElementById("scramble-setup")?.classList.remove("hidden");
            document.getElementById("scramble-gameplay")?.classList.add("hidden");
        } 
        else if (game === "nerd") { 
            activeGame = "nerd";
            if (nerdContainer) nerdContainer.classList.remove("hidden");
            if (nerdSetup) nerdSetup.classList.remove("hidden");
            if (nerdGameplay) nerdGameplay.classList.add("hidden");
        } 
        else if (game === "memory") {
            activeGame = "memory";
            if (memoryContainer) memoryContainer.classList.remove("hidden");
            if (memorySetup) memorySetup.classList.remove("hidden");
            if (memoryGameplay) memoryGameplay.classList.add("hidden");
            initMemory();
        }        
        else if (game === "battleship") {
            activeGame = "battleship";
            if (battleshipContainer) battleshipContainer.classList.remove("hidden");
            if (battleshipSetup) battleshipSetup.classList.remove("hidden");
            if (battleshipGameplay) battleshipGameplay.classList.add("hidden");
        } 
        else if (game === "truecrime") {
            activeGame = "truecrime";
            if (truecrimeContainer) truecrimeContainer.classList.remove("hidden");
            if (truecrimeSetup) truecrimeSetup.classList.remove("hidden");
            if (truecrimeGameplay) truecrimeGameplay.classList.add("hidden");
        } 
        else if (game === "quiz") {
            activeGame = "quiz";
            if (quizContainer) quizContainer.classList.remove("hidden");
            if (quizSetup) quizSetup.classList.remove("hidden");
            if (quizGameplay) quizGameplay.classList.add("hidden");
        } 
        else if (game === "sentence") {
            activeGame = "sentence";
            if (sentenceContainer) sentenceContainer.classList.remove("hidden");
            if (sentenceSetup) sentenceSetup.classList.remove("hidden");
            if (sentenceGameplay) sentenceGameplay.classList.add("hidden");        
        } 
        else {        
            activeGame = "unknown";
            placeholderTitle.innerText = "Funzione non trovata";
            if (placeholderContainer) placeholderContainer.classList.remove("hidden");
        }        
    });
});

// Game Start & Next Button Listeners
if (startWordleBtn) {
    startWordleBtn.addEventListener("click", () => {
        const selectedRounds = roundsInput ? roundsInput.value : 5;
        if (wordleSetup) wordleSetup.classList.add("hidden");
        if (wordleGameplay) wordleGameplay.classList.remove("hidden");
        initWordle(selectedRounds);
    });
}

document.getElementById("next-round-btn")?.addEventListener("click", () => nextRound());
document.getElementById("hangman-next-btn")?.addEventListener("click", () => nextHangmanWord());

if (startNerdBtn) {
    startNerdBtn.addEventListener("click", () => {
        const selectedRounds = nerdRoundsInput ? nerdRoundsInput.value : 5;
        if (nerdSetup) nerdSetup.classList.add("hidden");
        if (nerdGameplay) nerdGameplay.classList.remove("hidden");
        initNerd(selectedRounds);
    });
}
document.getElementById("nerd-next-btn")?.addEventListener("click", () => nextNerdRound());

if (startScrambleBtn) {
    startScrambleBtn.addEventListener("click", () => {
        const selectedRounds = scrambleRoundsInput ? scrambleRoundsInput.value : 5;
        document.getElementById("scramble-setup")?.classList.add("hidden");
        document.getElementById("scramble-gameplay")?.classList.remove("hidden");
        initScramble(selectedRounds);
    });
}
document.getElementById("scramble-next-btn")?.addEventListener("click", () => nextScrambleRound());

if (startBattleshipBtn) {
    startBattleshipBtn.addEventListener("click", () => {
        const selectedRounds = battleshipRoundsInput ? battleshipRoundsInput.value : 5;
        if (battleshipSetup) battleshipSetup.classList.add("hidden");
        if (battleshipGameplay) battleshipGameplay.classList.remove("hidden");
        initBattleship(selectedRounds);
    });
}
document.getElementById("battleship-next-btn")?.addEventListener("click", () => nextBattleshipRound());

if (startTrueCrimeBtn) {
    startTrueCrimeBtn.addEventListener("click", () => {
        const selectedRounds = truecrimeRoundsInput ? truecrimeRoundsInput.value : 3;
        if (truecrimeSetup) truecrimeSetup.classList.add("hidden");
        if (truecrimeGameplay) truecrimeGameplay.classList.remove("hidden");
        initTrueCrime(selectedRounds);
    });
}

if (startQuizBtn) {
    startQuizBtn.addEventListener("click", () => {
        const checkedBoxes = document.querySelectorAll('input[name="quiz-cat"]:checked');
        const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);

        if (selectedCategories.length === 0) {
            alert("Seleziona almeno una categoria!");
            return;
        }

        if (quizSetup) quizSetup.classList.add("hidden");
        if (quizGameplay) quizGameplay.classList.remove("hidden");
        initQuiz(selectedCategories, 10); 
    });
}
document.getElementById("quiz-next-btn")?.addEventListener("click", () => nextQuizRound());

if (startMemoryBtn) {
    startMemoryBtn.addEventListener("click", () => {
        if (memorySetup) memorySetup.classList.add("hidden");
        if (memoryGameplay) memoryGameplay.classList.remove("hidden");
        initMemory();
    });
}

if (startSentenceBtn) {
    startSentenceBtn.addEventListener("click", () => {
        const selectedRounds = sentenceRoundsInput ? sentenceRoundsInput.value : 5;
        if (sentenceSetup) sentenceSetup.classList.add("hidden");
        if (sentenceGameplay) sentenceGameplay.classList.remove("hidden");
        initSentence(selectedRounds);
    });
}
document.getElementById("sentence-next-btn")?.addEventListener("click", () => nextSentenceRound());

// Back to menu handler
document.querySelectorAll(".back-btn, .back-to-menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (activeGame === "wordle") stopWordle();
        if (activeGame === "hangman") stopHangman();
        if (activeGame === "skribbl") stopSkribbl();
        if (activeGame === "scramble") stopScramble();
        if (activeGame === "nerd") stopNerd();
        if (activeGame === "battleship") stopBattleship();
        if (activeGame === "truecrime") stopTrueCrime();
        if (activeGame === "sentence") stopSentence();
        if (activeGame === "quiz") stopQuiz();
        if (activeGame === "memory") stopMemory();
        
        activeGame = null;

        [wordleContainer, hangmanContainer, skribblContainer, scrambleContainer, 
         nerdContainer, battleshipContainer, truecrimeContainer, sentenceContainer, 
         quizContainer, memoryContainer, placeholderContainer].forEach(c => c?.classList.add("hidden"));
            
        [wordleSetup, nerdSetup, battleshipSetup, truecrimeSetup, sentenceSetup, quizSetup, memorySetup].forEach(s => s?.classList.remove("hidden"));
        [wordleGameplay, nerdGameplay, battleshipGameplay, truecrimeGameplay, sentenceGameplay, quizGameplay, memoryGameplay].forEach(g => g?.classList.add("hidden"));
        
        document.getElementById("hangman-setup")?.classList.remove("hidden");
        document.getElementById("hangman-gameplay")?.classList.add("hidden");
        document.getElementById("skribbl-setup")?.classList.remove("hidden");
        document.getElementById("skribbl-gameplay")?.classList.add("hidden");
        document.getElementById("scramble-setup")?.classList.remove("hidden");
        document.getElementById("scramble-gameplay")?.classList.add("hidden");

        menuContainer.classList.remove("hidden");
    });
});

// Logout Button Logic
document.getElementById("logout-btn").addEventListener("click", () => {
    closeTwitchConnection();
    if (activeGame === "wordle") stopWordle();
    if (activeGame === "hangman") stopHangman();
    if (activeGame === "skribbl") stopSkribbl();
    if (activeGame === "scramble") stopScramble();
    if (activeGame === "nerd") stopNerd();
    if (activeGame === "battleship") stopBattleship();
    if (activeGame === "truecrime") stopTrueCrime();
    if (activeGame === "sentence") stopSentence();
    if (activeGame === "quiz") stopQuiz();
    if (activeGame === "memory") stopMemory();

    activeGame = null;
    TWITCH_CHANNEL = "";
    
    menuContainer.classList.add("hidden");
    [wordleContainer, hangmanContainer, skribblContainer, scrambleContainer, 
     nerdContainer, battleshipContainer, truecrimeContainer, sentenceContainer, 
     quizContainer, memoryContainer, placeholderContainer].forEach(c => c?.classList.add("hidden"));
    
    loginContainer.classList.remove("hidden");
    loginForm.reset();
    errorMsg.innerText = "";
});

// Initialize Neon Grid background animation on startup
initNeonGrid();
