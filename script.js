
(function () {
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMsg = document.getElementById('overlay-msg');
    const startBtn = document.getElementById('start-btn');
    const soundBtn = document.getElementById('sound-btn');

    // ---- Sound (Web Audio API, no external files) ----
    let audioCtx = null;
    let soundOn = true;
    let musicTimer = null;
    let musicStep = 0;
    const MELODY = [392, 440, 494, 440, 523, 494, 440, 392]; // simple looping tune (G A B A C B A G)

    function ensureAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function beep(freq, dur, type, vol) {
        if (!soundOn) return;
        ensureAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.value = freq;
        gain.gain.value = vol == null ? 0.06 : vol;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.start(now);
        osc.stop(now + dur);
    }

    function playEat() {
        beep(660, 0.09, 'square', 0.07);
    }
    function playGameOver() {
        beep(220, 0.35, 'sawtooth', 0.08);
    }

    function startMusic() {
        stopMusic();
        if (!soundOn) return;
        ensureAudio();
        musicStep = 0;
        musicTimer = setInterval(() => {
            const freq = MELODY[musicStep % MELODY.length];
            beep(freq, 0.18, 'triangle', 0.035);
            musicStep++;
        }, 260);
    }
    function stopMusic() {
        if (musicTimer) {
            clearInterval(musicTimer);
            musicTimer = null;
        }
    }

    soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        soundBtn.textContent = soundOn ? '🔊 Music' : '🔇 Music';
        if (soundOn && running && !paused) {
            startMusic();
        } else {
            stopMusic();
        }
    });

    const GRID = 20;
    const CELL = canvas.width / GRID;
    const STEP_MS = 200;

    let snake, dir, nextDir, food, score, best, loopId, running, paused;

    function loadBest() {
        try {
            const v = localStorage.getItem('snake-best');
            return v ? parseInt(v, 10) : 0;
        } catch (e) { return 0; }
    }
    function saveBest(v) {
        try { localStorage.setItem('snake-best', String(v)); } catch (e) { }
    }

    function reset() {
        snake = [
            { x: 8, y: 10 },
            { x: 7, y: 10 },
            { x: 6, y: 10 }
        ];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        paused = false;
        scoreEl.textContent = '0';
        placeFood();
        draw();
    }

    function placeFood() {
        let pos;
        do {
            pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        } while (snake.some(s => s.x === pos.x && s.y === pos.y));
        food = pos;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // grid
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 1; i < GRID; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL, 0);
            ctx.lineTo(i * CELL, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * CELL);
            ctx.lineTo(canvas.width, i * CELL);
            ctx.stroke();
        }

        // food
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--food').trim();
        roundRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4, 6);
        ctx.fill();

        // snake
        snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0
                ? getComputedStyle(document.documentElement).getPropertyValue('--snake-head').trim()
                : getComputedStyle(document.documentElement).getPropertyValue('--snake').trim();
            roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 5);
            ctx.fill();
        });
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function tick() {
        if (paused) return;
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
            gameOver();
            return;
        }

        const ateFood = head.x === food.x && head.y === food.y;
        const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
        if (bodyToCheck.some(s => s.x === head.x && s.y === head.y)) {
            gameOver();
            return;
        }

        snake.unshift(head);

        if (ateFood) {
            score++;
            scoreEl.textContent = String(score);
            if (score > best) {
                best = score;
                bestEl.textContent = String(best);
                saveBest(best);
            }
            placeFood();
            playEat();
        } else {
            snake.pop();
        }

        draw();
    }

    function gameOver() {
        running = false;
        clearInterval(loopId);
        stopMusic();
        playGameOver();
        overlayTitle.textContent = 'Game over';
        overlayMsg.textContent = 'Score: ' + score + (score >= best && score > 0 ? ' — new best!' : '');
        startBtn.textContent = 'Play again';
        overlay.classList.remove('hidden');
    }

    function startGame() {
        reset();
        running = true;
        paused = false;
        overlay.classList.add('hidden');
        clearInterval(loopId);
        loopId = setInterval(tick, STEP_MS);
        startMusic();
    }

    function setDir(x, y) {
        // prevent reversing directly into itself
        if (snake.length > 1 && dir.x === -x && dir.y === -y) return;
        nextDir = { x, y };
    }

    function togglePause() {
        if (!running) return;
        paused = !paused;
        if (paused) {
            overlayTitle.textContent = 'Paused';
            overlayMsg.textContent = 'Press space or tap resume to continue.';
            startBtn.textContent = 'Resume';
            overlay.classList.remove('hidden');
            stopMusic();
        } else {
            overlay.classList.add('hidden');
            startMusic();
        }
    }

    startBtn.addEventListener('click', () => {
        if (running && paused) {
            paused = false;
            overlay.classList.add('hidden');
        } else {
            startGame();
        }
    });

    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': setDir(0, -1); e.preventDefault(); break;
            case 'ArrowDown': case 's': case 'S': setDir(0, 1); e.preventDefault(); break;
            case 'ArrowLeft': case 'a': case 'A': setDir(-1, 0); e.preventDefault(); break;
            case 'ArrowRight': case 'd': case 'D': setDir(1, 0); e.preventDefault(); break;
            case ' ': togglePause(); e.preventDefault(); break;
        }
    });

    document.getElementById('up').addEventListener('click', () => setDir(0, -1));
    document.getElementById('down').addEventListener('click', () => setDir(0, 1));
    document.getElementById('left').addEventListener('click', () => setDir(-1, 0));
    document.getElementById('right').addEventListener('click', () => setDir(1, 0));

    // swipe controls
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 20) setDir(dx > 0 ? 1 : -1, 0);
        } else {
            if (Math.abs(dy) > 20) setDir(0, dy > 0 ? 1 : -1);
        }
        touchStart = null;
    }, { passive: true });

    best = loadBest();
    bestEl.textContent = String(best);
    reset();
})();
