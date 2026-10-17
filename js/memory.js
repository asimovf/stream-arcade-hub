// js/memory.js - Memory Grid mini-module for Twitch chat

let gameActive = false;
let userScores = {};

let gridBoard = []; // Array of 16 cells { id, coord, symbol, revealed }
let pairsList = []; // Array of unique symbols to go through one by one
let currentPairIndex = 0;

let currentSymbol = null;
let referenceCoord = null;
let targetCoord = null;

let timeLeft = 15;
let timerInterval = null;
let roundVotes = {}; // Username -> guessed coordinate
let symbolStatus = {}; // Map symbol -> 'pending' | 'guessed' | 'missed'

const SYMBOLS = ['🚀', '💎', '⚡', '🐱', '🍕', '👾', '🔥', '⭐'];
const COLS = ['A', 'B', 'C', 'D'];
const ROWS = ['1', '2', '3', '4'];

// Initialize the memory game session
export function initMemory() {
    userScores = {};
    currentPairIndex = 0;
    startNewMemorySession();
}

// Stop the memory game and return to setup menu
export function stopMemory() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const setupDiv = document.getElementById("memory-setup");
    const gameplayDiv = document.getElementById("memory-gameplay");
    if (setupDiv) setupDiv.classList.remove("hidden");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
}

// Start a new game session, shuffle symbols and build the 4x4 grid (initially hidden)
function startNewMemorySession() {
    gameActive = false;
    roundVotes = {};
    currentPairIndex = 0;
    symbolStatus = {};

    // 1. Build and shuffle 8 symbol pairs (16 cells total)
    let selectedSymbols = [...SYMBOLS];
    selectedSymbols.sort(() => Math.random() - 0.5);
    let roundSymbols = selectedSymbols.slice(0, 8);
    
    pairsList = [...roundSymbols];
    pairsList.forEach(sym => {
        symbolStatus[sym] = 'pending';
    });

    let deck = [...roundSymbols, ...roundSymbols];
    deck.sort(() => Math.random() - 0.5);

    // 2. Map into 4x4 grid (A1 to D4), initially hidden
    gridBoard = [];
    let index = 0;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            let coord = COLS[c] + ROWS[r];
            gridBoard.push({
                id: index,
                coord: coord,
                symbol: deck[index],
                revealed: false // Initially hidden until streamer clicks to reveal
            });
            index++;
        }
    }

    updateMemoryUI();

    const targetDisplay = document.getElementById("memory-target-display");
    const statusBox = document.getElementById("memory-status");
    
    if (targetDisplay) targetDisplay.innerText = `👁️ Pronti per memorizzare la griglia?`;
    if (statusBox) {
        statusBox.innerHTML = `Clicca il pulsante per mostrare la griglia alla chat: <button id="reveal-initial-grid-btn" style="background: #9146FF; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 5px;">👁️ MOSTRA GRIGLIA</button>`;
    }

    setTimeout(() => {
        const revealBtn = document.getElementById("reveal-initial-grid-btn");
        if (revealBtn) {
            revealBtn.onclick = () => triggerInitialReveal();
        }
    }, 100);
}

// Streamer triggers the initial reveal of the grid for memorization
function triggerInitialReveal() {
    gridBoard.forEach(cell => {
        cell.revealed = true;
    });
    updateMemoryUI();

    const targetDisplay = document.getElementById("memory-target-display");
    const statusBox = document.getElementById("memory-status");
    
    if (targetDisplay) targetDisplay.innerText = `👁️ Memorizza la griglia!`;
    if (statusBox) {
        statusBox.innerHTML = `Griglia visibile per <span id="reveal-countdown" style="color: #00f3ff; font-weight: bold;">3</span>s...`;
    }

    let revealTime = 3;
    let revealInterval = setInterval(() => {
        revealTime--;
        const countEl = document.getElementById("reveal-countdown");
        if (countEl) countEl.innerText = revealTime;

        if (revealTime <= 0) {
            clearInterval(revealInterval);
            startNextPairTurn();
        }
    }, 1000);
}

// Start the turn for the next symbol pair
function startNextPairTurn() {
    if (currentPairIndex >= pairsList.length) {
        endMemorySession();
        return;
    }

    currentSymbol = pairsList[currentPairIndex];
    let matchingCells = gridBoard.filter(cell => cell.symbol === currentSymbol);
    
    referenceCoord = matchingCells[0].coord;
    targetCoord = matchingCells[1].coord;

    // Keep revealed the reference cell for this turn AND any already guessed/missed symbols from previous turns
    gridBoard.forEach(cell => {
        let status = symbolStatus[cell.symbol];
        cell.revealed = (cell.coord === referenceCoord) || (status === 'guessed' || status === 'missed');
    });

    gameActive = true;
    roundVotes = {};
    updateMemoryUI();

    const progressInfo = document.getElementById("memory-progress-info");
    if (progressInfo) progressInfo.innerText = `Coppia ${currentPairIndex + 1}/${pairsList.length}`;

    const targetDisplay = document.getElementById("memory-target-display");
    if (targetDisplay) {
        targetDisplay.innerHTML = `🔍 Trova l'altra coordinata per <span style="font-size: 1.2em; color: #00f3ff;">${currentSymbol}</span> (Riferimento a ${referenceCoord} visibile)`;
    }

    const statusBox = document.getElementById("memory-status");
    if (statusBox) {
        statusBox.innerHTML = `Scrivi in chat <b>!m [coordinate]</b> (es. <code>!m B3</code>)`;
    }

    startMemoryTimer();
}

// Start the countdown timer for the current turn
function startMemoryTimer() {
    timeLeft = 15;
    if (timerInterval) clearInterval(timerInterval);
    updateMemoryTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateMemoryTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            evaluatePairTurn();
        }
    }, 1000);
}

// Update the timer badge display and warning styles
function updateMemoryTimerDisplay() {
    const timerBadge = document.getElementById("memory-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 4) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Render the 4x4 grid board in the DOM with dynamic status indicators (check/cross)
function updateMemoryUI() {
    const gridEl = document.getElementById("memory-grid");

    if (gridEl) {
        let html = "";
        gridBoard.forEach(cell => {
            let bg = cell.revealed ? "rgba(0, 243, 255, 0.15)" : "rgba(13, 17, 28, 0.95)";
            let border = cell.revealed ? "1px solid #00f3ff" : "1px solid rgba(0, 243, 255, 0.3)";
            
            let displayContent = cell.symbol;
            if (cell.revealed) {
                let status = symbolStatus[cell.symbol];
                if (status === 'guessed') {
                    displayContent = '✅'; // Show checkmark if successfully guessed
                } else if (status === 'missed') {
                    displayContent = '❌'; // Show cross if missed or failed
                } else {
                    displayContent = cell.symbol; // Default emoji for active/reference items
                }
            } else {
                displayContent = `<span style="font-size: 0.9em; color: #8b9bb4; font-weight: bold;">${cell.coord}</span>`;
            }

            html += `<div style="background: ${bg}; border: ${border}; border-radius: 8px; height: 55px; display: flex; align-items: center; justify-content: center; font-size: 1.4em; position: relative; transition: all 0.2s;">
                <span style="font-size: 0.6em; color: #556077; position: absolute; top: 4px; left: 6px;">${cell.coord}</span>
                ${displayContent}
            </div>`;
        });
        gridEl.innerHTML = html;
    }
}

// Process chat guesses submitted via !m command
export function processMemoryGuess(guess, username) {
    if (!gameActive) return;

    const cleanGuess = guess.trim().toUpperCase();
    if (/^[A-D][1-4]$/.test(cleanGuess)) {
        if (cleanGuess === referenceCoord) return;

        roundVotes[username] = cleanGuess;

        const chatFeed = document.getElementById("memory-chat-feed");
        if (chatFeed) {
            chatFeed.innerText = `${username} ha puntato su [${cleanGuess}]`;
        }
    }
}

// Evaluate guesses when time expires for the current symbol pair
function evaluatePairTurn() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    let winners = [];
    Object.entries(roundVotes).forEach(([user, coord]) => {
        if (coord === targetCoord) {
            winners.push(user);
            const points = timeLeft * 4 + 20;
            userScores[user] = (userScores[user] || 0) + points;
        }
    });

    // Update symbol status based on whether it was guessed or missed
    if (winners.length > 0) {
        symbolStatus[currentSymbol] = 'guessed';
    } else {
        symbolStatus[currentSymbol] = 'missed';
    }

    // Temporarily reveal both cells for the evaluated symbol
    gridBoard.forEach(cell => {
        if (cell.symbol === currentSymbol) {
            cell.revealed = true;
        }
    });
    updateMemoryUI();

    // Check if this was the last pair in the session
    let isLastPair = (currentPairIndex >= pairsList.length - 1);

    const statusBox = document.getElementById("memory-status");
    if (statusBox) {
        let winnerText = winners.length > 0 ? `Coppia trovata da: <b>${winners.join(", ")}</b>` : `Nessuno ha indovinato in tempo!`;
        
        if (isLastPair) {
            statusBox.innerHTML = `✨ La coordinata era <b style="color: #00f3ff;">${targetCoord}</b> (${currentSymbol})!<br>${winnerText}<br><button id="end-game-btn" style="background: #9146FF; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px;">🏆 MOSTRA CLASSIFICA FINALE</button>`;
        } else {
            statusBox.innerHTML = `✨ La coordinata era <b style="color: #00f3ff;">${targetCoord}</b> (${currentSymbol})!<br>${winnerText}<br><button id="peek-grid-btn" style="background: #9146FF; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px;">👁️ MOSTRA GRIGLIA (PEEK)</button>`;
        }
    }

    // Bind action depending on whether it's the last pair or a normal intermediate pair
    setTimeout(() => {
        if (isLastPair) {
            const endBtn = document.getElementById("end-game-btn");
            if (endBtn) {
                endBtn.onclick = () => endMemorySession();
            }
        } else {
            const peekBtn = document.getElementById("peek-grid-btn");
            if (peekBtn) {
                peekBtn.onclick = () => triggerStreamerPeek();
            }
        }
    }, 100);
}

// Show the full grid temporarily for 3 seconds when requested by the streamer
function triggerStreamerPeek() {
    // Reveal the entire grid for the streamer's peek
    gridBoard.forEach(cell => {
        cell.revealed = true;
    });
    updateMemoryUI();

    const statusBox = document.getElementById("memory-status");
    if (statusBox) {
        statusBox.innerHTML = `👁️ Griglia visibile per <span id="peek-countdown" style="color: #00f3ff; font-weight: bold;">3</span>s...`;
    }

    let peekTime = 3;
    let peekInterval = setInterval(() => {
        peekTime--;
        const countEl = document.getElementById("peek-countdown");
        if (countEl) countEl.innerText = peekTime;

        if (peekTime <= 0) {
            clearInterval(peekInterval);
            currentPairIndex++;
            startNextPairTurn(); // Automatically hide grid again and move to next symbol
        }
    }, 1000);
}

// End the memory session and display the final leaderboard
function endMemorySession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    // Reveal the entire board at the end
    gridBoard.forEach(cell => cell.revealed = true);
    updateMemoryUI();

    const targetDisplay = document.getElementById("memory-target-display");
    const statusBox = document.getElementById("memory-status");
    const chatFeed = document.getElementById("memory-chat-feed");

    if (targetDisplay) targetDisplay.innerText = "PARTITA MEMORY COMPLETATA";
    if (chatFeed) chatFeed.innerText = "Tutti i simboli sono stati completati.";

    const sortedScoresArr = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Classifica Finale Memory Grid 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
    if (sortedScoresArr.length === 0) {
        leaderboardHtml += `<li>Nessun punto assegnato in questa sessione.</li>`;
    } else {
        sortedScoresArr.forEach(([user, score], index) => {
            let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            leaderboardHtml += `<li style="margin-bottom: 5px;">${medal} <b>${user}</b>: ${score} punti</li>`;
        });
    }
    leaderboardHtml += `</ul>`;

    if (statusBox) {
        statusBox.innerHTML = leaderboardHtml;
    }
}