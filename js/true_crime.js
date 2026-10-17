// true_crime.js - Procedural True Crime Minigame Logic for Twitch Chat
let crimeData = null;
let currentRound = 1;
let maxRounds = 3;
let timer = null;
let timeLeft = 30;
let currentCase = null;
let isGameActive = false;
let votes = { 1: 0, 2: 0, 3: 0, 4: 0 };
let voterHistory = new Map();
let userScores = {}; // Tracks user scores across rounds

const IMG_BASE_PATH = "js/data/imgs/";

// Fetch external JSON data safely to avoid browser import assertion errors
async function loadCrimeData() {
    if (crimeData) return;
    try {
        const response = await fetch('./js/data/true-crime-cases.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        crimeData = await response.json();
    } catch (error) {
        console.error("Error loading crime data:", error);
    }
}

// Helper to get a random item from an array
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to shuffle an array
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Helper to generate a random time string
function getRandomTime() {
    const hours = String(Math.floor(Math.random() * 4) + 1).padStart(2, '0');
    const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Generate a procedural case dynamically from the dataset
function generateNewCase(roundNum) {
    const loc = getRandomItem(crimeData.locations);
    const victimName = `${getRandomItem(crimeData.first_names)} ${getRandomItem(crimeData.last_names)}`;
    const victimRole = getRandomItem(crimeData.victim_roles).role;
    const victimImage = `${IMG_BASE_PATH}victim_1.png`;

    const shuffledRoles = shuffleArray(crimeData.suspect_roles);
    const selectedSuspectRoles = shuffledRoles.slice(0, 4);

    let usedNames = new Set();
    function getUniqueName() {
        let name;
        do {
            name = `${getRandomItem(crimeData.first_names)} ${getRandomItem(crimeData.last_names)}`;
        } while (usedNames.has(name));
        usedNames.add(name);
        return name;
    }

    const suspects = selectedSuspectRoles.map((s, idx) => {
        return {
            id: idx + 1,
            name: getUniqueName(),
            role: s.role,
            alibi: s.default_alibi,
            material: s.associated_material,
            tool: s.associated_tool,
            image: `${IMG_BASE_PATH}suspect_${idx + 1}.png`
        };
    });

    const culpritIndex = Math.floor(Math.random() * 4);
    const culprit = suspects[culpritIndex];

    const templateTypes = ['material_traces', 'digital_logs', 'physical_objects'];
    const chosenType = getRandomItem(templateTypes);
    const templateList = crimeData.evidence_templates[chosenType];
    let rawEvidence = getRandomItem(templateList);

    let evidenceText = rawEvidence
        .replace("{material}", culprit.material)
        .replace("{tool}", culprit.tool)
        .replace("{time}", getRandomTime());

    return {
        title: `Caso #${String(roundNum).padStart(2, '0')}: Presso ${loc.name}`,
        context: loc.context,
        victim: { name: victimName, role: victimRole, image: victimImage },
        evidenceType: chosenType,
        evidence: evidenceText,
        suspects: suspects,
        correctId: culprit.id,
        explanation: `Traces of ${culprit.material} and use of ${culprit.tool} incriminate suspect #${culprit.id} (${culprit.name})!`
    };
}

// Initialize the True Crime minigame session
export async function initTrueCrime(rounds) {
    await loadCrimeData();
    if (!crimeData) return;
    maxRounds = parseInt(rounds) || 3;
    currentRound = 1;
    userScores = {};
    isGameActive = true;
    
    // Expand container for gameplay UI
    document.getElementById("truecrime-container").classList.add("gameplay-active");
    
    loadCase();
}

// Stop the minigame and clear active timers
export function stopTrueCrime() {
    isGameActive = false;
    if (timer) clearInterval(timer);
    
    // Restore container to setup size
    const container = document.getElementById("truecrime-container");
    if (container) {
        container.classList.remove("gameplay-active");
    }
}

// Load current case data into the DOM
function loadCase() {
    if (!isGameActive || !crimeData) return;
    if (currentRound > maxRounds) {
        endGame();
        return;
    }

    votes = { 1: 0, 2: 0, 3: 0, 4: 0 };
    voterHistory.clear();

    currentCase = generateNewCase(currentRound);
    timeLeft = 30;

    document.getElementById("truecrime-round-info").innerText = `Caso ${currentRound}/${maxRounds}`;
    
    // Map evidence types to visual metadata and icons
    const evidenceMeta = {
        'material_traces': { label: 'Traccia Biologica / Materiale', icon: `${IMG_BASE_PATH}ev_material.png` },
        'digital_logs': { label: 'Registro Digitale', icon: `${IMG_BASE_PATH}ev_log.png` },
        'physical_objects': { label: 'Reperto sulla Scena', icon: `${IMG_BASE_PATH}ev_object.png` }
    };
    const currentEvMeta = evidenceMeta[currentCase.evidenceType] || evidenceMeta['material_traces'];

    document.getElementById("truecrime-case-display").innerHTML = `
        <div class="tc-victim-row">
            <img src="${currentCase.victim.image}" alt="Victim" class="tc-victim-img" />
            <div>
                <div class="tc-case-title">${currentCase.title}</div>
                <div class="tc-case-text"><b>Vittima:</b> ${currentCase.victim.name} (${currentCase.victim.role})</div>
            </div>
        </div>
        <div class="tc-evidence-box">
            <img src="${currentEvMeta.icon}" alt="Evidence Icon" class="tc-evidence-img" onerror="this.style.display='none'" />
            <div>
                <span class="tc-evidence-label">${currentEvMeta.label}</span>
                <span class="tc-evidence-desc">${currentCase.evidence}</span>
            </div>
        </div>
    `;
    
    const suspectsContainer = document.getElementById("truecrime-suspects-display");
    suspectsContainer.className = "tc-suspects-grid";

    // Render suspects with a unique card ID for easy DOM selection
    suspectsContainer.innerHTML = currentCase.suspects.map(s => `
        <div class="tc-suspect-card" id="tc-card-${s.id}">
            <img src="${s.image}" alt="Suspect ${s.id}" class="tc-suspect-img" />
            <div class="tc-suspect-info">
                <div class="tc-suspect-name">#${s.id} ${s.name}</div>
                <div class="tc-suspect-role">${s.role}</div>
                <div class="tc-suspect-alibi">"${s.alibi}"</div>
                <div class="tc-suspect-gear">
                    <div class="tc-gear-item tc-gear-tool">${s.tool}</div>
                    <div class="tc-gear-item tc-gear-material">${s.material}</div>
                </div>
            </div>
        </div>
    `).join('');
    
	document.getElementById("truecrime-status").innerHTML = `
		<div style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-family: 'Share Tech Mono', monospace; font-size: 1.05rem;">
			<span style="color: #ff70b5; font-weight: bold; letter-spacing: 1px;">VOTI:</span>
			<span style="background: rgba(0, 243, 255, 0.15); border: 1px solid #00f3ff; color: #00f3ff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#1: ${votes[1]}</span>
			<span style="background: rgba(255, 230, 0, 0.15); border: 1px solid #ffe600; color: #ffe600; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#2: ${votes[2]}</span>
			<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#3: ${votes[3]}</span>
			<span style="background: rgba(74, 222, 128, 0.15); border: 1px solid #4ade80; color: #4ade80; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#4: ${votes[4]}</span>
		</div>`;
	
    document.getElementById("truecrime-chat-feed").innerHTML = "Indagine avviata.";

    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        const timerBadge = document.getElementById("truecrime-timer-badge");
        if (timerBadge) timerBadge.innerText = `⏱ ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            evaluateRound();
        }
    }, 1000);
}

// Process incoming chat accusation command
export function processTrueCrimeAccusation(accusation, username) {
    if (!isGameActive) return;
    const voteNum = parseInt(accusation);
    if (voteNum < 1 || voteNum > 4) return;

    if (voterHistory.has(username)) {
        votes[voterHistory.get(username)]--;
    }
    voterHistory.set(username, voteNum);
    votes[voteNum]++;

    document.getElementById("truecrime-chat-feed").innerHTML = `<b>${username}</b> ➔ #${voteNum} | ` + document.getElementById("truecrime-chat-feed").innerHTML;
	document.getElementById("truecrime-status").innerHTML = `
		<div style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-family: 'Share Tech Mono', monospace; font-size: 1.05rem;">
			<span style="color: #ff70b5; font-weight: bold; letter-spacing: 1px;">VOTI:</span>
			<span style="background: rgba(0, 243, 255, 0.15); border: 1px solid #00f3ff; color: #00f3ff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#1: ${votes[1]}</span>
			<span style="background: rgba(255, 230, 0, 0.15); border: 1px solid #ffe600; color: #ffe600; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#2: ${votes[2]}</span>
			<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#3: ${votes[3]}</span>
			<span style="background: rgba(74, 222, 128, 0.15); border: 1px solid #4ade80; color: #4ade80; padding: 2px 8px; border-radius: 4px; font-weight: bold;">#4: ${votes[4]}</span>
		</div>`;	
}

// Evaluate votes at the end of the round timer and highlight the correct culprit card
function evaluateRound() {
    isGameActive = false; // Pause game input until streamer proceeds

    let totalVotes = 0;
    for (let i = 1; i <= 4; i++) {
        totalVotes += votes[i];
    }

    const culpritObj = currentCase.suspects.find(s => s.id === currentCase.correctId);
    let isCorrect = false;

    if (totalVotes > 0) {
        let winningSuspect = 1;
        let maxVotes = -1;
        for (let i = 1; i <= 4; i++) {
            if (votes[i] > maxVotes) {
                maxVotes = votes[i];
                winningSuspect = i;
            }
        }
        isCorrect = (winningSuspect === currentCase.correctId);

        // If chat guessed correctly, award points to users who voted for the correct suspect
        if (isCorrect) {
            voterHistory.forEach((votedSuspect, user) => {
                if (votedSuspect === currentCase.correctId) {
                    userScores[user] = (userScores[user] || 0) + 50;
                }
            });
        }
    }

    // Visually highlight the correct culprit card in the grid
    const culpritCard = document.getElementById(`tc-card-${currentCase.correctId}`);
    if (culpritCard) {
        culpritCard.style.border = "2px solid #2ecc71";
        culpritCard.style.boxShadow = "0 0 35px rgba(46, 204, 113, 0.85), inset 0 0 20px rgba(46, 204, 113, 0.35)";
        culpritCard.style.background = "rgba(46, 204, 113, 0.12)";
    }

    const statusBox = document.getElementById("truecrime-status");
    
    let resultHeader = totalVotes === 0 
        ? `<span style="color: #f39c12; font-size: 1.1em; font-weight: bold;">⏱️ TEMPO SCADUTO! Nessuna accusa ricevuta.</span>`
        : (isCorrect 
            ? `<span style="color: #2ecc71; font-size: 1.1em; font-weight: bold;">✅ ACCUSA CORRETTA! La chat ha incastrato il colpevole!</span>` 
            : `<span style="color: #e74c3c; font-size: 1.1em; font-weight: bold;">❌ ACCUSA ERRATA! La chat ha sbagliato bersaglio.</span>`);

    let isLastRound = currentRound >= maxRounds;
    let buttonText = isLastRound ? "🏆 MOSTRA CLASSIFICA FINALE" : "👉 PROSSIMO CASO";

    statusBox.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.95); border: 2px solid ${isCorrect && totalVotes > 0 ? '#2ecc71' : '#e74c3c'}; padding: 12px; border-radius: 6px; margin-top: 5px; text-align: center; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
            <div style="margin-bottom: 6px;">${resultHeader}</div>
            <div style="font-size: 1.05em; color: #fff; margin-bottom: 8px;">
                Il colpevole era: <b style="color: #00f3ff; font-size: 1.15em;">#${culpritObj.id} - ${culpritObj.name}</b> (${culpritObj.role})
            </div>
            <button id="tc-next-btn" style="background: #9146FF; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1em; box-shadow: 0 0 10px rgba(145, 70, 255, 0.5);">${buttonText}</button>
        </div>
    `;

    setTimeout(() => {
        const nextBtn = document.getElementById("tc-next-btn");
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (isLastRound) {
                    endGame();
                } else {
                    currentRound++;
                    isGameActive = true;
                    loadCase();
                }
            };
        }
    }, 100);
}

// Handle end of investigation session and display final leaderboard
function endGame() {
    isGameActive = false;
    const statusBox = document.getElementById("truecrime-status");
    const sortedScores = Object.entries(userScores).sort((a, b) => b[1] - a[1]);

    let leaderboardHtml = `<ul style="text-align: left; list-style: none; padding: 0; margin: 10px auto; display: inline-block;">`;
    if (sortedScores.length === 0) {
        leaderboardHtml += `<li>Nessun investigatore ha guadagnato punti in questa sessione.</li>`;
    } else {
        sortedScores.forEach(([user, score], index) => {
            let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            leaderboardHtml += `<li style="margin-bottom: 4px;">${medal} <b>${user}</b>: ${score} punti</li>`;
        });
    }
    leaderboardHtml += `</ul>`;

    statusBox.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.95); border: 2px solid #9146FF; padding: 12px; border-radius: 6px; text-align: center; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
            <h3 style="color: #9146FF; margin: 0 0 6px 0; font-size: 1.15em;">🏆 CLASSIFICA FINALE INVESTIGATORI 🏆</h3>
            ${leaderboardHtml}
        </div>
    `;
    document.getElementById("truecrime-chat-feed").innerHTML = "Sessione di indagine completata.";
}