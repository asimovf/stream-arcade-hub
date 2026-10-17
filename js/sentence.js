// js/sentence.js - Complete the Sentence Game Logic with manual streamer control and live highlights

let totalRounds = 5;
let currentRound = 1;
let currentItem = null;
let gameActive = false;
let userScores = {};
let sentenceBank = [];
let usedSentenceIds = [];

let timeLeft = 25;
let timerInterval = null;

// Initialize the sentence completion session
export async function initSentence(rounds = 5) {
    totalRounds = parseInt(rounds) || 5;
    currentRound = 1;
    userScores = {};
    usedSentenceIds = [];

    // Hide next round button initially
    const nextBtn = document.getElementById("sentence-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    try {
        const response = await fetch('./js/data/sentence-data.json');
        const data = await response.json();
        sentenceBank = data.sentences;
        
        if (totalRounds > sentenceBank.length) {
            totalRounds = sentenceBank.length;
        }

        startNewSentenceRound();
    } catch (error) {
        console.error("Error loading Sentence database:", error);
        const statusBox = document.getElementById("sentence-status");
        if (statusBox) statusBox.innerHTML = "❌ Error loading sentence database!";
    }
}

// Stop the sentence game session and reset UI
export function stopSentence() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const nextBtn = document.getElementById("sentence-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const setupDiv = document.getElementById("sentence-setup");
    const gameplayDiv = document.getElementById("sentence-gameplay");
    if (setupDiv) setupDiv.classList.remove("hidden");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
}

// Start a new round by picking an unused sentence
function startNewSentenceRound() {
    const nextBtn = document.getElementById("sentence-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (currentRound > totalRounds || sentenceBank.length === 0) {
        endSentenceSession();
        return;
    }

    let available = sentenceBank.filter(s => !usedSentenceIds.includes(s.id));
    if (available.length === 0) {
        usedSentenceIds = [];
        available = [...sentenceBank];
    }

    currentItem = available[Math.floor(Math.random() * available.length)];
    usedSentenceIds.push(currentItem.id);

    gameActive = true;
    updateSentenceUI();
    startSentenceTimer();
}

// Start the countdown timer for the current round
function startSentenceTimer() {
    timeLeft = 25;
    if (timerInterval) clearInterval(timerInterval);
    updateSentenceTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateSentenceTimerDisplay();

        // Reveal hint when 15 seconds remain
        if (timeLeft === 15 && currentItem && currentItem.hint) {
            const hintDisplay = document.getElementById("sentence-hint-display");
            if (hintDisplay) {
                hintDisplay.innerText = `💡 Indizio: ${currentItem.hint}`;
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processSentenceTimeout();
        }
    }, 1000);
}

// Update countdown timer badge display
function updateSentenceTimerDisplay() {
    const timerBadge = document.getElementById("sentence-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 6) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Update UI elements for the current round
function updateSentenceUI() {
    const roundInfo = document.getElementById("sentence-round-info");
    const sentenceDisplay = document.getElementById("sentence-text-display");
    const hintDisplay = document.getElementById("sentence-hint-display");
    const statusBox = document.getElementById("sentence-status");
    const chatFeed = document.getElementById("sentence-chat-feed");

    if (roundInfo) roundInfo.innerText = `Manche ${currentRound}/${totalRounds}`;
    
    if (sentenceDisplay && currentItem) {
        const answerLen = currentItem.answer.length;
        const underscores = Array(answerLen).fill('_').join('&nbsp;&nbsp;');
        const underscoresSpan = `<span style="color: #00f3ff; font-weight: bold; text-shadow: 0 0 8px rgba(0, 243, 255, 0.7);">${underscores}</span>`;
        
        let formattedText = currentItem.text.replace(/_+/g, underscoresSpan);
        
        sentenceDisplay.innerHTML = `<span style="font-size: 1.25em; line-height: 1.4; display: block; margin-bottom: 8px;">${formattedText}</span> <span style="font-size: 0.85em; color: #ff2a85; font-weight: bold; display: block; letter-spacing: 1.5px;">[ ${answerLen} lettere ]</span>`;
    }

    if (hintDisplay) hintDisplay.innerText = "";
    if (statusBox) statusBox.innerHTML = `In attesa della prima risposta in chat...`;
    if (chatFeed) chatFeed.innerText = `In ascolto di risposte per la manche ${currentRound}...`;
}

// Process incoming chat guess
export function processSentenceGuess(guess, username) {
    if (!gameActive || !currentItem) return;

    const cleanGuess = guess.trim().toUpperCase();
    const cleanCorrect = currentItem.answer.trim().toUpperCase();

    const chatFeed = document.getElementById("sentence-chat-feed");
    if (chatFeed) {
        chatFeed.innerText = `${username}: ${guess}`;
    }

    if (cleanGuess === cleanCorrect) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        const points = timeLeft * 10 + 50; 
        userScores[username] = (userScores[username] || 0) + points;

        const statusBox = document.getElementById("sentence-status");
        if (statusBox) {
            statusBox.innerHTML = `🎉 <b style="color: #ffe600; font-size: 1.25em; text-shadow: 0 0 14px rgba(255,230,0,0.9);">${username}</b> ha indovinato! Parola: <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${currentItem.answer}</b> (+${points} pt).`;
        }

        showNextButtonOrProceed();
    }
}

// Handle round timeout
function processSentenceTimeout() {
    gameActive = false;
    const statusBox = document.getElementById("sentence-status");
    if (statusBox) {
        statusBox.innerHTML = `⏰ Tempo scaduto! Nessuno ha indovinato. La parola era: <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${currentItem.answer}</b>.`;
    }

    showNextButtonOrProceed();
}

// Handle transition flow depending on whether it's the last round
function showNextButtonOrProceed() {
    const nextBtn = document.getElementById("sentence-next-btn");
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

// Triggered when streamer clicks the next round button
export function nextSentenceRound() {
    currentRound++;
    startNewSentenceRound();
}

// End session and display leaderboard
function endSentenceSession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const nextBtn = document.getElementById("sentence-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const statusBox = document.getElementById("sentence-status");
    const sentenceDisplay = document.getElementById("sentence-text-display");
    const hintDisplay = document.getElementById("sentence-hint-display");
    const chatFeed = document.getElementById("sentence-chat-feed");
    
    if (sentenceDisplay) sentenceDisplay.innerText = "SESSIONE COMPLETATA";
    if (hintDisplay) hintDisplay.innerText = "";
    if (chatFeed) chatFeed.innerText = "Sessione di gioco terminata.";

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Classifica Completa la Frase 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
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