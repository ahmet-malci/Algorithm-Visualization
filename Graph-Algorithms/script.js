const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
let animationSteps = [];
let currentStep = -1;
let isDirected = false;

let playInterval = null;
let isPlaying = false;

let graph = {
    nodes: [
        { id: 0, x: 100, y: 275, label: 'A' }, { id: 1, x: 250, y: 150, label: 'B' },
        { id: 2, x: 250, y: 400, label: 'C' }, { id: 3, x: 450, y: 150, label: 'D' },
        { id: 4, x: 450, y: 400, label: 'E' }, { id: 5, x: 650, y: 275, label: 'F' }
    ],
    edges: [
        { from: 0, to: 1, w: 4 }, { from: 0, to: 2, w: 3 }, { from: 1, to: 2, w: 1 },
        { from: 1, to: 3, w: 2 }, { from: 2, to: 4, w: 4 }, { from: 3, to: 4, w: 2 },
        { from: 3, to: 5, w: 1 }, { from: 4, to: 5, w: 6 }
    ]
};

const algoNames = {
    'dijkstra': 'Dijkstra',
    'bellman': 'Bellman-Ford',
    'prim': 'Prim (MST)',
    'kruskal': 'Kruskal (MST)'
};

const algoInfoData = {
    'dijkstra': 'Başlangıç düğümünden diğer tüm düğümlere olan en kısa yolu hesaplar. Greedy (açgözlü) yaklaşımıyla her adımda en yakın düğümü kesinleştirerek ilerler. Negatif ağırlıkları desteklemez.<br><br><b style="color:var(--accent);">Zaman Karmaşıklığı:</b> O(V²)',
    'bellman': 'Grafın tüm kenarlarını düğüm sayısı kadar (V-1 tur) tarayarak en kısa yolları bulur. Negatif ağırlıkları destekler ve algoritmada oluşabilecek negatif döngüleri (cycle) başarıyla tespit edebilir.<br><br><b style="color:var(--accent);">Zaman Karmaşıklığı:</b> O(V * E)',
    'prim': 'Bağlantılı ve yönsüz bir grafta Minimum Spanning Tree bulur. Başlangıç düğümünden başlayıp, ağacı döngü oluşturmayacak şekilde dışarıya doğru her zaman en hafif kenarla büyütür.<br><br><b style="color:var(--accent);">Zaman Karmaşıklığı:</b> O(E log V)',
    'kruskal': 'Kenarları ağırlıklarına göre küçükten büyüğe sıralar. Döngü (cycle) yaratmadığı sürece en hafif kenarları tek tek seçip ağaca ekleyerek Minimum Spanning Tree oluşturur.<br><br><b style="color:var(--accent);">Zaman Karmaşıklığı:</b> O(E log E)'
};

function updateNodeSelect() {
    const select = document.getElementById('startNode');
    select.innerHTML = '';
    graph.nodes.forEach(n => {
        let opt = document.createElement('option');
        opt.value = n.id; opt.innerText = n.label;
        select.appendChild(opt);
    });
}

function toggleDirected() {
    isDirected = document.getElementById('isDirected').checked;
    resetState();
    draw();
}

function generateRandomGraph() {
    graph.edges = [];
    const allowNegative = document.getElementById('allowNegative').checked;
    const connections = [[0,1], [0,2], [1,2], [1,3], [2,4], [3,4], [3,5], [4,5], [1,4], [2,3]];
    
    connections.sort(() => Math.random() - 0.5).slice(0, 8).forEach(pair => {
        let weight = Math.floor(Math.random() * 15) + 1; 
        if (allowNegative && Math.random() < 0.3) {
            weight = Math.floor(Math.random() * -4) - 1; 
        }
        let fromNode = pair[0], toNode = pair[1];
        if (Math.random() > 0.5) { fromNode = pair[1]; toNode = pair[0]; }
        graph.edges.push({ from: fromNode, to: toNode, w: weight });
    });
    
    resetGraphSilently();
    addLog({ msg: `Rastgele graf oluşturuldu. (Negatif Ağırlıklar: ${allowNegative ? 'Açık' : 'Kapalı'})`, isSuccess: true });
}

function initAlgo(type) {
    resetState();
    
    if ((type === 'prim' || type === 'kruskal') && isDirected) {
        isDirected = false;
        document.getElementById('isDirected').checked = false;
        draw();
        
        const list = document.getElementById('logList');
        const li = document.createElement('li');
        li.innerHTML = `MÜDAHALE: ${algoNames[type]} algoritması sadece Yönsüz (Undirected) graflarda çalışır. Graf yönsüz hale getirildi.`;
        li.className = "log-warning";
        list.appendChild(li);
    }
    
    document.getElementById('currentAlgoName').innerText = algoNames[type] + " Algoritması";
    document.getElementById('algo-info-text').innerHTML = algoInfoData[type];
    
    let startIdx = parseInt(document.getElementById('startNode').value) || 0;

    if (type === 'dijkstra') runDijkstra(startIdx);
    if (type === 'bellman') runBellman(startIdx);
    if (type === 'prim') runPrim(startIdx);
    if (type === 'kruskal') runKruskal();
    
    updateStepCounter();
    if(animationSteps.length > 0) nextStep();
}

function resetState() {
    if (isPlaying) toggleAutoPlay();
    animationSteps = []; currentStep = -1;
    document.getElementById('logList').innerHTML = "";
    document.getElementById('stepCounter').innerText = "Adım: 0 / 0";
}

function resetGraph() {
    resetState(); 
    document.getElementById('currentAlgoName').innerText = "Algoritma Seçin";
    document.getElementById('algo-info-text').innerText = "Öğrenmek istediğiniz bir algoritmayı seçin.";
    draw(); 
    addLog({ msg: "Ekran sıfırlandı. Aynı graf üzerinde farklı bir algoritma deneyebilirsiniz.", isSuccess: true });
}

function resetGraphSilently() {
    resetState();
    document.getElementById('currentAlgoName').innerText = "Algoritma Seçin";
    document.getElementById('algo-info-text').innerText = "Öğrenmek istediğiniz bir algoritmayı seçin.";
    draw(); 
}

function toggleAutoPlay() {
    const btn = document.getElementById('btnAuto');
    if (isPlaying) {
        clearInterval(playInterval);
        isPlaying = false;
        btn.innerText = "▶ Otomatik";
        btn.style.background = "var(--purple)";
    } else {
        if (currentStep >= animationSteps.length - 1) return; 
        isPlaying = true;
        btn.innerText = "⏸ Durdur";
        btn.style.background = "var(--warning)"; 
        
        playInterval = setInterval(() => {
            if (currentStep < animationSteps.length - 1) {
                nextStep(true);
            } else {
                toggleAutoPlay();
            }
        }, 1000); 
    }
}

function getTransitions(u) {
    let transitions = [];
    graph.edges.forEach((e, idx) => {
        if (e.from === u) transitions.push({ v: e.to, w: e.w, edgeIdx: idx });
        if (!isDirected && e.to === u) transitions.push({ v: e.from, w: e.w, edgeIdx: idx });
    });
    return transitions;
}

function runDijkstra(startIdx) {
    let dist = Array(graph.nodes.length).fill(Infinity);
    let parentEdge = Array(graph.nodes.length).fill(null); 
    let visited = new Set();
    dist[startIdx] = 0;
    
    animationSteps.push({ msg: `Başlangıç: ${graph.nodes[startIdx].label} = 0, Diğerleri = ∞`, activeNode: startIdx, distances: [...dist] });

    for (let i = 0; i < graph.nodes.length; i++) {
        let u = -1;
        dist.forEach((d, idx) => { if (!visited.has(idx) && (u === -1 || d < dist[u])) u = idx; });
        
        if (dist[u] === Infinity) {
            animationSteps.push({ msg: `Geri kalan düğümlere ulaşılamıyor (Graf Kopuk). Döngü erken sonlandırılıyor.`, activeNode: null, distances: [...dist], isWarning: true });
            break; 
        }
        
        visited.add(u);
        animationSteps.push({ msg: `${graph.nodes[u].label} inceleniyor.`, activeNode: u, distances: [...dist] });

        let neighbors = getTransitions(u);
        for (let trans of neighbors) {
            let {v, w, edgeIdx} = trans;
            
            if (w < 0) {
                animationSteps.push({ msg: `UYARI: ${graph.nodes[u].label}->${graph.nodes[v].label} kenarı negatif (${w}). Dijkstra bu durumda garantili sonuç vermez.`, activeNode: u, activeEdges: [edgeIdx], distances: [...dist], isWarning: true });
            }

            if (!visited.has(v)) {
                animationSteps.push({ msg: `${graph.nodes[u].label}->${graph.nodes[v].label} yolu kontrol ediliyor.`, activeNode: u, activeEdges: [edgeIdx], distances: [...dist] });
                if (dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    parentEdge[v] = edgeIdx; 
                    animationSteps.push({ msg: `Güncellendi: ${graph.nodes[v].label} = ${dist[v]}`, activeNode: v, activeEdges: [edgeIdx], distances: [...dist] });
                }
            }
        }
    }
    
    let finalPathEdges = parentEdge.filter(e => e !== null);
    let unreachableNodes = graph.nodes.filter((_, i) => dist[i] === Infinity).map(n => n.label);

    if (unreachableNodes.length > 0) {
        animationSteps.push({ msg: `Dijkstra Tamamlandı: Graf kopuk olduğu için [${unreachableNodes.join(', ')}] düğümlerine ulaşılamadı.`, activeEdges: [], activeNode: null, distances: [...dist], finalPath: finalPathEdges, isWarning: true });
    } else {
        animationSteps.push({ msg: `Dijkstra Tamamlandı: Tüm düğümlere giden en kısa yollar (yeşil) bulundu.`, activeEdges: [], activeNode: null, distances: [...dist], finalPath: finalPathEdges, isSuccess: true });
    }
}

function runBellman(startIdx) {
    let dist = Array(graph.nodes.length).fill(Infinity);
    let parentEdge = Array(graph.nodes.length).fill(null); 
    dist[startIdx] = 0;
    let V = graph.nodes.length;
    let earlyExit = false;
    
    animationSteps.push({ msg: `Bellman-Ford: Başlangıç ${graph.nodes[startIdx].label}`, activeNode: startIdx, distances: [...dist] });

    for (let i = 0; i < V - 1; i++) {
        animationSteps.push({ msg: `--- Tur ${i+1} Başlıyor ---`, distances: [...dist] });
        let updatedInThisPass = false;

        graph.edges.forEach((edge, idx) => {
            let checks = [{u: edge.from, v: edge.to, w: edge.w}];
            if (!isDirected) checks.push({u: edge.to, v: edge.from, w: edge.w});

            checks.forEach(c => {
                if (dist[c.u] !== Infinity) {
                    animationSteps.push({ msg: `${graph.nodes[c.u].label}->${graph.nodes[c.v].label} yolu kontrol ediliyor.`, activeEdges: [idx], distances: [...dist] });
                    if (dist[c.u] + c.w < dist[c.v]) {
                        dist[c.v] = dist[c.u] + c.w;
                        parentEdge[c.v] = idx; 
                        updatedInThisPass = true;
                        animationSteps.push({ msg: `Güncellendi: ${graph.nodes[c.v].label} = ${dist[c.v]}`, activeNode: c.v, activeEdges: [idx], distances: [...dist] });
                    }
                }
            });
        });

        if (!updatedInThisPass) {
            animationSteps.push({ msg: `Optimizasyon (Erken Bitirme): ${i+1}. turda hiçbir mesafe değişmedi. Geri kalan turlar iptal edildi.`, distances: [...dist], isWarning: true });
            earlyExit = true;
            break;
        }
    }

    let hasNegCycle = false;
    if (!earlyExit) {
        graph.edges.forEach((edge, idx) => {
            let checks = [{u: edge.from, v: edge.to, w: edge.w}];
            if (!isDirected) checks.push({u: edge.to, v: edge.from, w: edge.w});
            checks.forEach(c => {
                if (dist[c.u] !== Infinity && dist[c.u] + c.w < dist[c.v]) {
                    hasNegCycle = true;
                    animationSteps.push({ msg: `DİKKAT: Negatif döngü tespit edildi! (${graph.nodes[c.u].label}->${graph.nodes[c.v].label})`, activeEdges: [idx], distances: [...dist], isError: true });
                }
            });
        });
    }

    let finalPathEdges = parentEdge.filter(e => e !== null);
    let unreachableNodes = graph.nodes.filter((_, i) => dist[i] === Infinity).map(n => n.label);
    
    if (hasNegCycle) {
        animationSteps.push({ msg: `Bellman-Ford Tamamlandı: Negatif döngü bulundu! Mesafeler geçersiz.`, activeEdges: [], activeNode: null, distances: [...dist], isError: true });
    } else if (unreachableNodes.length > 0) {
        animationSteps.push({ msg: `Bellman-Ford Tamamlandı: Graf kopuk olduğu için [${unreachableNodes.join(', ')}] düğümlerine ulaşılamadı.`, activeEdges: [], activeNode: null, distances: [...dist], finalPath: finalPathEdges, isWarning: true });
    } else {
        animationSteps.push({ msg: `Bellman-Ford Tamamlandı: Tüm düğümlere giden en kısa yollar (yeşil) bulundu.`, activeEdges: [], activeNode: null, distances: [...dist], finalPath: finalPathEdges, isSuccess: true });
    }
}

function runPrim(startIdx) {
    let visited = new Set([startIdx]);
    let mst = [];
    animationSteps.push({ msg: `Prim Başladı: ${graph.nodes[startIdx].label} ağaca eklendi.`, activeNode: startIdx, finalPath: [] });

    while (visited.size < graph.nodes.length) {
        let minEdge = null; let minIdx = -1; let nextNode = -1;
        
        graph.edges.forEach((e, idx) => {
            let uIn = visited.has(e.from), vIn = visited.has(e.to);
            if ((uIn && !vIn) || (!uIn && vIn)) {
                if (!minEdge || e.w < minEdge.w) { 
                    minEdge = e; minIdx = idx; 
                    nextNode = uIn ? e.to : e.from;
                }
            }
        });

        if (minEdge) {
            visited.add(nextNode); mst.push(minIdx);
            animationSteps.push({ msg: `En kısa komşu seçildi: ${minEdge.w}`, activeNode: nextNode, activeEdges: [minIdx], finalPath: [...mst] });
        } else {
            animationSteps.push({ msg: `HATA: Graf kopuk! Kalan düğümlere ulaşılamıyor.`, finalPath: [...mst], isError: true, activeEdges: [], activeNode: null });
            break;
        }
    }
    
    if (visited.size === graph.nodes.length) {
        animationSteps.push({ msg: "Prim Tamamlandı: Minimum Spanning Tree oluşturuldu.", finalPath: [...mst], activeEdges: [], activeNode: null, isSuccess: true });
    }
}

function runKruskal() {
    let sorted = [...graph.edges].sort((a,b) => a.w - b.w);
    let parent = graph.nodes.map((_, i) => i);
    let find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    let mst = [];
    
    sorted.forEach(e => {
        let idx = graph.edges.indexOf(e);
        let r1 = find(e.from), r2 = find(e.to);
        animationSteps.push({ msg: `Kenar kontrolü: ${e.w}`, activeEdges: [idx], finalPath: [...mst] });
        if (r1 !== r2) {
            parent[r1] = r2; mst.push(idx);
            animationSteps.push({ msg: "Döngü yok, ağa eklendi.", activeEdges: [idx], finalPath: [...mst] });
        } else {
            animationSteps.push({ msg: "Döngü! Atlandı.", activeEdges: [idx], finalPath: [...mst], isWarning: true });
        }
    });

    if(mst.length < graph.nodes.length - 1) {
        animationSteps.push({ msg: "Kruskal Tamamlandı: Graf kopuk, tam bir ağaç oluşturulamadı.", finalPath: [...mst], activeEdges: [], activeNode: null, isError: true });
    } else {
        animationSteps.push({ msg: "Kruskal Tamamlandı: Minimum Spanning Tree oluşturuldu.", finalPath: [...mst], activeEdges: [], activeNode: null, isSuccess: true });
    }
}

function nextStep(isAuto = false) {
    if (!isAuto && isPlaying) toggleAutoPlay();
    
    if (currentStep < animationSteps.length - 1) {
        currentStep++;
        const step = animationSteps[currentStep];
        draw(step); addLog(step); updateStepCounter();
    }
}

function prevStep() {
    if (isPlaying) toggleAutoPlay(); 
    
    if (currentStep > 0) {
        currentStep--;
        draw(animationSteps[currentStep]); updateStepCounter();
    }
}

function skipToEnd() {
    if (animationSteps.length === 0 || currentStep >= animationSteps.length - 1) return;
    if (isPlaying) toggleAutoPlay(); 
    
    currentStep = animationSteps.length - 1;
    draw(animationSteps[currentStep]);
    
    const list = document.getElementById('logList');
    list.innerHTML = "";
    for (let i = 0; i <= currentStep; i++) {
        const step = animationSteps[i];
        const li = document.createElement('li');
        li.innerHTML = step.msg;
        if(step.isError) li.className = "log-error";
        if(step.isWarning) li.className = "log-warning";
        if(step.isSuccess) li.style.borderLeftColor = "#4ade80";
        list.prepend(li);
    }
    
    updateStepCounter();
}

function updateStepCounter() { 
    document.getElementById('stepCounter').innerText = `Adım: ${currentStep + 1} / ${animationSteps.length}`; 
}

function addLog(step) {
    const list = document.getElementById('logList');
    const li = document.createElement('li');
    li.innerHTML = step.msg;
    if(step.isError) li.className = "log-error";
    if(step.isWarning) li.className = "log-warning";
    if(step.isSuccess) li.style.borderLeftColor = "#4ade80";
    list.prepend(li);
}

function drawArrowhead(ctx, x, y, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, 6); ctx.lineTo(-12, -6); ctx.closePath();
    ctx.fill(); ctx.restore();
}

function draw(step = {}) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    graph.edges.forEach((e, i) => {
        const n1 = graph.nodes[e.from], n2 = graph.nodes[e.to];
        ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
        
        let isFinal = step.finalPath && step.finalPath.includes(i); 
        let isActive = step.activeEdges && step.activeEdges.includes(i); 
        
        ctx.strokeStyle = isFinal ? "#4ade80" : (isActive ? "#38bdf8" : "#e2e8f0");
        ctx.lineWidth = isFinal ? 6 : (isActive ? 5 : 2);
        ctx.stroke();
        
        if (isDirected) {
            let angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
            let targetX = n2.x - 25 * Math.cos(angle);
            let targetY = n2.y - 25 * Math.sin(angle);
            ctx.fillStyle = ctx.strokeStyle;
            drawArrowhead(ctx, targetX, targetY, angle);
        }

        let ratio = 0.35; 
        let textX = n1.x + (n2.x - n1.x) * ratio;
        let textY = n1.y + (n2.y - n1.y) * ratio;

        ctx.fillStyle = "#f43f5e"; ctx.font = "bold 15px Arial";
        
        if (e.w < 0) {
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillRect(textX - 10, textY - 18, 20, 16);
            ctx.fillStyle = "#f43f5e";
        }
        ctx.fillText(e.w, textX, textY - 5);
    });

    graph.nodes.forEach((n, i) => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 25, 0, Math.PI*2);
        
        ctx.fillStyle = (step.activeNode !== undefined && step.activeNode === i && step.activeNode !== null) ? "#facc15" : "#ffffff";
        ctx.fill(); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.stroke();
        
        ctx.fillStyle = "#1e293b"; ctx.font = "bold 16px Arial";
        ctx.fillText(n.label, n.x-7, n.y+5);
        
        if (step.distances) {
            ctx.fillStyle = "#38bdf8"; ctx.font = "bold 12px Arial";
            ctx.fillText(step.distances[i] === Infinity ? "∞" : "d:"+step.distances[i], n.x-15, n.y-35);
        }
    });
}

updateNodeSelect();
draw();