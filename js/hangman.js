// js/hangman.js - Hangman mini-game module with session scores and leaderboard

let totalWords = 3;
let currentWordIndex = 1;
let secretWord = "";
let guessedLetters = new Set();
let wrongErrors = 0;
const maxErrors = 6;

let timeLeft = 12;
let timerInterval = null;
let roundActive = false;
let userVotesThisTurn = {}; // { username: letter }
let userScores = {}; // Chat user leaderboard points

let wordBank = []; // Dynamically loaded from JSON
let usedHangmanWords = []; // Track used words to prevent repetition in the session

// Initialize Hangman game and load external JSON dictionary
export async function initHangman() {
    const startBtn = document.getElementById("start-hangman-btn");
    const setupDiv = document.getElementById("hangman-setup");
    const gameplayDiv = document.getElementById("hangman-gameplay");

    // Hide next word button initially during setup
    const nextBtn = document.getElementById("hangman-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    // Load words dictionary from external JSON if not already loaded
    if (wordBank.length === 0) {
        try {
            const response = await fetch('./js/data/hangman-data.json');
            const data = await response.json();
            wordBank = (data.words || []).map(w => w.toUpperCase());
        } catch (error) {
            console.error("Error loading hangman-data.json:", error);
            wordBank = ["STREAMER", "GIOCO", "CHAT", "TWITCH", "PROGRAMMARE"]; // Fallback backup words
        }
    }

    startBtn.addEventListener("click", () => {
        const roundsInput = document.getElementById("hangman-rounds-input");
        totalWords = parseInt(roundsInput.value) || 3;
        currentWordIndex = 1;
        userScores = {};
        usedHangmanWords = []; // Reset used words tracking on new session
        
        setupDiv.classList.add("hidden");
        gameplayDiv.classList.remove("hidden");

        startNewHangmanRound();
    });
}

// Stop the hangman game session and clear timers
export function stopHangman() {
    if (timerInterval) clearInterval(timerInterval);
    roundActive = false;
    
    const nextBtn = document.getElementById("hangman-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    document.getElementById("hangman-gameplay").classList.add("hidden");
    document.getElementById("hangman-setup").classList.remove("hidden");
}

// Process incoming chat guess: register/update user's letter vote
export function processHangmanGuess(letter, username) {
    if (!roundActive) return;
    const cleanLetter = letter.trim().toUpperCase();
    if (/^[A-Z]$/.test(cleanLetter)) {
        userVotesThisTurn[username] = cleanLetter;
        updateHangmanStatus();
    }
}

// Start a new hangman round by picking a random unique word from the word bank
function startNewHangmanRound() {
    if (currentWordIndex > totalWords) {
        endGameSession();
        return;
    }

    // Hide next word button when starting a fresh round
    const nextBtn = document.getElementById("hangman-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    // Filter out words already used in this session to prevent repetition
    let availableWords = wordBank.filter(w => !usedHangmanWords.includes(w));
    if (availableWords.length === 0) {
        usedHangmanWords = [];
        availableWords = [...wordBank];
    }

    // Select random word from available ones and record it
    secretWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedHangmanWords.push(secretWord);

    guessedLetters.clear();
    wrongErrors = 0;
    updateHangmanDrawing();
    updateWordDisplay();

    document.getElementById("hangman-round-info").innerText = `Parola ${currentWordIndex}/${totalWords}`;
    document.getElementById("hangman-errors-info").innerText = `Errori: 0/${maxErrors}`;
    
    const usedSpan = document.getElementById("hangman-used-letters");
    if (usedSpan) usedSpan.innerText = "Nessuna";

    startTurnTimer();
}

// Exposed function triggered by the streamer via the "Prossima Parola" button
export function nextHangmanWord() {
    currentWordIndex++;
    startNewHangmanRound();
}

// Start the turn timer for letter voting
function startTurnTimer() {
    timeLeft = 12;
    roundActive = true;
    userVotesThisTurn = {};
    updateHangmanStatus();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        const timerBadge = document.getElementById("hangman-timer-badge");
        if (timerBadge) {
            timerBadge.innerText = `⏱ ${timeLeft}s`;
            if (timeLeft <= 3) {
                timerBadge.classList.add("timer-warning");
            } else {
                timerBadge.classList.remove("timer-warning");
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processTurnResult();
        }
    }, 1000);
}

// Process votes when turn timer expires
function processTurnResult() {
    roundActive = false;
    const timerBadge = document.getElementById("hangman-timer-badge");
    if (timerBadge) timerBadge.classList.remove("timer-warning");

    let voteCounts = {};
    let votersPerLetter = {};

    Object.entries(userVotesThisTurn).forEach(([username, letter]) => {
        voteCounts[letter] = (voteCounts[letter] || 0) + 1;
        if (!votersPerLetter[letter]) votersPerLetter[letter] = [];
        votersPerLetter[letter].push(username);
    });

    let bestLetter = null;
    let maxVotes = 0;
    for (let [letter, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            bestLetter = letter;
        }
    }

    const feed = document.getElementById("hangman-chat-feed");
    const statusBox = document.getElementById("hangman-status");

    if (bestLetter && !guessedLetters.has(bestLetter)) {
        guessedLetters.add(bestLetter);
        const supportingUsers = votersPerLetter[bestLetter] || [];

        feed.innerHTML = `Lettera scelta dalla chat: <b style="color: #9146FF; font-size: 1.1em;">${bestLetter}</b> (${maxVotes} voti)`;

        if (secretWord.includes(bestLetter)) {
            // Reward users who voted for the correct letter
            const letterPoints = 5;
            supportingUsers.forEach(u => {
                userScores[u] = (userScores[u] || 0) + letterPoints;
            });

            updateWordDisplay();
            
            if (checkWin()) {
                const completionBonus = (maxErrors - wrongErrors) * 10 + 20;
                supportingUsers.forEach(u => {
                    userScores[u] = (userScores[u] || 0) + completionBonus;
                });

                if (statusBox) {
                    statusBox.innerHTML = `🎉 Parola completata! <b style="color: #00f3ff; font-size: 1.15em; text-shadow: 0 0 8px rgba(0,243,255,0.5);">${secretWord}</b>. (+Punti ai partecipanti!).`;
                }
                
                finishRoundOrProceed();
                return;
            }
        } else {
            wrongErrors++;
            document.getElementById("hangman-errors-info").innerText = `Errori: ${wrongErrors}/${maxErrors}`;
            updateHangmanDrawing();

            if (wrongErrors >= maxErrors) {
                if (statusBox) {
                    statusBox.innerHTML = `❌ Impiccato completato! La parola era: <b style="color: #00f3ff; font-size: 1.15em; text-shadow: 0 0 8px rgba(0,243,255,0.5);">${secretWord}</b>.`;
                }
                finishRoundOrProceed();
                return;
            }
        }
    } else {
        // Handle case when no valid letter was proposed/voted in time -> counts as an error
        wrongErrors++;
        document.getElementById("hangman-errors-info").innerText = `Errori: ${wrongErrors}/${maxErrors}`;
        updateHangmanDrawing();

        if (feed) feed.innerHTML = `⚠️ Nessuna proposta valida in tempo! Errore aggiunto.`;

        if (wrongErrors >= maxErrors) {
            if (statusBox) {
                statusBox.innerHTML = `❌ Impiccato completato! La parola era: <b style="color: #00f3ff; font-size: 1.15em; text-shadow: 0 0 8px rgba(0,243,255,0.5);">${secretWord}</b>.`;
            }
            finishRoundOrProceed();
            return;
        }
    }

    const usedSpan = document.getElementById("hangman-used-letters");
    if (usedSpan) {
        usedSpan.innerText = Array.from(guessedLetters).sort().join(", ") || "Nessuna";
    }

    if (roundActive === false && wrongErrors < maxErrors && !checkWin()) {
        setTimeout(startTurnTimer, 2000);
    }
}

// Handle round closure: pause game and let streamer decide when to advance
function finishRoundOrProceed() {
    roundActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const nextBtn = document.getElementById("hangman-next-btn");

    if (currentWordIndex < totalWords) {
        if (nextBtn) {
            nextBtn.classList.remove("hidden");
            nextBtn.innerText = `▶ PROSSIMA PAROLA (${currentWordIndex}/${totalWords})`;
        }
    } else {
        // All words completed, trigger final scoreboard after a brief pause
        setTimeout(() => {
            endGameSession();
        }, 1500);
    }
}

// Update the secret word display with underscores or revealed letters
function updateWordDisplay() {
    const displayArr = secretWord.split("").map(char => guessedLetters.has(char) ? char : "_");
    const wordDisplayEl = document.getElementById("hangman-word-display");
    if (wordDisplayEl) wordDisplayEl.innerText = displayArr.join(" ");
}

// Update hangman visual body parts based on error count
function updateHangmanDrawing() {
    const parts = [
        "part-head", "part-body", "part-arm-left", 
        "part-arm-right", "part-leg-left", "part-leg-right"
    ];

    parts.forEach((partId, idx) => {
        const el = document.getElementById(partId);
        if (el) {
            if (idx < wrongErrors) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        }
    });
}

// Check if all letters of the secret word have been guessed
function checkWin() {
    return secretWord.split("").every(char => guessedLetters.has(char));
}

// Update status display with current turn voting summary and highlighted command prompt
function updateHangmanStatus() {
    const statusBox = document.getElementById("hangman-status");
    if (!statusBox) return;

    let voteCounts = {};
    Object.values(userVotesThisTurn).forEach(l => {
        voteCounts[l] = (voteCounts[l] || 0) + 1;
    });

    let summary = Object.entries(voteCounts)
        .map(([l, c]) => `<b>${l}</b> (${c}v)`)
        .join(" | ");

    statusBox.innerHTML = summary ? `Voti turno: ${summary}` : `Scrivi in chat <span style="color: #00f3ff; font-weight: bold;">!h [lettera]</span> per votare!`;
}

// End the hangman session and display the final leaderboard
function endGameSession() {
    roundActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const statusBox = document.getElementById("hangman-status");
    const wordDisplay = document.getElementById("hangman-word-display");
    const nextBtn = document.getElementById("hangman-next-btn");
    
    if (wordDisplay) wordDisplay.innerText = "FINE GIOCO";
    if (nextBtn) nextBtn.classList.add("hidden");

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Fine Sessione - Classifica Impiccato 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
    if (sortedScores.length === 0) {
        leaderboardHtml += `<li>Nessun punto assegnato in questa sessione.</li>`;
    } else {
        sortedScores.forEach(([user, score], index) => {
            let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            leaderboardHtml += `<li style="margin-bottom: 5px;">${medal} <b>${user}</b>: ${score} punti</li>`;
        });
    }
    leaderboardHtml += `</ul>`;

    if (statusBox) {
        statusBox.innerHTML = leaderboardHtml;
    }
}