// ------------------------------------------------
// GLOBÁLNE PREMENNÉ PRE ČASOVAČ
// ------------------------------------------------
let timerInterval;
let timeRemaining = 0; 
let timerDisplayElement; 

// ------------------------------------------------
// PÔVODNÉ GLOBÁLNE PREMENNÉ A KÓD
// ------------------------------------------------
let allQuestionsObject = {}; // { kategória: [otázky] }
let currentQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswerIndex = -1;
let isAnswerChecked = false;

let correctAnswersCount = 0;
let totalQuestionsAnswered = 0;
let incorrectAnswersList = []; 

const QUESTIONS_PER_TEST = Infinity; 

const questions_url = 'questions.json';
// Zabezpečenie, že DOM prvky sú nájdené až po načítaní:
let questionText;
let optionsContainer;
let checkButton;
let feedbackArea;


// --- Iniciačný kód pre časovač a načítanie ---
document.addEventListener('DOMContentLoaded', () => {
    // 0. Inicializácia DOM prvkov
    questionText = document.getElementById('question-text');
    optionsContainer = document.getElementById('options-container');
    checkButton = document.getElementById('check-button');
    feedbackArea = document.getElementById('feedback-area');

    // 1. Vytvorenie elementu pre zobrazenie času (umiestnenie v DOM)
    timerDisplayElement = document.createElement('div');
    timerDisplayElement.id = 'timer-display';
    timerDisplayElement.innerHTML = '⏳ Čas: --:--'; 
    
    // Extrémne silné CSS
    timerDisplayElement.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        z-index: 999999 !important; 

        background-color: #000000 !important; 
        color: #ffc107 !important; 
        padding: 12px 18px !important;
        border-radius: 8px !important;
        font-weight: bold !important;
        font-size: 1.2em !important;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5) !important;
        border: 3px solid #ffc107 !important;
        
        display: none; 
    `;
    document.body.appendChild(timerDisplayElement);
    
    // 2. Nastavenie event listenra pre tlačidlo check/next
    checkButton.onclick = function() {
        if (isAnswerChecked) {
            goToNextQuestion();
        } else {
            checkAnswer();
        }
    };

    // 3. Načítanie otázok po inicializácii DOM
    loadQuestions();
});


// --- Pomocné funkcie ---

function shuffleArray(array) {
for (let i = array.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[array[i], array[j]] = [array[j], array[i]];
}
return array;
}

/**
* Konvertuje pole otázok na objekt zoskupený podľa kategórií.
*/
function groupQuestionsByCategories(questionsArray) {
const grouped = {};
questionsArray.forEach(q => {
const category = q.kategoria_tema ? q.kategoria_tema.trim() : 'Neznáma kategória';

if (!grouped[category]) {
grouped[category] = [];
}

const questionData = {
id: q.id,
question: q.otazka || q.question,
kategoria_tema: category,
options: q.moznosti || q.options,
explanation: q.vysvetlenie || q.explanation,
correct_index: q.correct_index !== undefined ? q.correct_index : (q.options ? q.options.findIndex(opt => opt === q.spravna_odpoved) : -1) 
};

grouped[category].push(questionData);
});
return grouped;
}

function startTestFromCategory(categoryName) {
if (!allQuestionsObject[categoryName]) {
console.error("❌ Chyba: Kategória nebola nájdená:", categoryName);
return;
}

// Zastavenie časovača (pre kategórie)
if (timerInterval) {
    clearInterval(timerInterval);
    timerDisplayElement.style.display = 'none';
}

let categoryQuestions = allQuestionsObject[categoryName];

shuffleArray(categoryQuestions);

const limit = Math.min(QUESTIONS_PER_TEST, categoryQuestions.length);
currentQuestions = categoryQuestions.slice(0, limit);

startTestSetup(); 
}

// --------------------------------------------------
// FUNKCIE PRE ČASOVAČ
// --------------------------------------------------
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    const minutesDisplay = String(minutes).padStart(2, '0');
    const secondsDisplay = String(seconds).padStart(2, '0');

    // Použitie .innerHTML na zachovanie ikony
    timerDisplayElement.innerHTML = `⏳ Čas: ${minutesDisplay}:${secondsDisplay}`; 
    
    // Zmena farby, keď zostáva málo času
    if (timeRemaining < 300) { // Menej ako 5 minút
        timerDisplayElement.style.backgroundColor = '#dc3545'; // Červená
        timerDisplayElement.style.color = 'white';
        timerDisplayElement.style.border = '3px solid white';
    } else {
        timerDisplayElement.style.backgroundColor = '#000000'; // Pôvodná farba
        timerDisplayElement.style.color = '#ffc107';
        timerDisplayElement.style.border = '3px solid #ffc107';
    }
}

function startTimer() {
    // timeRemaining je už nastavené v startMixedTest
    timerDisplayElement.style.display = 'block'; 
    updateTimerDisplay(); // Prvé zobrazenie času

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerDisplayElement.innerHTML = "⏳ ČAS VYPRŠAL!";
            
            alert("Čas vypršal! Test bol automaticky uzavretý.");
            showResults(true); 
        }
    }, 1000);
}


// --------------------------------------------------
// Vygenerovanie zmiešaného testu (Spracováva výber času)
// --------------------------------------------------
function startMixedTest() {
    const categories = Object.keys(allQuestionsObject);
    const requiredCategoryCount = 6;
    currentQuestions = [];

    if (categories.length < requiredCategoryCount) {
        alert("Chyba: Pre vygenerovanie tohto testu je potrebných aspoň 6 rôznych kategórií otázok.");
        displayCategorySelection();
        return;
    }

    // ZÍSKANIE A NASTAVENIE ČASOVÉHO LIMITU
    const timeLimitSelect = document.getElementById('time-limit');
    // Ak sa element nenašiel, použije sa predvolená hodnota 60 (pre bezpečnosť)
    const selectedMinutes = timeLimitSelect ? parseInt(timeLimitSelect.value, 10) : 60;
    
    // Definícia požadovaného počtu otázok
    const distribution = [
        { index: 0, count: 4, name: "Okruh 1" }, 
        { index: 1, count: 4, name: "Okruh 2" }, 
        { index: 2, count: 4, name: "Okruh 3" }, 
        { index: 3, count: 20, name: "Okruh 4" }, 
        { index: 4, count: 20, name: "Okruh 5" }, 
        { index: 5, count: 8, name: "Okruh 6" } 
    ];

    let totalSelected = 0;

    distribution.forEach(item => {
        const categoryName = categories[item.index];
        let availableQuestions = allQuestionsObject[categoryName] || [];
        
        shuffleArray(availableQuestions); 

        const countToSelect = Math.min(item.count, availableQuestions.length);

        currentQuestions.push(...availableQuestions.slice(0, countToSelect));
        totalSelected += countToSelect;
    });

    shuffleArray(currentQuestions);

    if (totalSelected < 60) {
        alert(`Upozornenie: Bolo nájdených iba ${totalSelected} otázok namiesto požadovaných 60 (Nedostatok otázok v kategóriách).`);
    }
    
    // Spustenie časovača len, ak bol zvolený limit > 0
    if (selectedMinutes > 0) {
        timeRemaining = selectedMinutes * 60;
        startTimer();
    } else {
        // Ak je zvolené "Bez časového limitu"
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        if (timerDisplayElement) {
            timerDisplayElement.style.display = 'none';
        }
    }
    
    startTestSetup(); 
}

// --------------------------------------------------
// displayCategorySelection (Pridanie výberu času)
// --------------------------------------------------
function displayCategorySelection() {
    // Zastavenie časovača pri návrate na výber
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    if (timerDisplayElement) {
        timerDisplayElement.style.display = 'none';
    }
    
    questionText.innerHTML = "<h2>📚 Vyberte si kategóriu pre test</h2>";
    optionsContainer.innerHTML = '';
    
    feedbackArea.innerHTML = 'Vyberte si oblasť, z ktorej chcete spustiť testovaciu sadu otázok, alebo zvoľte zmiešaný test. Ak zvolíte kategóriu, použijú sa **všetky** náhodne zamiešané otázky.';
    feedbackArea.style.backgroundColor = '#e9f5ff';
    feedbackArea.style.borderLeft = 'none';
    checkButton.style.display = 'none'; 

    const categories = Object.keys(allQuestionsObject);

    if (categories.length === 0) {
        questionText.textContent = "Chyba: Kategórie neboli nájdené. Skontrolujte súbor questions.json.";
        return;
    }

    // --------------------------------------------------
    // VÝBER ČASU A TLAČIDLO PRE ZMIEŠANÝ TEST
    // --------------------------------------------------
    if (categories.length >= 6) {
        const timeSelectionDiv = document.createElement('div');
        timeSelectionDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9;';
        timeSelectionDiv.innerHTML = `
            <label for="time-limit" style="font-weight: bold; margin-right: 15px; display: block; margin-bottom: 5px;">Vyberte časový limit pre Zmiešaný test:</label>
            <select id="time-limit" class="form-select" style="padding: 10px; border-radius: 5px; border: 1px solid #007bff; width: 100%;">
                <option value="60">60 minút</option>
                <option value="45">45 minút</option>
                <option value="30">30 minút</option>
                <option value="0">Bez časového limitu</option>
            </select>
        `;
        optionsContainer.appendChild(timeSelectionDiv);

        const mixedTestButton = document.createElement('button');
        mixedTestButton.textContent = '🔥 Vygenerovať Zmiešaný Test - 60 otázok';
        mixedTestButton.className = 'option-button category-button mixed-test-button';
        mixedTestButton.onclick = startMixedTest;
        mixedTestButton.style.cssText = 'background-color: #007bff; color: white; font-weight: bold; margin-bottom: 20px;';
        optionsContainer.appendChild(mixedTestButton);

        const separator = document.createElement('hr');
        separator.style.margin = '20px 0';
        optionsContainer.appendChild(separator);
    }
    // --------------------------------------------------


    categories.forEach((category, i) => {
        const button = document.createElement('button');

        const questionCount = allQuestionsObject[category].length;
        button.textContent = `${i + 1}. ${category} (${questionCount} otázok)`;

        button.className = 'option-button category-button';
        button.onclick = () => startTestFromCategory(category);

        optionsContainer.appendChild(button);
    });
}

// --------------------------------------------------
// Funkcia loadQuestions
// --------------------------------------------------
async function loadQuestions() {
let allQuestionsArray = [];
if (questionText) {
    questionText.textContent = "Načítavam otázky...";
}

try {
const response = await fetch(questions_url);
if (!response.ok) {
    throw new Error("Chyba siete: " + response.status + ". Súbor questions.json nebol nájdený alebo je nedostupný.");
}

const data = await response.json(); 

if (Array.isArray(data)) {
allQuestionsArray = data;
} else if (typeof data === 'object' && data !== null) {
allQuestionsArray = Object.values(data).flat();
} else {
throw new Error("Neočakávaná štruktúra dát v questions.json.");
}

if (allQuestionsArray.length > 0) {
allQuestionsObject = groupQuestionsByCategories(allQuestionsArray);
displayCategorySelection(); 
} else {
questionText.textContent = "Súbor otázok je prázdny alebo obsahuje nulové dáta.";
}
} catch (error) {
questionText.innerHTML = `<h2>❌ Chyba pri načítaní otázok</h2><p> ${error.message}</p><p>Skontrolujte, či je súbor <strong>questions.json</strong> v správnom priečinku.</p>`;
console.error("❌ CHYBA pri načítaní questions.json:", error);
}
}

// --------------------------------------------------
// startTestSetup
// --------------------------------------------------
function startTestSetup() {
    
    currentQuestionIndex = 0;
    selectedAnswerIndex = -1;
    correctAnswersCount = 0;
    totalQuestionsAnswered = 0;
    incorrectAnswersList = [];
    isAnswerChecked = false;
    feedbackArea.style.backgroundColor = '#e9f5ff'; 
    feedbackArea.style.borderLeft = 'none';
    checkButton.style.display = 'block'; 
    checkButton.textContent = 'Skontrolovať odpoveď'; // Reset textu
    checkButton.disabled = true; // Reset stavu

    if (currentQuestions.length > 0) {
        displayQuestion(currentQuestionIndex);
    } else {
        questionText.textContent = "Chyba: Neboli vybraté žiadne otázky pre test.";
    }
}

// --------------------------------------------------
// Funkcie displayQuestion, selectAnswer, checkAnswer, goToNextQuestion zostávajú bez zmeny
// --------------------------------------------------

function displayQuestion(index) {
if (!currentQuestions[index]) {
console.error("❌ Chyba: Otázka na tomto indexe neexistuje!");
return;
}

const q = currentQuestions[index];
questionText.innerHTML = `<small style="font-style:italic;">Kategória: ${q.kategoria_tema || 'Neznáma'}</small><br>
<strong>${index + 1} z ${currentQuestions.length}. ${q.question}</strong>`;
optionsContainer.innerHTML = '';
feedbackArea.innerHTML = ''; 
selectedAnswerIndex = -1;

isAnswerChecked = false; 
checkButton.textContent = 'Skontrolovať odpoveď';
checkButton.disabled = true; 

q.options.forEach((optionText, i) => {
const button = document.createElement('button');
button.textContent = optionText;
button.className = 'option-button';
button.onclick = () => selectAnswer(i, button);
optionsContainer.appendChild(button);
});
}

function selectAnswer(index, button) {
if (isAnswerChecked) return; 

selectedAnswerIndex = index;
checkButton.disabled = false; 

document.querySelectorAll('.option-button').forEach(btn => {
btn.classList.remove('selected');
});
button.classList.add('selected');
}

function checkAnswer() {
if (selectedAnswerIndex === -1) {
    // Toto by sa nemalo stať, ak je tlačidlo disabled=false len po výbere
    return;
}

const q = currentQuestions[currentQuestionIndex];
const isCorrect = selectedAnswerIndex === q.correct_index; 

isAnswerChecked = true; 
totalQuestionsAnswered++;

document.querySelectorAll('.option-button').forEach(btn => btn.disabled = true);

if (isCorrect) {
correctAnswersCount++;
feedbackArea.innerHTML = `<div style="color: green; font-weight: bold;">✅ Správne!</div>`;
feedbackArea.style.backgroundColor = '#e6ffe6';
} else {
incorrectAnswersList.push({
question: q.question,
correct_answer: q.options[q.correct_index], 
explanation: q.explanation,
kategoria_tema: q.kategoria_tema,
id: q.id
});

feedbackArea.innerHTML = `<div style="color: red; font-weight: bold;">❌ Nesprávne.</div>
<div>Správna odpoveď: ${q.options[q.correct_index]}</div>`;
feedbackArea.style.backgroundColor = '#ffe6e6';
}

feedbackArea.innerHTML += `<br><small>Vysvetlenie: ${q.explanation}</small>`;
feedbackArea.style.borderLeft = isCorrect ? '5px solid green' : '5px solid red';

checkButton.textContent = 'Ďalšia otázka >>';
}

function goToNextQuestion() {
currentQuestionIndex++;

if (currentQuestionIndex < currentQuestions.length) {
displayQuestion(currentQuestionIndex);
feedbackArea.style.backgroundColor = '#e9f5ff'; 
feedbackArea.style.borderLeft = 'none';
} else {
showResults();
}
}

// --------------------------------------------------
// showResults (zastaví časovač)
// --------------------------------------------------
function showResults(isTimeExpired = false) {
    // Zastavenie časovača
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    if (timerDisplayElement) {
        timerDisplayElement.style.display = 'none'; // Skrytie časovača
    }

    const totalQuestions = currentQuestions.length;
    const percentage = ((correctAnswersCount / totalQuestions) * 100).toFixed(1);

    questionText.innerHTML = `<h2>${isTimeExpired ? '⏳ Test uzavretý - vypršal čas!' : '✅ Test Ukončený!'}</h2>`;
    optionsContainer.innerHTML = '';
    checkButton.style.display = 'none'; 

    feedbackArea.style.backgroundColor = '#f0f0f0';
    feedbackArea.style.borderLeft = '5px solid #007bff';

    let htmlContent = `
    <h3>Váš Výsledok</h3>
    <p>Otázky: <strong>${totalQuestions}</strong> | Správne: <strong>${correctAnswersCount}</strong></p>
    <p style="font-size: 1.5em; color: ${percentage >= 80 ? '#28a745' : '#dc3545'};">Úspešnosť: <strong>${percentage}%</strong></p>
    `;

    htmlContent += `<button id="restart-btn" class="restart-button" style="width:100%; padding:15px; background:#28a745; color:white; border:none; border-radius:5px; margin-top:20px; font-size:1.1em; cursor:pointer;">Späť na výber kategórie</button>`;

    if (incorrectAnswersList.length > 0) {
        htmlContent += '<hr><h4>Prehľad chýb:</h4><ul style="text-align:left;">';
        incorrectAnswersList.forEach((q) => {
            htmlContent += `
            <li style="margin-bottom:15px;">
            <strong>${q.question}</strong><br>
            <span style="color:green;">Správne: ${q.correct_answer}</span>
            <br><small>Kategória: ${q.kategoria_tema || 'Neznáma'}</small>
            </li>`;
        });
        htmlContent += '</ul>';
    }

    feedbackArea.innerHTML = htmlContent;

    setTimeout(() => {
        const restartBtn = document.getElementById('restart-btn');
        if(restartBtn) restartBtn.onclick = displayCategorySelection; 
    }, 100);
}