const canvas = document.getElementById('treeCanvas');
const ctx = canvas.getContext('2d');
const lzwContainer = document.getElementById('lzwTableContainer');
const legendPanel = document.getElementById('legendPanel');

let animationSteps = [];
let currentStep = -1;
let currentAlgo = null;


let fullHuffmanRoot = null; 
let lastEncodedHuffmanStr = ""; 
let lastLZWInitialDict = []; 
let lastEncodedLZWCodes = []; 

let playInterval = null;
let isPlaying = false;

let nodeIdCounter = 0;
class HuffmanNode {
    constructor(char, freq, left = null, right = null) {
        this.id = nodeIdCounter++;
        this.char = char; 
        this.freq = freq;
        this.left = left; 
        this.right = right;
        this.x = 0; this.y = 0; 
    }
}

function resetApp(clearMemory = true) {
    if (isPlaying) toggleAutoPlay();
    animationSteps = [];
    currentStep = -1;
    currentAlgo = null;
    
    if (clearMemory) {
        fullHuffmanRoot = null; 
        lastEncodedHuffmanStr = ""; 
        lastLZWInitialDict = []; 
        lastEncodedLZWCodes = []; 
    }
    
    document.getElementById('logList').innerHTML = "";
    document.getElementById('stepCounter').innerText = "Adım: 0 / 0";
    document.getElementById('outputResult').innerText = "İşlem bekleniyor...";
    
    canvas.width = 850; 
    canvas.height = 420;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    lzwContainer.innerHTML = "";
    canvas.style.display = 'inline-block';
    lzwContainer.style.display = 'none';
    legendPanel.style.display = 'none';
}

function initAlgo(type) {
    let rawText = document.getElementById('inputText').value.toUpperCase();
    if(!rawText) return alert("Lütfen bir metin girin!");
    let text = rawText.replace(/ /g, '␣');

    if(type === 'huffmanDecode' && (!fullHuffmanRoot || !lastEncodedHuffmanStr)) {
        return alert("Hata: Önce Huffman Encode yapmalısın!");
    }
    if(type === 'lzwDecode' && lastEncodedLZWCodes.length === 0) {
        return alert("Hata: Önce LZW Encode yapmalısın!");
    }

    resetApp(false); 
    currentAlgo = type;
    
    if (type === 'huffman') generateHuffmanSteps(text);
    if (type === 'lzw') generateLZWSteps(text);
    if (type === 'huffmanDecode') generateHuffmanDecodeSteps();
    if (type === 'lzwDecode') generateLZWDecodeSteps();
    
    if(animationSteps.length > 0) nextStep();
}


function generateHuffmanSteps(text) {
    nodeIdCounter = 0;
    canvas.style.display = 'inline-block';
    lzwContainer.style.display = 'none';
    legendPanel.style.display = 'block';

    let freqMap = {};
    for(let char of text) freqMap[char] = (freqMap[char] || 0) + 1;
    let activeNodes = Object.keys(freqMap).map(char => new HuffmanNode(char, freqMap[char]));
    
    animationSteps.push({ type: 'huffman', msg: "Başlangıç: Karakter frekansları sayıldı.", visibleIds: activeNodes.map(n => n.id) });

    while(activeNodes.length > 1) {
        activeNodes.sort((a, b) => a.freq - b.freq); 
        let left = activeNodes.shift(), right = activeNodes.shift();
        let parent = new HuffmanNode(left.char + right.char, left.freq + right.freq, left, right);
        activeNodes.push(parent);
        
        animationSteps.push({
            type: 'huffman', msg: `En düşük frekanslı ('${left.char||left.freq}' ve '${right.char||right.freq}') birleşti. Kök: ${parent.freq}`,
            visibleIds: activeNodes.flatMap(getDescendantIds), highlightIds: [parent.id, left.id, right.id]
        });
    }
    
    fullHuffmanRoot = activeNodes[0];
    
    if(fullHuffmanRoot) {
        currentLeafX = 40; maxDepth = 0;
        calculatePositions(fullHuffmanRoot, 0);
        let calculatedWidth = currentLeafX + 40;
        let finalCanvasWidth = Math.max(850, calculatedWidth);
        let shiftX = (finalCanvasWidth - calculatedWidth) / 2;
        shiftAllNodes(fullHuffmanRoot, shiftX);
        fullHuffmanRoot.reqWidth = finalCanvasWidth;
        fullHuffmanRoot.reqHeight = Math.max(420, maxDepth * 70 + 80);
    }

    let codes = {};
    function genCodes(node, currentCode) {
        if(!node) return;
        if(!node.left && !node.right) codes[node.char] = currentCode;
        genCodes(node.left, currentCode + "0"); genCodes(node.right, currentCode + "1");
    }
    if(fullHuffmanRoot) {
        if(!fullHuffmanRoot.left && !fullHuffmanRoot.right) codes[fullHuffmanRoot.char] = "0"; 
        else genCodes(fullHuffmanRoot, "");
    }

    lastEncodedHuffmanStr = text.split('').map(c => codes[c]).join('');
    
    animationSteps.push({
        type: 'huffman', msg: "Ağaç tamamlandı! Kodlar belirlendi.",
        visibleIds: getDescendantIds(fullHuffmanRoot), highlightIds: [],
        finalOutput: `<b>Binary Çıktı:</b><br><span style="color:#facc15; font-family:monospace; letter-spacing:2px;">${text.split('').map(c => codes[c]).join(' ')}</span>`,
        isFinal: true
    });
}


function generateHuffmanDecodeSteps() {
    canvas.style.display = 'inline-block'; lzwContainer.style.display = 'none'; legendPanel.style.display = 'block';

    let bits = lastEncodedHuffmanStr.split('');
    let decodedText = "";
    let currentNode = fullHuffmanRoot;
    let allTreeIds = getDescendantIds(fullHuffmanRoot);

    function getBitsDisplay(currentIndex) {
        let before = "";
        let current = "";
        let after = "";

        if (currentIndex < 0) {
            after = bits.join('');
        } else if (currentIndex >= bits.length) {
            before = bits.join('');
        } else {
            before = bits.slice(0, currentIndex).join('');
            current = bits[currentIndex];
            after = bits.slice(currentIndex + 1).join('');
        }
        
        return `<div style="font-family: monospace; letter-spacing: 2px; margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; word-break: break-all; color: #64748b; font-size: 1.1rem; line-height: 1.8;">` +
               `<b>BİT AKIŞI:</b> <br>` +
               `<span style="color: #4ade80;">${before}</span>` + 
               (current ? `<span style="background: #facc15; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 1.2rem; margin: 0 3px; box-shadow: 0 0 8px #facc15;">${current}</span>` : "") + 
               `<span>${after}</span></div>`;
    }

    animationSteps.push({ 
        type: 'huffman', msg: `Decode Başlıyor. Şifreli Metin okunuyor...`, visibleIds: allTreeIds, highlightIds: [fullHuffmanRoot.id], 
        finalOutput: `<b>Çözülen Metin:</b> Bekleniyor... ${getBitsDisplay(-1)}` 
    });

    for(let i=0; i<bits.length; i++) {
        let bit = bits[i];
        currentNode = (bit === '0') ? currentNode.left : currentNode.right;
        
        animationSteps.push({
            type: 'huffman', msg: `Okunan Bit: <b>${bit}</b>. Ağaçta ${bit === '0' ? 'sola' : 'sağa'} inildi.`,
            visibleIds: allTreeIds, highlightIds: [currentNode.id], 
            finalOutput: `<b>Çözülen Metin:</b> <span style="color:#facc15">${decodedText}</span> ${getBitsDisplay(i)}`
        });

        if(!currentNode.left && !currentNode.right) {
            decodedText += currentNode.char;
            animationSteps.push({
                type: 'huffman', msg: `Yaprağa ulaşıldı! Karakter bulundu: <b>'${currentNode.char}'</b>. Tekrar köke dönülüyor.`,
                visibleIds: allTreeIds, highlightIds: [currentNode.id], isWarning: true, 
                finalOutput: `<b>Çözülen Metin:</b> <span style="color:#4ade80">${decodedText}</span> ${getBitsDisplay(i)}`
            });
            currentNode = fullHuffmanRoot; 
        }
    }

    animationSteps.push({ 
        type: 'huffman', msg: "Bütün bitler okundu. Metin başarıyla çözüldü!", visibleIds: allTreeIds, highlightIds: [], 
        finalOutput: `<b>Nihai Çözülmüş Metin:</b><br><span style="color:#4ade80; font-size:1.3rem;">${decodedText}</span> ${getBitsDisplay(bits.length)}`, 
        isFinal: true 
    });
}


function generateLZWSteps(text) {
    canvas.style.display = 'none'; legendPanel.style.display = 'none'; lzwContainer.style.display = 'block';

    let dict = {};
    lastLZWInitialDict = [...new Set(text.split(''))].sort();
    lastLZWInitialDict.forEach((c, i) => dict[c] = i + 1); 
    
    let nextCode = lastLZWInitialDict.length + 1;
    let w = text[0]; 
    lastEncodedLZWCodes = [];
    let tableRows = [`<tr><td>-</td><td>${w} (İlk)</td><td style="color:#38bdf8;">Başlangıç</td><td>-</td><td>-</td></tr>`];

    animationSteps.push({ type: 'lzw', msg: `Sözlük oluşturuldu. İlk harf '<b>${w}</b>' okundu.`, tableRows: [...tableRows], output: `<b>Sıkıştırılmış Kodlar:</b> Bekleniyor...` });

    for (let i = 1; i < text.length; i++) {
        let c = text[i]; let wc = w + c;
        if (dict.hasOwnProperty(wc)) {
            tableRows.push(`<tr><td><b>${w}</b></td><td>${c}</td><td style="color:#4ade80;">Evet (${dict[wc]})</td><td>-</td><td>-</td></tr>`);
            w = wc;
            animationSteps.push({ type: 'lzw', msg: `'${wc}' sözlükte var. Kelime uzatıldı.`, tableRows: [...tableRows], output: `<b>Sıkıştırılmış Kodlar:</b> <span style="color:#facc15">${lastEncodedLZWCodes.join(' - ')}</span>` });
        } else {
            lastEncodedLZWCodes.push(dict[w]);
            dict[wc] = nextCode++;
            tableRows.push(`<tr><td><b>${w}</b></td><td>${c}</td><td style="color:#f43f5e;">Hayır</td><td><b>${dict[w]}</b></td><td><b>${wc} = ${dict[wc]}</b></td></tr>`);
            let currentW = w; w = c; 
            animationSteps.push({ type: 'lzw', msg: `'${currentW + c}' sözlükte YOK! Çıktı: ${dict[currentW]}. Sözlüğe: ${currentW + c} = ${dict[currentW+c]} eklendi.`, tableRows: [...tableRows], output: `<b>Sıkıştırılmış Kodlar:</b> <span style="color:#facc15">${lastEncodedLZWCodes.join(' - ')}</span>`, isWarning: true });
        }
    }
    
    if (w !== "") {
        lastEncodedLZWCodes.push(dict[w]);
        tableRows.push(`<tr><td><b>${w}</b></td><td>-</td><td>EOF (Bitti)</td><td><b>${dict[w]}</b></td><td>-</td></tr>`);
    }

    animationSteps.push({ type: 'lzw', msg: "Sıkıştırma tamamlandı!", tableRows: [...tableRows], output: `<b>Sıkıştırılmış Kodlar:</b> <span style="color:#facc15">${lastEncodedLZWCodes.join(' - ')}</span>`, isFinal: true });
}


function generateLZWDecodeSteps() {
    canvas.style.display = 'none'; legendPanel.style.display = 'none'; lzwContainer.style.display = 'block';

    let reverseDict = {};
    lastLZWInitialDict.forEach((c, i) => reverseDict[i + 1] = c);
    
    let nextCode = lastLZWInitialDict.length + 1;
    let codes = [...lastEncodedLZWCodes];
    let decodedText = "";
    let tableRows = [];

    function getCodesDisplay(currentIndex) {
        let html = `<div style="font-family: monospace; letter-spacing: 1px; margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; word-break: break-all; color: #64748b; font-size: 1.1rem; line-height: 1.8;">`;
        html += `<b>KOD AKIŞI:</b> <br>`;
        let elements = codes.map((code, idx) => {
            if (idx < currentIndex) return `<span style="color: #4ade80;">${code}</span>`;
            if (idx === currentIndex) return `<span style="background: #facc15; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 1.2rem; margin: 0 3px; box-shadow: 0 0 8px #facc15;">${code}</span>`;
            return `<span>${code}</span>`;
        });
        html += elements.join(' <span style="color:#334155;">-</span> ');
        html += `</div>`;
        return html;
    }

    let oldCode = codes[0];
    let s = reverseDict[oldCode];
    decodedText += s;
    
    tableRows.push(`<tr><td>-</td><td>${oldCode}</td><td style="color:#38bdf8;">Çözüldü: '${s}'</td><td>-</td></tr>`);
    animationSteps.push({ type: 'lzwDecode', msg: `İlk şifreli kod (${oldCode}) çözüldü: '${s}'`, tableRows: [...tableRows], output: `<b>Çözülen Metin:</b> <span style="color:#facc15">${decodedText}</span> ${getCodesDisplay(0)}` });

    for (let i = 1; i < codes.length; i++) {
        let newCode = codes[i];
        let currentString = "";

        if (reverseDict.hasOwnProperty(newCode)) {
            currentString = reverseDict[newCode];
            decodedText += currentString;
            let newEntry = reverseDict[oldCode] + currentString[0];
            reverseDict[nextCode] = newEntry;
            
            tableRows.push(`<tr><td>${oldCode}</td><td>${newCode}</td><td style="color:#4ade80;">Çözüldü: '${currentString}'</td><td><b>${newEntry} = ${nextCode}</b></td></tr>`);
            animationSteps.push({ type: 'lzwDecode', msg: `Kod ${newCode} çözüldü ('${currentString}'). Sözlüğe Eklendi: ${newEntry} = ${nextCode}`, tableRows: [...tableRows], output: `<b>Çözülen Metin:</b> <span style="color:#facc15">${decodedText}</span> ${getCodesDisplay(i)}`, isWarning: true });
            nextCode++;
        } else {
            currentString = reverseDict[oldCode] + reverseDict[oldCode][0];
            decodedText += currentString;
            reverseDict[nextCode] = currentString;
            
            tableRows.push(`<tr><td>${oldCode}</td><td>${newCode}</td><td style="color:#f43f5e;">ÖZEL DURUM: '${currentString}'</td><td><b>${currentString} = ${nextCode}</b></td></tr>`);
            animationSteps.push({ type: 'lzwDecode', msg: `ÖZEL DURUM! (Eski + Eski[0]) kuralı ile çözüldü: '${currentString}'.`, tableRows: [...tableRows], output: `<b>Çözülen Metin:</b> <span style="color:#facc15">${decodedText}</span> ${getCodesDisplay(i)}`, isWarning: true });
            nextCode++;
        }
        oldCode = newCode;
    }

    animationSteps.push({ type: 'lzwDecode', msg: "Bütün kodlar çözüldü! Orijinal metin yeniden oluşturuldu.", tableRows: [...tableRows], output: `<b>Nihai Çözülmüş Metin:</b><br><span style="color:#4ade80; font-size:1.3rem;">${decodedText}</span> ${getCodesDisplay(codes.length)}`, isFinal: true });
}


let currentLeafX = 40; let maxDepth = 0;
function calculatePositions(node, depth = 0) {
    if(!node) return;
    node.y = 40 + depth * 70; 
    if(depth > maxDepth) maxDepth = depth;
    if (!node.left && !node.right) { node.x = currentLeafX; currentLeafX += 65; } 
    else { calculatePositions(node.left, depth + 1); calculatePositions(node.right, depth + 1); node.x = ((node.left ? node.left.x : node.x) + (node.right ? node.right.x : node.x)) / 2; }
}
function shiftAllNodes(node, shiftAmount) { if(!node) return; node.x += shiftAmount; shiftAllNodes(node.left, shiftAmount); shiftAllNodes(node.right, shiftAmount); }
function getDescendantIds(nodeOrNodes) { let ids = []; let nodes = Array.isArray(nodeOrNodes) ? nodeOrNodes : [nodeOrNodes]; function traverse(n) { if(!n) return; ids.push(n.id); traverse(n.left); traverse(n.right); } nodes.forEach(traverse); return ids; }

function nextStep(isAuto = false) { if (!isAuto && isPlaying) toggleAutoPlay(); if (currentStep < animationSteps.length - 1) { currentStep++; renderStep(); } }
function prevStep() { if (isPlaying) toggleAutoPlay(); if (currentStep > 0) { currentStep--; renderStep(); } }
function skipToEnd() { 
    if (animationSteps.length === 0 || currentStep >= animationSteps.length - 1) return; 
    if (isPlaying) toggleAutoPlay(); 
    currentStep = animationSteps.length - 1; 
    document.getElementById('logList').innerHTML = ""; 
    for (let i = 0; i <= currentStep; i++) { addLog(animationSteps[i]); }
    renderCurrentVisuals(); updateStepCounter(); 
}

function toggleAutoPlay() {
    const btn = document.getElementById('btnAuto');
    if (isPlaying) {
        clearInterval(playInterval); isPlaying = false; btn.innerText = "▶ Otomatik"; btn.style.background = "var(--purple)";
    } else {
        if (currentStep >= animationSteps.length - 1) return; 
        isPlaying = true; btn.innerText = "⏸ Durdur"; btn.style.background = "var(--warning)"; 
        playInterval = setInterval(() => { if (currentStep < animationSteps.length - 1) nextStep(true); else toggleAutoPlay(); }, 1200); 
    } 
}

function renderStep() { const step = animationSteps[currentStep]; addLog(step); updateStepCounter(); renderCurrentVisuals(); }

function renderCurrentVisuals() {
    const step = animationSteps[currentStep];
    if (step.type === 'huffman') {
        if(fullHuffmanRoot) {
            if (canvas.width !== fullHuffmanRoot.reqWidth) canvas.width = fullHuffmanRoot.reqWidth;
            if (canvas.height !== fullHuffmanRoot.reqHeight) canvas.height = fullHuffmanRoot.reqHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if(fullHuffmanRoot) {
            drawHuffmanLines(fullHuffmanRoot, step.visibleIds);
            drawHuffmanCircles(fullHuffmanRoot, step.visibleIds, step.highlightIds || []);
        }
        
        document.getElementById('outputResult').innerHTML = step.finalOutput || "Ağaç oluşturuluyor...";
    } 
    else if (step.type === 'lzw') {
        let html = `<table><tr><th>Mevcut (w)</th><th>Sıradaki (c)</th><th>Sözlükte Var mı?</th><th>Çıktı</th><th>Sözlüğe Eklenen</th></tr>${step.tableRows.join('')}</table>`;
        lzwContainer.innerHTML = html; lzwContainer.scrollTop = lzwContainer.scrollHeight; document.getElementById('outputResult').innerHTML = step.output;
    }
    else if (step.type === 'lzwDecode') {
        let html = `<table><tr><th>Önceki Kod</th><th>Okunan Yeni Kod</th><th>Çözülen Harf/Kelime</th><th>Sözlüğe Yeni Eklenen</th></tr>${step.tableRows.join('')}</table>`;
        lzwContainer.innerHTML = html; lzwContainer.scrollTop = lzwContainer.scrollHeight; document.getElementById('outputResult').innerHTML = step.output;
    }
}

function drawHuffmanLines(node, visibleIds) {
    if(!node) return;
    drawHuffmanLines(node.left, visibleIds);
    drawHuffmanLines(node.right, visibleIds);

    if (visibleIds.includes(node.id)) {
        if (node.left && visibleIds.includes(node.left.id)) {
            ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.left.x, node.left.y);
            ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = "#1e293b"; ctx.font = "bold 14px Arial"; ctx.fillText("0", (node.x + node.left.x)/2 - 10, (node.y + node.left.y)/2);
        }
        if (node.right && visibleIds.includes(node.right.id)) {
            ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.right.x, node.right.y);
            ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = "#1e293b"; ctx.font = "bold 14px Arial"; ctx.fillText("1", (node.x + node.right.x)/2 + 10, (node.y + node.right.y)/2);
        }
    }
}

function drawHuffmanCircles(node, visibleIds, highlightIds) {
    if(!node) return;
    drawHuffmanCircles(node.left, visibleIds, highlightIds);
    drawHuffmanCircles(node.right, visibleIds, highlightIds);

    if (visibleIds.includes(node.id)) {
        ctx.beginPath(); ctx.arc(node.x, node.y, 22, 0, Math.PI*2);
        let isLeaf = (!node.left && !node.right); let isHighlight = highlightIds.includes(node.id);
        
        if (isHighlight) ctx.fillStyle = "#facc15"; else ctx.fillStyle = isLeaf ? "#fb923c" : "#38bdf8"; 
        
        ctx.fill(); ctx.strokeStyle = isHighlight ? "#ffffff" : "#1e293b"; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = "#1e293b"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        ctx.fillText(isLeaf ? node.char : node.freq, node.x, node.y);
    }
}

function updateStepCounter() { document.getElementById('stepCounter').innerText = `Adım: ${currentStep + 1} / ${animationSteps.length}`; }
function addLog(step) { const list = document.getElementById('logList'); const li = document.createElement('li'); li.innerHTML = step.msg; if(step.isWarning) li.className = "log-warning"; if(step.isFinal) li.className = "log-success"; list.prepend(li); }