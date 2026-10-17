// js/quiz.js - Trivia Lab mini-module with bulletproof anti-repetition check

let selectedCategories = [];
let totalRounds = 10;
let currentRound = 1;
let currentQuestion = null;
let gameActive = false;
let userScores = {};
let questionBank = [];

let usedQuestionIndices = new Set();
let usedQuestionTexts = new Set();

let timeLeft = 20;
let timerInterval = null;
let roundVotes = {}; // username -> chosen option index (0-3)

// Initialize the trivia quiz session with selected categories and rounds
export async function initQuiz(categories = [], rounds = 10) {
    selectedCategories = categories;
    totalRounds = parseInt(rounds) || 10;
    currentRound = 1;
    userScores = {};
    usedQuestionIndices.clear();
    usedQuestionTexts.clear();
    questionBank = [];

    // Hide next button initially
    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (!selectedCategories || selectedCategories.length === 0) {
        console.error("Nessuna categoria selezionata per il Trivia!");
        return;
    }

    try {
        // Fetch JSON files of selected categories in parallel
        const fetchPromises = selectedCategories.map(catKey => 
            fetch(`./js/data/trivia/${catKey}.json`).then(res => res.json())
        );

        const results = await Promise.all(fetchPromises);
        
        // Merge all questions from chosen categories into a single pool with category tag
        results.forEach((data, index) => {
            const catKey = selectedCategories[index];
            if (data && data.questions) {
                data.questions.forEach(q => {
                    questionBank.push({ ...q, _category: catKey });
                });
            }
        });

        if (questionBank.length === 0) {
            throw new Error("Nessuna domanda trovata nelle categorie selezionate.");
        }

        // Shuffle question pool for variety
        questionBank.sort(() => Math.random() - 0.5);

        if (totalRounds > questionBank.length) {
            totalRounds = questionBank.length;
        }

        startNewQuizRound();
    } catch (error) {
        console.error("Errore nel caricamento dei database Trivia:", error);
        const statusBox = document.getElementById("quiz-status");
        if (statusBox) statusBox.innerHTML = `❌ Errore nel caricamento delle categorie selezionate!`;
    }
}

// Stop the quiz session and clear timers
export function stopQuiz() {
    if (timerInterval) clearInterval(timerInterval);
    gameActive = false;
    
    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const setupDiv = document.getElementById("quiz-setup");
    const gameplayDiv = document.getElementById("quiz-gameplay");
    if (setupDiv) setupDiv.classList.remove("hidden");
    if (gameplayDiv) gameplayDiv.classList.add("hidden");
}

// Start a new round by picking an unused question based on unique pool index and text
function startNewQuizRound() {
    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    if (currentRound > totalRounds || questionBank.length === 0) {
        endQuizSession();
        return;
    }

    // Filter available indices that haven't been used yet in this session
    let availableIndices = [];
    questionBank.forEach((q, idx) => {
        if (!usedQuestionIndices.has(idx) && !usedQuestionTexts.has(q.text)) {
            availableIndices.push(idx);
        }
    });

    // Safety fallback if all questions were somehow exhausted
    if (availableIndices.length === 0) {
        usedQuestionIndices.clear();
        usedQuestionTexts.clear();
        questionBank.forEach((q, idx) => availableIndices.push(idx));
    }

    const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    currentQuestion = questionBank[randomIdx];
    
    // Mark as used
    usedQuestionIndices.add(randomIdx);
    usedQuestionTexts.add(currentQuestion.text);

    gameActive = true;
    roundVotes = {};
    updateQuizUI();
    startQuizTimer();
}

// Start the countdown timer for the current question
function startQuizTimer() {
    timeLeft = 20;
    if (timerInterval) clearInterval(timerInterval);
    updateQuizTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateQuizTimerDisplay();

        if (timeLeft === 10 && currentQuestion && currentQuestion.hint) {
            const hintDisplay = document.getElementById("quiz-hint-display");
            if (hintDisplay) {
                hintDisplay.innerText = `💡 Indizio: ${currentQuestion.hint}`;
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            evaluateQuizRound();
        }
    }, 1000);
}

// Update timer badge display and warning styles
function updateQuizTimerDisplay() {
    const timerBadge = document.getElementById("quiz-timer-badge");
    if (timerBadge) {
        timerBadge.innerText = `⏱ ${timeLeft}s`;
        if (timeLeft <= 5) {
            timerBadge.classList.add("timer-warning");
        } else {
            timerBadge.classList.remove("timer-warning");
        }
    }
}

// Update quiz UI elements with question text and options
function updateQuizUI() {
    const roundInfo = document.getElementById("quiz-round-info");
    const questionDisplay = document.getElementById("quiz-text-display");
    const optionsDisplay = document.getElementById("quiz-options-display");
    const hintDisplay = document.getElementById("quiz-hint-display");
    const statusBox = document.getElementById("quiz-status");
    const chatFeed = document.getElementById("quiz-chat-feed");

    if (roundInfo) roundInfo.innerText = `Domanda ${currentRound}/${totalRounds}`;
    
    if (questionDisplay && currentQuestion) {
        questionDisplay.innerHTML = `<span style="font-size: 1.15em; color: #fff; font-weight: bold;">${currentQuestion.text}</span>`;
    }

    if (optionsDisplay && currentQuestion) {
        let html = "";
        currentQuestion.options.forEach((opt, idx) => {
            html += `<div class="quiz-option-item">[${idx + 1}] ${opt}</div>`;
        });
        optionsDisplay.innerHTML = html;
    }

    if (hintDisplay) hintDisplay.innerText = "";
    if (statusBox) statusBox.innerHTML = `Scrivi in chat <b>!q [1-4]</b> per votare la risposta!`;
    if (chatFeed) chatFeed.innerText = `In attesa di risposte per la domanda ${currentRound}...`;
}

// Process incoming chat guess for the trivia question
export function processQuizGuess(guess, username) {
    if (!gameActive || !currentQuestion) return;

    const cleanGuess = guess.trim();
    let selectedIndex = -1;

    if (/^[1-4]$/.test(cleanGuess)) {
        selectedIndex = parseInt(cleanGuess) - 1;
    } else {
        const optIndex = currentQuestion.options.findIndex(opt => opt.toLowerCase() === cleanGuess.toLowerCase());
        if (optIndex !== -1) selectedIndex = optIndex;
    }

    if (selectedIndex !== -1 && selectedIndex >= 0 && selectedIndex < currentQuestion.options.length) {
        roundVotes[username] = selectedIndex;

        const chatFeed = document.getElementById("quiz-chat-feed");
        if (chatFeed) {
            chatFeed.innerText = `${username} ha votato l'opzione [${selectedIndex + 1}]`;
        }
    }
}

// Evaluate votes when the timer expires for the current question
function evaluateQuizRound() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);
    const statusBox = document.getElementById("quiz-status");

    let correctOptText = currentQuestion.answer.trim().toLowerCase();
    let correctIndex = currentQuestion.options.findIndex(opt => opt.toLowerCase() === correctOptText);
    if (correctIndex === -1) correctIndex = 0; 

    let winners = [];
    Object.entries(roundVotes).forEach(([user, chosenIdx]) => {
        if (chosenIdx === correctIndex) {
            winners.push(`<b style="color: #ffe600; text-shadow: 0 0 10px rgba(255,230,0,0.8);">${user}</b>`);
            const points = timeLeft * 5 + 20;
            userScores[user] = (userScores[user] || 0) + points;
        }
    });

    if (statusBox) {
        let winnerText = winners.length > 0 ? `Hanno indovinato: ${winners.join(", ")}` : `Nessuno ha indovinato in tempo!`;
        statusBox.innerHTML = `✨ Risposta esatta: <b style="color: #00ffff; text-shadow: 0 0 10px rgba(0,243,255,0.8);">${currentQuestion.options[correctIndex]}</b><br>${winnerText}`;
    }

    showNextButtonOrProceed();
}

// Handle transition flow depending on whether it's the last round
function showNextButtonOrProceed() {
    const nextBtn = document.getElementById("quiz-next-btn");
    if (currentRound >= totalRounds) {
        if (nextBtn) {
            nextBtn.innerText = "🏆 VISUALIZZA CLASSIFICA";
            nextBtn.classList.remove("hidden");
        }
    } else {
        if (nextBtn) {
            nextBtn.innerText = "▶ PROSSIMA DOMANDA";
            nextBtn.classList.remove("hidden");
        }
    }
}

// Triggered when streamer clicks the next question button
export function nextQuizRound() {
    currentRound++;
    startNewQuizRound();
}

// End the quiz session and display final leaderboard
function endQuizSession() {
    gameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) nextBtn.classList.add("hidden");

    const statusBox = document.getElementById("quiz-status");
    const questionDisplay = document.getElementById("quiz-text-display");
    const optionsDisplay = document.getElementById("quiz-options-display");
    const hintDisplay = document.getElementById("quiz-hint-display");
    const chatFeed = document.getElementById("quiz-chat-feed");
    
    if (questionDisplay) questionDisplay.innerText = "SESSIONE TRIVIA COMPLETATA";
    if (optionsDisplay) optionsDisplay.innerHTML = "";
    if (hintDisplay) hintDisplay.innerText = "";
    if (chatFeed) chatFeed.innerText = "Sessione di gioco terminata.";

    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);
    
    let leaderboardHtml = `<h3>🏆 Classifica Finale Trivia Lab 🏆</h3><br><ul style="text-align: left; list-style: none; padding: 0; margin: 0 auto; display: inline-block;">`;
    
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