// js/wordle.js - Wordle mini-game module with timed voting rows and scoreboard

let WORDS_DICTIONARY = []; // Dynamically loaded from JSON

let secretWord = "";
let currentRow = 0;
let gameActive = false;
let currentRound = 1;
let totalRounds = 5;
let userScores = {}; 
let usedWords = [];  

// Voting and Timer state for the current row
let rowTimer = null;
let timeLeft = 15; // 15 seconds per row
let userVotesThisRow = {}; // Maps username -> word proposed in this row window
let isEvaluating = false; // Guard flag to prevent duplicate row evaluation races

// Initialize Wordle game by loading external JSON dictionary
export async function initWordle(customRounds) {
    totalRounds = parseInt(customRounds) || 5;
    currentRound = 1;
    userScores = {};
    usedWords = [];

    // Load words dictionary from external JSON if not already loaded
    if (WORDS_DICTIONARY.length === 0) {
        try {
            const response = await fetch('./js/data/wordle-data.json');
            const data = await response.json();
            WORDS_DICTIONARY = data.words || [];
        } catch (error) {
            console.error("Error loading wordle-data.json:", error);
            WORDS_DICTIONARY = ["TORRE", "MAREA", "FORNO", "SCALA", "BANCO"]; // Fallback backup words
        }
    }

    // Hide next round button initially during setup
    const nextBtn = document.getElementById("next-round-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    gameActive = true;
    startNewRound();
}

// Stop the Wordle game session and clear intervals
export function stopWordle() {
    gameActive = false;
    isEvaluating = false;
    if (rowTimer) clearInterval(rowTimer);
    const nextBtn = document.getElementById("next-round-btn");
    if (nextBtn) nextBtn.classList.add("hidden");
}

// Start a new round by picking a random secret word
function startNewRound() {
    if (currentRound > totalRounds) {
        endGameSession();
        return;
    }

    // Hide next round button when starting a fresh round
    const nextBtn = document.getElementById("next-round-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    let availableWords = WORDS_DICTIONARY.filter(w => !usedWords.includes(w));
    if (availableWords.length === 0) {
        usedWords = [];
        availableWords = [...WORDS_DICTIONARY];
    }
    
    secretWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    usedWords.push(secretWord);

    currentRow = 0;
    gameActive = true;
    isEvaluating = false;
    buildWordleBoard();
    startRowTimer();
}

// Exposed function triggered by the streamer via the "Prossima Manche" button
export function nextRound() {
    currentRound++;
    startNewRound();
}

// Start the 15-second voting window for the current row
function startRowTimer() {
    if (!gameActive) return;
    
    userVotesThisRow = {};
    timeLeft = 15;
    isEvaluating = false;
    if (rowTimer) clearInterval(rowTimer);

    updateStatusDisplay();
    updateRowHighlighting();

    rowTimer = setInterval(() => {
        timeLeft--;
        updateStatusDisplay();

        if (timeLeft <= 0) {
            clearInterval(rowTimer);
            evaluateRowVotes();
        }
    }, 1000);
}

// Highlight the current active row and remove highlight from others
function updateRowHighlighting() {
    for (let r = 0; r < 6; r++) {
        const rowElement = document.getElementById(`row-${r}`);
        if (!rowElement) continue;
        if (r === currentRow && gameActive) {
            rowElement.classList.add("active-row");
        } else {
            rowElement.classList.remove("active-row");
        }
    }
}

// Update status display targeting separate UI elements in the new HUD
function updateStatusDisplay() {
    const roundInfo = document.getElementById("round-info");
    const rowInfo = document.getElementById("row-info");
    const timerBadge = document.getElementById("timer-badge");
    const wordleStatus = document.getElementById("wordle-status");

    if (roundInfo) roundInfo.innerText = `Manche ${currentRound}/${totalRounds}`;
    if (rowInfo) rowInfo.innerText = `Riga ${currentRow + 1}/6`;

    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 5) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }

    if (wordleStatus && gameActive) {
        let wordCounts = {};
        Object.values(userVotesThisRow).forEach(w => {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        });

        let votesSummary = Object.entries(wordCounts)
            .map(([w, count]) => `<b>${w}</b> (${count}v)`)
            .join(" | ");

        wordleStatus.innerHTML = votesSummary ? `Proposte: ${votesSummary}` : `In attesa di proposte (<span style="color: #00f3ff; font-weight: bold;">!w [parola]</span>)...`;
    }
}

// Process incoming chat guess: register/update user's vote for the current row
export function processWordleGuess(word, user) {
    if (!gameActive || isEvaluating) return;

    userVotesThisRow[user] = word;
    updateStatusDisplay();
}

// Evaluate votes when the 15-second timer expires
function evaluateRowVotes() {
    if (!gameActive || isEvaluating) return;
    isEvaluating = true;

    if (rowTimer) clearInterval(rowTimer);

    let wordCounts = {};
    let votersPerWord = {}; 

    Object.entries(userVotesThisRow).forEach(([user, word]) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (!votersPerWord[word]) votersPerWord[word] = [];
        votersPerWord[word].push(user);
    });

    const wordleStatus = document.getElementById("wordle-status");
    const entries = Object.entries(wordCounts);

    if (entries.length === 0) {
        if (wordleStatus) {
            wordleStatus.innerHTML = `⚠️ Nessuna proposta ricevuta in tempo per questa riga!`;
        }
        proceedAfterRowEvaluation(null, null);
        return;
    }

    entries.sort((a, b) => b[1] - a[1]);
    const winningWord = entries[0][0];
    const supportingUsers = votersPerWord[winningWord];

    for (let c = 0; c < 5; c++) {
        const tile = document.getElementById(`tile-${currentRow}-${c}`);
        if (!tile) continue;
        tile.innerText = winningWord[c];

        if (winningWord[c] === secretWord[c]) {
            tile.classList.add("correct");
        } else if (secretWord.includes(winningWord[c])) {
            tile.classList.add("present");
        } else {
            tile.classList.add("absent");
        }
    }

    // Check if the chat found the secret word
    if (winningWord === secretWord) {
        let points = (6 - currentRow) * 10;
        
        supportingUsers.forEach(u => {
            userScores[u] = (userScores[u] || 0) + points;
        });

        let usersStr = supportingUsers.join(", ");
        if (wordleStatus) {
            wordleStatus.innerHTML = `🎉 Parola indovinata! Vinti <b>+${points}pt</b> da: <b>${usersStr}</b>.`;
        }
        finishRoundOrProceed(false);
        return;
    }

    proceedAfterRowEvaluation(winningWord, supportingUsers);
}

// Proceed to next row or trigger round completion if rows are exhausted
function proceedAfterRowEvaluation(winningWord, supportingUsers) {
    currentRow++;
    updateRowHighlighting();
    const wordleStatus = document.getElementById("wordle-status");

    if (currentRow === 6) {
        if (wordleStatus && winningWord !== secretWord) {
            wordleStatus.innerHTML = `❌ Tentativi esauriti! La parola era: <b style="color: #00f3ff; font-size: 1.15em; text-shadow: 0 0 8px rgba(0,243,255,0.5);">${secretWord}</b>.`;
        }
        finishRoundOrProceed(true);
    } else {
        startRowTimer();
    }
}

// Handle round closure: pause game and let streamer decide when to advance
function finishRoundOrProceed(isExhausted) {
    gameActive = false;
    if (rowTimer) clearInterval(rowTimer);

    // Remove active row highlight
    updateRowHighlighting();

    const nextBtn = document.getElementById("next-round-btn");

    // Check if there are still rounds left
    if (currentRound < totalRounds) {
        if (nextBtn) {
            nextBtn.classList.remove("hidden");
            // Customize text depending on whether rounds remain
            nextBtn.innerText = `▶ PROSSIMA MANCHE (${currentRound}/${totalRounds})`;
        }
    } else {
        // All rounds completed, trigger final scoreboard after a brief pause or immediately
        setTimeout(() => {
            endGameSession();
        }, 1500);
    }
}

// End the overall game session and render the final leaderboard
function endGameSession() {
    gameActive = false;
    if (rowTimer) clearInterval(rowTimer);

    const wordleStatus = document.getElementById("wordle-status");
    const grid = document.getElementById("grid");
    const nextBtn = document.getElementById("next-round-btn");
    
    if (grid) grid.innerHTML = "";
    if (nextBtn) nextBtn.classList.add("hidden");

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Fine Sessione - Classifica Chat 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
    if (sortedScores.length === 0) {
        leaderboardHtml += `<li>Nessun punto assegnato in questa sessione.</li>`;
    } else {
        sortedScores.forEach(([user, score], index) => {
            let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            leaderboardHtml += `<li style="margin-bottom: 5px;">${medal} <b>${user}</b>: ${score} punti</li>`;
        });
    }
    leaderboardHtml += `</ul>`;

    if (wordleStatus) {
        wordleStatus.innerHTML = leaderboardHtml;
    }
}

// Build the Wordle 6x5 grid DOM elements with explicit row IDs for highlighting
function buildWordleBoard() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let r = 0; r < 6; r++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "wordle-row";
        rowDiv.id = `row-${r}`; // Added explicit ID for row highlighting
        for (let c = 0; c < 5; c++) {
            const tileDiv = document.createElement("div");
            tileDiv.className = "wordle-tile";
            tileDiv.id = `tile-${r}-${c}`;
            rowDiv.appendChild(tileDiv);
        }
        grid.appendChild(rowDiv);
    }
}