// js/battleship.js - Battleship mini-game module for Twitch chat with manual streamer control

let gridRows = ['A', 'B', 'C', 'D', 'E', 'F'];
let gridCols = [1, 2, 3, 4, 5, 6];

let hiddenFleet = [];  
let hitShots = new Set();
let missedShots = new Set();

let gameActive = false;
let currentRound = 1;
let totalRounds = 5;
let userScores = {};

let roundTimer = null;
let timeLeft = 15;
let userVotesThisRound = {}; 

// Initialize Battleship game session and round count
export function initBattleship(customRounds) {
    totalRounds = parseInt(customRounds) || 5;
    currentRound = 1;
    userScores = {};

    // Hide next button initially
    const nextBtn = document.getElementById("battleship-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    startNewBattle();
}

// Stop the battleship game session and clear active timers
export function stopBattleship() {
    gameActive = false;
    if (roundTimer) clearInterval(roundTimer);

    const nextBtn = document.getElementById("battleship-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");
}

// Start a new battle round or end session if rounds are completed
function startNewBattle() {
    const nextBtn = document.getElementById("battleship-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (currentRound > totalRounds) {
        endBattleshipSession();
        return;
    }

    hitShots.clear();
    missedShots.clear();
    generateFleet();
    
    gameActive = true;
    buildBattleshipBoard();
    startRoundTimer();
}

// Generate enemy fleet with minimum 1-cell distance spacing rule
function generateFleet() {
    hiddenFleet = [];
    const shipLengths = [3, 2, 2];

    for (let len of shipLengths) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 300) {
            attempts++;
            const isVertical = Math.random() < 0.5;
            let candidateCoords = [];
            let valid = true;

            if (isVertical) {
                const startRowIdx = Math.floor(Math.random() * (gridRows.length - len + 1));
                const col = gridCols[Math.floor(Math.random() * gridCols.length)];
                for (let i = 0; i < len; i++) {
                    candidateCoords.push(gridRows[startRowIdx + i] + col);
                }
            } else {
                const row = gridRows[Math.floor(Math.random() * gridRows.length)];
                const startColIdx = Math.floor(Math.random() * (gridCols.length - len + 1));
                for (let i = 0; i < len; i++) {
                    candidateCoords.push(row + gridCols[startColIdx + i]);
                }
            }

            // Verify overlaps and minimum distance rules from other ships
            for (let coord of candidateCoords) {
                if (hiddenFleet.includes(coord)) {
                    valid = false;
                    break;
                }
                const rIdx = gridRows.indexOf(coord[0]);
                const cIdx = gridCols.indexOf(parseInt(coord[1]));

                // Check surrounding 8 cells
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = rIdx + dr;
                        const nc = cIdx + dc;
                        if (nr >= 0 && nr < gridRows.length && nc >= 0 && nc < gridCols.length) {
                            const neighbor = gridRows[nr] + gridCols[nc];
                            if (hiddenFleet.includes(neighbor)) {
                                valid = false;
                                break;
                            }
                        }
                    }
                    if (!valid) break;
                }
                if (!valid) break;
            }

            if (valid) {
                hiddenFleet.push(...candidateCoords);
                placed = true;
            }
        }

        // Safety fallback in case space is heavily saturated
        if (!placed) {
            let fallbackPlaced = false;
            let fbAttempts = 0;
            while (!fallbackPlaced && fbAttempts < 100) {
                fbAttempts++;
                const isVertical = Math.random() < 0.5;
                let candidateCoords = [];
                let valid = true;

                if (isVertical) {
                    const startRowIdx = Math.floor(Math.random() * (gridRows.length - len + 1));
                    const col = gridCols[Math.floor(Math.random() * gridCols.length)];
                    for (let i = 0; i < len; i++) {
                        candidateCoords.push(gridRows[startRowIdx + i] + col);
                    }
                } else {
                    const row = gridRows[Math.floor(Math.random() * gridRows.length)];
                    const startColIdx = Math.floor(Math.random() * (gridCols.length - len + 1));
                    for (let i = 0; i < len; i++) {
                        candidateCoords.push(row + gridCols[startColIdx + i]);
                    }
                }

                for (let coord of candidateCoords) {
                    if (hiddenFleet.includes(coord)) {
                        valid = false;
                        break;
                    }
                }

                if (valid) {
                    hiddenFleet.push(...candidateCoords);
                    fallbackPlaced = true;
                    placed = true;
                }
            }
        }
    }
}

// Start the round countdown timer for chat coordinate voting
function startRoundTimer() {
    if (!gameActive) return;

    userVotesThisRound = {};
    timeLeft = 15;
    if (roundTimer) clearInterval(roundTimer);

    updateBattleshipStatus();

    roundTimer = setInterval(() => {
        timeLeft--;
        updateBattleshipStatus();

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            evaluateRoundVotes();
        }
    }, 1000);
}

// Update UI status bar and voting summary with neon highlights
function updateBattleshipStatus() {
    const roundInfo = document.getElementById("bs-round-info");
    const timerBadge = document.getElementById("bs-timer-badge");
    const statusMsg = document.getElementById("bs-status");

    if (roundInfo) roundInfo.innerText = `Battaglia ${currentRound}/${totalRounds}`;
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 5) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }

    if (statusMsg) {
        let coordCounts = {};
        Object.values(userVotesThisRound).forEach(coord => {
            coordCounts[coord] = (coordCounts[coord] || 0) + 1;
        });

        let summary = Object.entries(coordCounts)
            .map(([coord, count]) => `<b>${coord}</b> (${count}v)`)
            .join(" | ");

        const totalParts = hiddenFleet.length;
        const hitParts = hitShots.size;
        const fleetInfo = `⚓ <b>Flotta Nemica:</b> 1x (3) + 2x (2) | Centrati: <b>${hitParts}/${totalParts}</b>`;
        
        let votingText = summary ? `Proposte di fuoco: ${summary}` : `In attesa di coordinate <span style="color: #00f3ff; font-weight: bold;">!b [es. A3]</span>...`;
        
        statusMsg.innerHTML = `<div style="font-size: 0.82em; color: #a855f7; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 4px;">${fleetInfo}</div>${votingText}`;
    }
}

// Process incoming chat guess for coordinates
export function processBattleshipGuess(coord, username) {
    if (!gameActive) return;
    
    coord = coord.toUpperCase();
    if (gridRows.includes(coord[0]) && gridCols.includes(parseInt(coord[1]))) {
        userVotesThisRound[username] = coord;
        updateBattleshipStatus();
    }
}

// Evaluate chat votes when round timer expires
function evaluateRoundVotes() {
    if (!gameActive) return;

    let coordCounts = {};
    let votersPerCoord = {};

    Object.entries(userVotesThisRound).forEach(([user, coord]) => {
        coordCounts[coord] = (coordCounts[coord] || 0) + 1;
        if (!votersPerCoord[coord]) votersPerCoord[coord] = [];
        votersPerCoord[coord].push(user);
    });

    const statusMsg = document.getElementById("bs-status");
    const entries = Object.entries(coordCounts);

    if (entries.length === 0) {
        if (statusMsg) statusMsg.innerHTML = `⚠️ Nessun colpo sparato in tempo in questo turno!`;
        setTimeout(proceedNextTurn, 3000);
        return;
    }

    entries.sort((a, b) => b[1] - a[1]);
    const winningCoord = entries[0][0];
    const shooters = votersPerCoord[winningCoord];

    let hitResult = false;
    if (hiddenFleet.includes(winningCoord)) {
        hitShots.add(winningCoord);
        hitResult = true;
        
        shooters.forEach(u => {
            userScores[u] = (userScores[u] || 0) + 25;
        });
    } else {
        missedShots.add(winningCoord);
    }

    buildBattleshipBoard();

    const allSunk = hiddenFleet.every(pos => hitShots.has(pos));

    if (allSunk) {
        if (statusMsg) {
            let shooterNames = shooters.map(u => `<b style="color: #ffe600; text-shadow: 0 0 10px rgba(255,230,0,0.8);">${u}</b>`).join(", ");
            statusMsg.innerHTML = `🎉 Intera flotta nemica affondata a <b style="color: #00ffff; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${winningCoord}</b> da ${shooterNames}!`;
        }
        gameActive = false;
        if (roundTimer) clearInterval(roundTimer);
        showNextButtonOrProceed();
        return;
    }

    if (statusMsg) {
        let hitParts = hitShots.size;
        let totalParts = hiddenFleet.length;
        let shooterNames = shooters.map(u => `<b style="color: #ffe600; text-shadow: 0 0 10px rgba(255,230,0,0.8);">${u}</b>`).join(", ");
        statusMsg.innerHTML = hitResult 
            ? `💥 <b>Colpito a <span style="color: #00ffff; text-shadow: 0 0 8px rgba(0,243,255,0.7);">${winningCoord}</span>!</b> (Centrati: ${hitParts}/${totalParts}) [Fuoco di: ${shooterNames}]` 
            : `💧 <b>Acqua a ${winningCoord}!</b> Bersaglio mancato.`;
    }

    setTimeout(proceedNextTurn, 3500);
}

// Proceed to next turn if game is still active
function proceedNextTurn() {
    if (!gameActive) return;
    startRoundTimer();
}

// Handle transition flow depending on whether it's the last round
function showNextButtonOrProceed() {
    const nextBtn = document.getElementById("battleship-next-btn");
    if (currentRound >= totalRounds) {
        if (nextBtn) {
            nextBtn.innerText = "🏆 VISUALIZZA CLASSIFICA";
            nextBtn.classList.remove("hidden");
        }
    } else {
        if (nextBtn) {
            nextBtn.innerText = "▶ PROSSIMA BATTAGLIA";
            nextBtn.classList.remove("hidden");
        }
    }
}

// Triggered when streamer clicks the next battle button
export function nextBattleshipRound() {
    currentRound++;
    startNewBattle();
}

// Render the 6x6 battleship grid board in the DOM
function buildBattleshipBoard() {
    const gridEl = document.getElementById("bs-grid");
    if (!gridEl) return;

    gridEl.innerHTML = "";

    const corner = document.createElement("div");
    gridEl.appendChild(corner);

    gridCols.forEach(col => {
        const colHeader = document.createElement("div");
        colHeader.innerText = col;
        colHeader.style.textAlign = "center";
        colHeader.style.fontWeight = "bold";
        colHeader.style.color = "#00f3ff"; 
        colHeader.style.fontSize = "1.1em";
        colHeader.style.fontFamily = "'Share Tech Mono', monospace";
        gridEl.appendChild(colHeader);
    });

    gridRows.forEach(row => {
        const rowHeader = document.createElement("div");
        rowHeader.innerText = row;
        rowHeader.style.textAlign = "center";
        rowHeader.style.fontWeight = "bold";
        rowHeader.style.color = "#00f3ff"; 
        rowHeader.style.fontSize = "1.1em";
        rowHeader.style.fontFamily = "'Share Tech Mono', monospace";
        gridEl.appendChild(rowHeader);

        gridCols.forEach(col => {
            const coord = row + col;
            const cell = document.createElement("div");
            cell.id = `bs-cell-${coord}`;
            cell.style.width = "50px";
            cell.style.height = "50px";
            cell.style.background = "rgba(13, 17, 28, 0.95)";
            cell.style.border = "1px solid rgba(0, 243, 255, 0.35)";
            cell.style.borderRadius = "6px";
            cell.style.display = "flex";
            cell.style.alignItems = "center";
            cell.style.justifyContent = "center";
            cell.style.boxSizing = "border-box";

            if (hitShots.has(coord)) {
                cell.innerText = "💥";
                cell.style.background = "rgba(255, 42, 133, 0.35)";
                cell.style.borderColor = "#ff2a85";
                cell.style.boxShadow = "0 0 10px rgba(255, 42, 133, 0.6)";
                cell.style.fontSize = "1.4em";
            } else if (missedShots.has(coord)) {
                cell.innerText = "💧";
                cell.style.background = "rgba(0, 243, 255, 0.25)";
                cell.style.borderColor = "#00f3ff";
                cell.style.boxShadow = "0 0 10px rgba(0, 243, 255, 0.5)";
                cell.style.fontSize = "1.4em";
            } else {
                cell.innerText = coord;
                cell.style.fontSize = "0.95em";
                cell.style.color = "#9fb3c8";
                cell.style.fontWeight = "bold";
                cell.style.fontFamily = "'Share Tech Mono', monospace";
            }

            gridEl.appendChild(cell);
        });
    });
}

// End the battleship session and display the final leaderboard
function endBattleshipSession() {
    gameActive = false;
    if (roundTimer) clearInterval(roundTimer);

    const nextBtn = document.getElementById("battleship-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const statusMsg = document.getElementById("bs-status");
    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);

    let html = `<h3>🏆 Classifica Finale Battaglia Navale 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    if (sortedScores.length === 0) {
        html += `<li>Nessun punto registrato in questa sessione.</li>`;
    } else {
        sortedScores.forEach(([user, score], idx) => {
            let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔹";
            html += `<li style="margin-bottom: 5px;">${medal} <b style="color: #ffe600;">${user}</b>: ${score} punti</li>`;
        });
    }
    html += `</ul>`;

    if (statusMsg) statusMsg.innerHTML = html;
}