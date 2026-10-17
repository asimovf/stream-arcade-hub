// js/scramble.js - Word Scramble mini-game module with external JSON, live highlights and manual streamer control

let totalRounds = 5;
let currentRound = 1;
let secretWord = "";
let scrambledWord = "";
let gameActive = false;
let userScores = {};
let usedWords = [];

let timeLeft = 30;
let timerInterval = null;

let wordBankScramble = []; // Dynamically loaded from JSON

// Initialize Scramble game session and load external JSON dictionary
export async function initScramble(rounds = 5) {
    totalRounds = parseInt(rounds) || 5;
    currentRound = 1;
    userScores = {};
    usedWords = [];
    
    // Bind manual next round button listener once
    const nextBtn = document.getElementById("scramble-next-btn");
    if (nextBtn && !nextBtn.dataset.listenerBound) {
        nextBtn.dataset.listenerBound = "true";
        nextBtn.addEventListener("click", nextScrambleRound);
    }

    // Load words dictionary from external JSON if not already loaded
    if (wordBankScramble.length === 0) {
        try {
            const response = await fetch('./js/data/scramble-data.json');
            const data = await response.json();
            wordBankScramble = (data.words || []).map(w => w.toUpperCase());
        } catch (error) {
            console.error("Error loading scramble-data.json:", error);
            wordBankScramble = ["COMPUTER", "TASTIERA", "CHITARRA", "ALBERO", "PIZZA"]; // Fallback backup words
        }
    }
    
    startNewScrambleRound();
}

// Stop the scramble game session and reset UI
export function stopScramble() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const nextBtn = document.getElementById("scramble-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const setupDiv = document.getElementById("scramble-setup");
    const gameplayDiv = document.getElementById("scramble-gameplay");
    if (setupDiv) setupDiv.classList.remove("hidden");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
}

// Start a new scramble round by selecting and shuffling a word
function startNewScrambleRound() {
    const nextBtn = document.getElementById("scramble-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (currentRound > totalRounds) {
        endScrambleSession();
        return;
    }

    let available = wordBankScramble.filter(w => !usedWords.includes(w));
    if (available.length === 0) {
        usedWords = [];
        available = [...wordBankScramble];
    }

    secretWord = available[Math.floor(Math.random() * available.length)];
    usedWords.push(secretWord);
    scrambledWord = shuffleWord(secretWord);
    
    gameActive = true;
    updateScrambleUI();
    startScrambleTimer();
}

// Helper function to scramble letters ensuring it doesn't match the original word
function shuffleWord(word) {
    let arr = word.split("");
    do {
        for (let i = arr.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    } while (arr.join("") === word && word.length > 1);
    
    return arr.join(" ");
}

// Start the 30-second timer for the current round
function startScrambleTimer() {
    timeLeft = 30;
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processScrambleTimeout();
        }
    }, 1000);
}

// Update the countdown timer display badge
function updateTimerDisplay() {
    const timerBadge = document.getElementById("scramble-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 8) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Update UI elements for the current round with highlighted command prompt
function updateScrambleUI() {
    const roundInfo = document.getElementById("scramble-round-info");
    const wordDisplay = document.getElementById("scramble-word-display");
    const statusBox = document.getElementById("scramble-status");
    const chatFeed = document.getElementById("scramble-chat-feed");

    if (roundInfo) roundInfo.innerText = `Manche ${currentRound}/${totalRounds}`;
    if (wordDisplay) wordDisplay.innerText = scrambledWord;
    
    if (statusBox) statusBox.innerHTML = `Scrivi in chat <span style="color: #00f3ff; font-weight: bold;">!a [parola]</span> per indovinare per primo!`;
    if (chatFeed) chatFeed.innerText = `In attesa di tentativi per la manche ${currentRound}...`;
}

// Process incoming chat guess and check if it matches the secret word
export function processScrambleGuess(guess, username) {
    if (!gameActive) return;

    const cleanGuess = guess.trim().toUpperCase();
    const chatFeed = document.getElementById("scramble-chat-feed");
    if (chatFeed) {
        chatFeed.innerText = `${username}: ${guess}`;
    }

    if (cleanGuess === secretWord) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        const points = timeLeft * 10 + 50;
        userScores[username] = (userScores[username] || 0) + points;

        const statusBox = document.getElementById("scramble-status");
        if (statusBox) {
            statusBox.innerHTML = `🎉 <b style="color: #ffe600; font-size: 1.25em; text-shadow: 0 0 14px rgba(255,230,0,0.9);">${username}</b> ha indovinato! La parola era <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${secretWord}</b> (+${points} pt).`;
        }

        showNextButtonOrProceed();
    }
}

// Handle round timeout when no one guesses in time
function processScrambleTimeout() {
    gameActive = false;
    const statusBox = document.getElementById("scramble-status");
    if (statusBox) {
        statusBox.innerHTML = `⏰ Tempo scaduto! Nessuno ha indovinato. La parola era: <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${secretWord}</b>.`;
    }

    showNextButtonOrProceed();
}

// Handle transition flow depending on whether it's the last round
function showNextButtonOrProceed() {
    const nextBtn = document.getElementById("scramble-next-btn");
    if (currentRound >= totalRounds) {
        // Last round reached, show results directly after a brief pause or let streamer click
        if (nextBtn) {
            nextBtn.innerText = "🏆 VISUALIZZA CLASSIFICA";
            nextBtn.classList.remove("hidden");
        }
    } else {
        if (nextBtn) {
            nextBtn.innerText = "▶ PROSSIMA MANCHE";
            nextBtn.classList.remove("hidden");
        }
    }
}

// Triggered when streamer clicks the next round button
export function nextScrambleRound() {
    currentRound++;
    startNewScrambleRound();
}

// End the scramble session and display final leaderboard
function endScrambleSession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const nextBtn = document.getElementById("scramble-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const statusBox = document.getElementById("scramble-status");
    const wordDisplay = document.getElementById("scramble-word-display");
    
    if (wordDisplay) wordDisplay.innerText = "FINE PARTITA";

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Classifica Anagramma Rapido 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
    if (sortedScores.length === 0) {
        leaderboardHtml += `<li>Nessun punto assegnato in questa sessione.</li>`;
    } else {
        sortedScores.forEach(([user, score], index) => {
            let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            leaderboardHtml += `<li style="margin-bottom: 5px;">${medal} <b style="color: #ffe600;">${user}</b>: ${score} punti</li>`;
        });
    }
    leaderboardHtml += `</ul>`;

    if (statusBox) {
        statusBox.innerHTML = leaderboardHtml;
    }
}