// js/nerd.js - Nerd & Physics Lab Game Logic

let totalRounds = 5;
let currentRound = 1;
let currentQuestion = null;
let gameActive = false;
let userScores = {};
let questionBank = [];
let usedQuestionIds = [];

let timeLeft = 25;
let timerInterval = null;

// Initialize Nerd Lab game session and load questions
export async function initNerd(rounds = 5) {
    totalRounds = parseInt(rounds) || 5;
    currentRound = 1;
    userScores = {};
    usedQuestionIds = [];

    const nextBtn = document.getElementById("nerd-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    try {
        const response = await fetch('./js/data/nerd-data.json');
        const data = await response.json();
        questionBank = data.questions;
        
        if (totalRounds > questionBank.length) {
            totalRounds = questionBank.length;
        }

        startNewNerdRound();
    } catch (error) {
        console.error("Error loading Nerd database:", error);
        const statusBox = document.getElementById("nerd-status");
        if (statusBox) statusBox.innerHTML = "❌ Error loading questions database!";
    }
}

// Stop Nerd Lab game session and clear timers
export function stopNerd() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const nextBtn = document.getElementById("nerd-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const setupDiv = document.getElementById("nerd-setup");
    const gameplayDiv = document.getElementById("nerd-gameplay");
    if (setupDiv) setupDiv.classList.remove("hidden");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
}

// Start a new round by picking a random unique question
function startNewNerdRound() {
    if (currentRound > totalRounds || questionBank.length === 0) {
        endNerdSession();
        return;
    }

    const nextBtn = document.getElementById("nerd-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    let available = questionBank.filter(q => !usedQuestionIds.includes(q.id));
    if (available.length === 0) {
        usedQuestionIds = [];
        available = [...questionBank];
    }

    currentQuestion = available[Math.floor(Math.random() * available.length)];
    usedQuestionIds.push(currentQuestion.id);

    gameActive = true;
    updateNerdUI();
    startNerdTimer();
}

// Exposed function triggered by the streamer via the "Prossima Manche" button
export function nextNerdRound() {
    currentRound++;
    startNewNerdRound();
}

// Start the 25-second question timer
function startNerdTimer() {
    timeLeft = 25;
    if (timerInterval) clearInterval(timerInterval);
    updateNerdTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateNerdTimerDisplay();

        // Reveal hint when 15 seconds remain
        if (timeLeft === 15 && currentQuestion && currentQuestion.hint) {
            const hintDisplay = document.getElementById("nerd-hint-display");
            if (hintDisplay) {
                hintDisplay.innerText = `💡 Indizio: ${currentQuestion.hint}`;
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processNerdTimeout();
        }
    }, 1000);
}

// Update timer badge visual state and warning pulse
function updateNerdTimerDisplay() {
    const timerBadge = document.getElementById("nerd-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 6) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Update UI elements for the current question
function updateNerdUI() {
    const roundInfo = document.getElementById("nerd-round-info");
    const questionDisplay = document.getElementById("nerd-question-display");
    const lengthDisplay = document.getElementById("nerd-length-display");
    const hintDisplay = document.getElementById("nerd-hint-display");
    const statusBox = document.getElementById("nerd-status");
    const chatFeed = document.getElementById("nerd-chat-feed");

    if (roundInfo) roundInfo.innerText = `Domanda ${currentRound}/${totalRounds}`;
    if (questionDisplay) questionDisplay.innerText = currentQuestion.question;

    // Generate letter mask (underscores for letters, spaces preserved)
    if (lengthDisplay && currentQuestion && currentQuestion.answer) {
        const cleanAns = currentQuestion.answer.trim();
        const mask = cleanAns.split("").map(char => char === " " ? " / " : "_").join(" ");
        lengthDisplay.innerText = `[ ${mask} ] (${cleanAns.length} lettere)`;
    }

    if (hintDisplay) hintDisplay.innerText = "";
    if (statusBox) statusBox.innerHTML = `In attesa della prima risposta in chat...`;
    if (chatFeed) chatFeed.innerText = `In ascolto di risposte per la domanda ${currentRound}...`;
}

// Process incoming chat answer guess
export function processNerdGuess(guess, username) {
    if (!gameActive || !currentQuestion) return;

    const cleanGuess = guess.trim().toUpperCase();
    const cleanCorrect = currentQuestion.answer.trim().toUpperCase();

    const chatFeed = document.getElementById("nerd-chat-feed");
    if (chatFeed) {
        chatFeed.innerText = `${username}: ${guess}`;
    }

    if (cleanGuess === cleanCorrect) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        const points = timeLeft * 10 + 50; 
        userScores[username] = (userScores[username] || 0) + points;

		const statusBox = document.getElementById("nerd-status");
        if (statusBox) {
            statusBox.innerHTML = `🎉 <b style="color: #ffe600; font-size: 1.25em; text-shadow: 0 0 14px rgba(255,230,0,0.9);">${username}</b> ha indovinato! Risposta: <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${currentQuestion.answer}</b> (+${points} pt).`;
        }
		
        finishRoundOrProceed();
    }
}

// Handle time expiration when no one guesses correctly
function processNerdTimeout() {
    gameActive = false;
    const statusBox = document.getElementById("nerd-status");
    if (statusBox) {
        statusBox.innerHTML = `⏰ Tempo scaduto! Nessuno ha indovinato. La risposta era: <b style="color: #00ffff; font-size: 1.15em; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${currentQuestion.answer}</b>.`;
    }

    finishRoundOrProceed();
}

// Handle round closure: pause game and let streamer decide when to advance
function finishRoundOrProceed() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const timerBadge = document.getElementById("nerd-timer-badge");
    if (timerBadge) timerBadge.classList.remove("timer-warning");

    const nextBtn = document.getElementById("nerd-next-btn");

    if (currentRound < totalRounds) {
        if (nextBtn) {
            nextBtn.classList.remove("hidden");
            nextBtn.innerText = `▶ PROSSIMA DOMANDA (${currentRound}/${totalRounds})`;
        }
    } else {
        // All rounds completed, trigger final leaderboard after a brief pause
        setTimeout(() => {
            endNerdSession();
        }, 1500);
    }
}

// End overall session and display final leaderboard
function endNerdSession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const statusBox = document.getElementById("nerd-status");
    const questionDisplay = document.getElementById("nerd-question-display");
    const hintDisplay = document.getElementById("nerd-hint-display");
    const chatFeed = document.getElementById("nerd-chat-feed");
    const nextBtn = document.getElementById("nerd-next-btn");
    
    if (questionDisplay) questionDisplay.innerText = "TEST COMPLETATO";
    if (hintDisplay) hintDisplay.innerText = "";
    if (chatFeed) chatFeed.innerText = "Sessione di gioco terminata.";
    if (nextBtn) nextBtn.classList.add("hidden");

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Classifica Nerd Lab 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
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