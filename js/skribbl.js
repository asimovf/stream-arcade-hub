// js/skribbl.js - Skribbl mini-game module for Twitch chat 

let totalRounds = 3;
let currentRound = 1;
let secretWord = "";
let gameActive = false;
let userScores = {};
let usedWords = [];

let timeLeft = 45;
let timerInterval = null;
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let currentColor = "#000000";
let currentSize = 3;
let isEraserActive = false;
let showSecretWord = false;

let wordBankSkribbl = [];

// Load words dictionary from external JSON if not already loaded
async function loadSkribblDictionary() {
    if (wordBankSkribbl.length === 0) {
        try {
            const response = await fetch('./js/data/skribbl-data.json');
            const data = await response.json();
            wordBankSkribbl = data.words || [];
        } catch (error) {
            console.error("Error loading skribbl-data.json:", error);
            wordBankSkribbl = ["CASA", "ALBERO", "CHIAVE", "PIZZA", "CHITARRA", "ROBOT", "LIBRO", "COMPUTER", "TASTIERA", "GATTO"]; // Fallback backup words
        }
    }
}

// Initialize Skribbl event listeners and setup view
export function initSkribbl() {
    const startBtn = document.getElementById("start-skribbl-btn");
    const setupDiv = document.getElementById("skribbl-setup");
    const gameplayDiv = document.getElementById("skribbl-gameplay");
    const nextBtn = document.getElementById("skribbl-next-btn");

    if (nextBtn) {
        nextBtn.classList.add("hidden");
        nextBtn.onclick = async () => {
            currentRound++;
            await startNewSkribblRound();
        };
    }

    if (startBtn) {
        startBtn.onclick = async () => {
            const roundsInput = document.getElementById("skribbl-rounds-input");
            totalRounds = parseInt(roundsInput.value) || 3;
            currentRound = 1;
            userScores = {};
            usedWords = [];
            
            setupDiv.classList.add("hidden");
            gameplayDiv.classList.remove("hidden");

            setupCanvas();
            await startNewSkribblRound();
        };
    }
}

// Stop the Skribbl session and clear timers
export function stopSkribbl() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const nextBtn = document.getElementById("skribbl-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const gameplayDiv = document.getElementById("skribbl-gameplay");
    const setupDiv = document.getElementById("skribbl-setup");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
    if (setupDiv) setupDiv.classList.remove("hidden");
}

// Setup drawing canvas context and mouse/toolbar event handlers with precise scaling
function setupCanvas() {
    canvas = document.getElementById("skribbl-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    canvas.width = 680;
    canvas.height = 300;

    clearCanvasWhite();

    ctx.lineWidth = currentSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = currentColor;

    // Helper function to calculate precise mouse coordinates relative to canvas internal buffer
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    canvas.onmousedown = (e) => {
        if (!gameActive) return;
        isDrawing = true;
        const pos = getMousePos(e);
        [lastX, lastY] = [pos.x, pos.y];
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing || !gameActive) return;
        const pos = getMousePos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        [lastX, lastY] = [pos.x, pos.y];
    };

    canvas.onmouseup = () => isDrawing = false;
    canvas.onmouseout = () => isDrawing = false;

    // Color swatches management
    document.querySelectorAll(".swatch").forEach(btn => {
        btn.onclick = (e) => {
            isEraserActive = false;
            const eraserBtn = document.getElementById("skribbl-eraser-btn");
            if (eraserBtn) eraserBtn.classList.remove("active-tool");
            
            document.querySelectorAll(".swatch").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            
            currentColor = e.target.getAttribute("data-color");
            ctx.strokeStyle = currentColor;
        };
    });

    const colorPicker = document.getElementById("skribbl-color-picker");
    if (colorPicker) {
        colorPicker.oninput = (e) => {
            isEraserActive = false;
            currentColor = e.target.value;
            ctx.strokeStyle = currentColor;
        };
    }

    // Stroke size buttons
    document.querySelectorAll(".size-btn").forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentSize = parseInt(e.target.getAttribute("data-size"));
            ctx.lineWidth = currentSize;
        };
    });

    // Eraser tool
    const eraserBtn = document.getElementById("skribbl-eraser-btn");
    if (eraserBtn) {
        eraserBtn.onclick = () => {
            isEraserActive = !isEraserActive;
            if (isEraserActive) {
                eraserBtn.classList.add("active-tool");
                ctx.strokeStyle = "#ffffff"; 
            } else {
                eraserBtn.classList.remove("active-tool");
                ctx.strokeStyle = currentColor;
            }
        };
    }

    // Clear canvas button
    const clearBtn = document.getElementById("skribbl-clear-btn");
    if (clearBtn) {
        clearBtn.onclick = () => {
            clearCanvasWhite();
        };
    }
}

// Clear canvas with white background
function clearCanvasWhite() {
    if (ctx && canvas) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Start a new drawing round
async function startNewSkribblRound() {
    const nextBtn = document.getElementById("skribbl-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (currentRound > totalRounds) {
        endGameSession();
        return;
    }

    await loadSkribblDictionary();

    let available = wordBankSkribbl.filter(w => !usedWords.includes(w));
    if (available.length === 0) {
        usedWords = [];
        available = [...wordBankSkribbl];
    }

    secretWord = available[Math.floor(Math.random() * available.length)];
    usedWords.push(secretWord);
    gameActive = true;

    clearCanvasWhite();
    updateSkribblUI();
    startRoundTimer();
}

// Start round timer countdown
function startRoundTimer() {
    timeLeft = 45;
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processRoundTimeout();
        }
    }, 1000);
}

// Update timer badge display and warning state
function updateTimerDisplay() {
    const timerBadge = document.getElementById("skribbl-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 10) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Update UI elements for current round
function updateSkribblUI() {
    const roundInfo = document.getElementById("skribbl-round-info");
    const wordDisplay = document.getElementById("skribbl-word-display");
    const statusBox = document.getElementById("skribbl-status");

    if (roundInfo) roundInfo.innerText = `Manche ${currentRound}/${totalRounds}`;
    
    if (wordDisplay) {
        showSecretWord = false;
        
        wordDisplay.innerHTML = `
            Parola segreta: 
            <span id="secret-word-target" style="filter: blur(5px); background: #333; padding: 2px 8px; border-radius: 4px; transition: filter 0.2s; color: #fff;">${secretWord}</span>
            <button id="toggle-word-btn" class="secondary-btn" style="margin-left: 10px; padding: 2px 8px; font-size: 0.8em; cursor: pointer;">👁️ Mostra</button>
            <span style="font-size: 0.8em; color: #aaa; margin-left:15px;">(${secretWord.length} lettere)</span>
        `;

        const toggleBtn = document.getElementById("toggle-word-btn");
        const targetSpan = document.getElementById("secret-word-target");

        if (toggleBtn && targetSpan) {
            toggleBtn.onclick = () => {
                showSecretWord = !showSecretWord;
                if (showSecretWord) {
                    targetSpan.style.filter = "none";
                    targetSpan.style.color = "#00ffff";
                    targetSpan.style.fontWeight = "bold";
                    toggleBtn.innerText = "🙈 Nascondi";
                } else {
                    targetSpan.style.filter = "blur(5px)";
                    targetSpan.style.color = "#fff";
                    targetSpan.style.fontWeight = "normal";
                    toggleBtn.innerText = "👁️ Mostra";
                }
            };
        }
    }

    if (statusBox) {
        statusBox.innerHTML = `In attesa che la chat indovini...`;
    }
}

// Process incoming chat guesses
export function processSkribblGuess(guess, username) {
    if (!gameActive) return;

    const cleanGuess = guess.toUpperCase().trim();
    const feed = document.getElementById("skribbl-chat-feed");
    if (feed) {
        feed.innerText = `Ultimo tentativo (${username}): ${guess}`;
    }

    if (cleanGuess === secretWord) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        const points = timeLeft * 2 + 20;
        userScores[username] = (userScores[username] || 0) + points;

        const statusBox = document.getElementById("skribbl-status");
        if (statusBox) {
            statusBox.innerHTML = `🎉 <b style="color: #ffe600; text-shadow: 0 0 10px rgba(255,230,0,0.8);">${username}</b> ha indovinato la parola <b style="color: #00ffff; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${secretWord}</b>! (+${points} punti).`;
        }

        showNextButtonOrProceed();
    }
}

// Handle round timeout
function processRoundTimeout() {
    gameActive = false;
    const statusBox = document.getElementById("skribbl-status");
    if (statusBox) {
        statusBox.innerHTML = `⏰ Tempo scaduto! La parola era: <b style="color: #00ffff; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${secretWord}</b>.`;
    }

    showNextButtonOrProceed();
}

// Handle transition flow depending on whether it's the last round
function showNextButtonOrProceed() {
    const nextBtn = document.getElementById("skribbl-next-btn");
    if (currentRound >= totalRounds) {
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

// End session and display final leaderboard
function endGameSession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const nextBtn = document.getElementById("skribbl-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const statusBox = document.getElementById("skribbl-status");
    const wordDisplay = document.getElementById("skribbl-word-display");
    
    if (wordDisplay) wordDisplay.innerText = "SESSIONE SKRIBBL COMPLETATA";

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Fine Sessione - Classifica Skribbl 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
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