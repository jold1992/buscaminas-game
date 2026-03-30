/* ============================================
   BUSCAMINAS — Lógica del juego
   Maneja el tablero, interacciones,
   animaciones y estado del juego
   ============================================ */

// ============================================
// CONFIGURACIÓN DE DIFICULTADES
// Define las dimensiones del tablero y la
// cantidad de minas para cada nivel
// ============================================
const DIFFS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 }
};

// ============================================
// VARIABLES DE ESTADO DEL JUEGO
// ============================================

// Dificultad actual seleccionada
let diff = 'easy';

// Dimensiones y cantidad de minas del tablero actual
let rows, cols, totalMines;

// board[r][c]:  -1 = mina, 0-8 = minas adyacentes
// revealed[r][c]: true si la celda fue revelada
// flagged[r][c]: true si la celda tiene bandera
let board, revealed, flagged;

// Flags de estado de la partida
let gameOver, gameWon, started;

// Control del temporizador (intervalo y segundos transcurridos)
let timerInterval, seconds;

// Indica si aún no se ha hecho el primer clic
let firstClick;

// Retrasos de animación por celda (clave: "r,c", valor: delay en ms)
// Se usa para la explosión escalonada de minas
let mineAnimDelays = {};

// Posición de la mina que explotó (para calcular distancias de animación)
let hitMineR = -1, hitMineC = -1;

// ============================================
// VARIABLES DE INTERACCIÓN TÁCTIL
// ============================================

// Timer para detectar long press (mantener presionado)
let longPressTimer = null;

// Posición inicial del toque (para cancelar long press si hay movimiento)
let touchStartPos = null;

// Indica si el long press ya fue activado
let longPressTriggered = false;

// Detecta si el dispositivo soporta touch
let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;


// ============================================
// CAMBIO DE DIFICULTAD
// Actualiza el botón activo y reinicia el juego
// Afecta: botones .ms-diff-btn, tablero completo
// ============================================
function setDiff(d) {
    diff = d;
    document.querySelectorAll('.ms-diff-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    restart();
}


// ============================================
// REAJUSTE AL REDIMENSIONAR LA VENTANA
// Recalcula el tamaño de las celdas y
// re-renderiza el grid (debounced a 150ms)
// Afecta: .ms-grid y sus .ms-cell
// ============================================
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderGrid(), 150);
});


// ============================================
// OVERLAY DE FIN DE JUEGO
// Muestra/oculta la pantalla de Game Over
// o Victoria sobre el tablero
// Afecta: .ms-overlay, .ms-overlay-title,
//         .ms-overlay-sub, .ms-overlay-btn
// ============================================
function showOverlay(type) {
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    const sub = document.getElementById('overlay-sub');
    const btn = document.getElementById('overlay-btn');

    // Aplica la clase 'lose' o 'win' para estilos de color
    title.className = 'ms-overlay-title ' + type;
    sub.className = 'ms-overlay-sub ' + type;
    btn.className = 'ms-overlay-btn ' + type;

    if (type === 'lose') {
        title.textContent = 'GAME OVER';
        sub.textContent = 'MINA ACTIVADA — MISIÓN FALLIDA';
    } else {
        title.textContent = 'VICTORIA';
        sub.textContent = `CAMPO DESPEJADO EN ${seconds}s — MISIÓN CUMPLIDA`;
    }

    overlay.classList.add('visible');
}

function hideOverlay() {
    document.getElementById('overlay').classList.remove('visible');
}


// ============================================
// REINICIAR PARTIDA
// Restablece todo el estado del juego y
// vuelve a renderizar el tablero vacío
// Afecta: tablero completo, HUD, overlay, status
// ============================================
function restart() {
    // Detiene el temporizador anterior si existe
    clearInterval(timerInterval);

    // Carga la configuración de la dificultad actual
    const cfg = DIFFS[diff];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;

    // Inicializa las matrices del tablero
    board = Array.from({ length: rows }, () => Array(cols).fill(0));
    revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
    flagged = Array.from({ length: rows }, () => Array(cols).fill(false));

    // Resetea los flags de estado
    gameOver = false;
    gameWon = false;
    started = false;
    firstClick = true;

    // Resetea datos de animación
    mineAnimDelays = {};
    hitMineR = -1;
    hitMineC = -1;
    seconds = 0;

    // Actualiza el HUD (minas restantes y temporizador)
    document.getElementById('timer').textContent = '000';
    document.getElementById('timer').classList.remove('red');
    document.getElementById('mine-count').textContent = String(totalMines).padStart(3, '0');

    // Muestra el texto de ayuda según el tipo de dispositivo
    if (isTouchDevice) {
        document.getElementById('status').textContent = 'TOCAR: revelar | MANTENER: marcar bandera';
    } else {
        document.getElementById('status').textContent = 'CLIC IZQUIERDO: revelar | CLIC DERECHO: marcar bandera';
    }
    document.getElementById('status').className = 'ms-status';

    // Oculta el overlay por si estaba visible (ej: al cambiar dificultad)
    hideOverlay();

    // Dibuja el tablero vacío
    renderGrid();
}


// ============================================
// COLOCACIÓN DE MINAS
// Se ejecuta una sola vez, después del primer
// clic. Coloca minas aleatorias evitando la
// zona segura alrededor del primer clic
// (3x3 centrada en safeR, safeC)
// Afecta: board[][] (se marca -1 para minas)
// ============================================
function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        // No colocar mina si ya hay una
        if (board[r][c] === -1) continue;

        // No colocar mina en la zona segura (3x3 alrededor del primer clic)
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;

        board[r][c] = -1;
        placed++;
    }

    // Calcula el número de minas adyacentes para cada celda no-mina
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (board[r][c] !== -1)
                board[r][c] = countAdj(r, c);
}


// ============================================
// CONTAR MINAS ADYACENTES
// Retorna cuántas minas hay en las 8 celdas
// circundantes a (r, c)
// ============================================
function countAdj(r, c) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === -1) n++;
        }
    return n;
}


// ============================================
// REVELAR CELDA (recursivo)
// Revela la celda (r, c). Si es un 0 (sin
// minas adyacentes), revela automáticamente
// todas las celdas vecinas (efecto cascada)
// Afecta: revealed[][], y recursivamente
//         celdas adyacentes
// ============================================
function reveal(r, c) {
    // Fuera de los límites del tablero
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    // No revelar si ya está revelada o tiene bandera
    if (revealed[r][c] || flagged[r][c]) return;

    revealed[r][c] = true;

    // Si la celda es 0 (sin minas adyacentes), revelar vecinos recursivamente
    if (board[r][c] === 0)
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
                reveal(r + dr, c + dc);
}


// ============================================
// MANEJAR CLIC IZQUIERDO
// Procesa el clic en una celda oculta.
// En el primer clic coloca las minas y
// arranca el temporizador.
// Si se clickea una mina, termina el juego.
// Afecta: board, revealed, timer, overlay
// ============================================
function handleClick(r, c) {
    // Ignorar clics si el juego ya terminó
    if (gameOver || gameWon) return;

    // No revelar celdas con bandera o ya reveladas
    if (flagged[r][c]) return;
    if (revealed[r][c]) return;

    // Primer clic: colocar minas y arrancar temporizador
    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        started = true;
        seconds = 0;
        timerInterval = setInterval(() => {
            seconds++;
            document.getElementById('timer').textContent = String(Math.min(seconds, 999)).padStart(3, '0');
        }, 1000);
    }

    // Si se pisa una mina: fin del juego
    if (board[r][c] === -1) {
        revealed[r][c] = true;
        gameOver = true;
        clearInterval(timerInterval);
        document.getElementById('timer').classList.add('red');
        hitMineR = r;
        hitMineC = c;

        // Revela todas las minas con animación escalonada
        revealAllMines(r, c);
        renderGrid();

        // Muestra el overlay después de que termine la animación más larga
        const maxDelay = Object.values(mineAnimDelays).reduce((a, b) => Math.max(a, b), 0);
        setTimeout(() => {
            showOverlay('lose');
        }, maxDelay + 500);
        return;
    }

    // Celda segura: revelar (con cascada si es 0) y verificar victoria
    reveal(r, c);
    checkWin();
    renderGrid();
}


// ============================================
// MANEJAR CLIC DERECHO (BANDERA)
// Alterna la bandera en una celda oculta.
// Actualiza el contador de minas restantes.
// Afecta: flagged[][], .ms-hud-val (minas)
// ============================================
function handleRightClick(e, r, c) {
    e.preventDefault();
    if (gameOver || gameWon || revealed[r][c]) return;

    flagged[r][c] = !flagged[r][c];

    // Recalcula minas restantes = total - banderas colocadas
    const rem = totalMines - flagged.flat().filter(Boolean).length;
    document.getElementById('mine-count').textContent = String(rem).padStart(3, '0');

    renderGrid();
}


// ============================================
// CHORD (DOBLE CLIC EN NÚMERO)
// Si las banderas adyacentes coinciden con
// el número de la celda, revela todas las
// celdas adyacentes sin bandera.
// Si alguna es mina, termina el juego.
// Afecta: revealed[][], puede activar gameOver
// ============================================
function chord(r, c) {
    // Solo funciona en celdas reveladas con número
    if (!revealed[r][c] || board[r][c] <= 0) return;

    // Cuenta banderas adyacentes
    let adjFlags = 0;
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && flagged[nr][nc]) adjFlags++;
        }

    // Solo ejecutar si las banderas coinciden con el número
    if (adjFlags !== board[r][c]) return;

    // Revelar todas las celdas adyacentes sin bandera
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (revealed[nr][nc] || flagged[nr][nc]) continue;

            // Si se revela una mina, fin del juego
            if (board[nr][nc] === -1) {
                revealed[nr][nc] = true;
                gameOver = true;
                clearInterval(timerInterval);
                document.getElementById('timer').classList.add('red');
                hitMineR = nr;
                hitMineC = nc;
                revealAllMines(nr, nc);
                renderGrid();
                const maxDelay = Object.values(mineAnimDelays).reduce((a, b) => Math.max(a, b), 0);
                setTimeout(() => showOverlay('lose'), maxDelay + 500);
                return;
            }

            // Revelar celda segura (con cascada si es 0)
            reveal(nr, nc);
        }

    checkWin();
    renderGrid();
}


// ============================================
// MANEJAR DOBLE CLIC
// Wrapper que valida y ejecuta el chord
// Afecta: llama a chord()
// ============================================
function handleDoubleClick(r, c) {
    if (gameOver || gameWon) return;
    if (!revealed[r][c] || board[r][c] <= 0) return;
    chord(r, c);
}


// ============================================
// REVELAR TODAS LAS MINAS
// Marca todas las minas no-banderadas como
// reveladas y calcula retrasos de animación
// basados en la distancia euclidiana a la
// mina que explotó (hr, hc)
// Afecta: revealed[][], mineAnimDelays{}
// ============================================
function revealAllMines(hr, hc) {
    mineAnimDelays = {};
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === -1 && !flagged[r][c]) {
                revealed[r][c] = true;

                // Distancia euclidiana a la mina activada (para delay escalonado)
                const dist = Math.sqrt((r - hr) ** 2 + (c - hc) ** 2);
                mineAnimDelays[`${r},${c}`] = dist * 60; // 60ms por unidad de distancia
            }
        }
    }
}


// ============================================
// VERIFICAR VICTORIA
// Comprueba si todas las celdas no-mina
// fueron reveladas. Si es así, declara
// victoria.
// Afecta: gameWon, status, overlay
// ============================================
function checkWin() {
    let safe = 0;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (revealed[r][c] && board[r][c] !== -1) safe++;

    if (safe === rows * cols - totalMines) {
        gameWon = true;
        clearInterval(timerInterval);
        document.getElementById('status').textContent = `** CAMPO DESPEJADO — ${seconds}s **`;
        document.getElementById('status').className = 'ms-status win';
        showOverlay('win');
    }
}


// ============================================
// RENDERIZAR TABLERO
// Genera el HTML del grid completo según el
// estado actual del juego. Calcula el tamaño
// de celda dinámicamente para que se ajuste
// al ancho del viewport.
// Afecta: #grid (innerHTML), todos los .ms-cell
// ============================================
function renderGrid() {
    const grid = document.getElementById('grid');

    // --- Cálculo dinámico del tamaño de celda ---
    // Ancho disponible: viewport - margen, tope 900px
    const availWidth = Math.min(window.innerWidth - 40, 900);

    // Gap y padding más pequeños en móvil
    const gap = window.innerWidth <= 600 ? 1 : 2;
    const padding = window.innerWidth <= 600 ? 4 : 8;

    // Tamaño de celda: entre 20px (mínimo toqueable) y 36px (máximo)
    const cellSize = Math.max(20, Math.min(36, Math.floor((availWidth - padding * 2 - gap * (cols - 1)) / cols)));

    grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    grid.innerHTML = '';

    // --- Generación de celdas ---
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'ms-cell';

            // Aplica tamaño calculado dinámicamente
            cell.style.width = cellSize + 'px';
            cell.style.height = cellSize + 'px';
            cell.style.fontSize = Math.max(12, cellSize - 10) + 'px';

            const isMine = board[r][c] === -1;
            const isRev = revealed[r][c];
            const isFlag = flagged[r][c];

            // --- Determina el estado visual de la celda ---

            if (isFlag && !isRev) {
                // Celda con bandera
                cell.classList.add('flagged');
                cell.textContent = '⚑';
            } else if (!isRev) {
                // Celda oculta (sin revelar)
                cell.classList.add('hidden');
                cell.textContent = '';
            } else if (isMine) {
                if (gameOver) {
                    // Mina que explotó (la clickeada)
                    cell.classList.add('mine-hit');
                    cell.textContent = '✱';
                    // Aplica animación con retraso si está definido
                    const delay = mineAnimDelays[`${r},${c}`];
                    if (delay !== undefined) {
                        cell.classList.add('animating');
                        cell.style.animationDelay = delay + 'ms';
                    }
                } else {
                    // Otras minas reveladas (no explotadas)
                    cell.classList.add('mine-show');
                    cell.textContent = '✱';
                    const delay = mineAnimDelays[`${r},${c}`];
                    if (delay !== undefined) {
                        cell.classList.add('animating');
                        cell.style.animationDelay = delay + 'ms';
                    }
                }
            } else {
                // Celda segura revelada
                cell.classList.add('revealed');
                const n = board[r][c];
                if (n > 0) {
                    cell.classList.add('n' + n); // Color según número (n1..n8)
                    cell.textContent = n;
                }
            }

            // --- Registro de eventos de interacción ---
            const _r = r, _c = c;

            // Clic izquierdo: revelar celda
            cell.addEventListener('click', () => handleClick(_r, _c));

            // Clic derecho: alternar bandera
            cell.addEventListener('contextmenu', (e) => handleRightClick(e, _r, _c));

            // Doble clic: chord (revelar adyacentes si las banderas coinciden)
            cell.addEventListener('dblclick', () => handleDoubleClick(_r, _c));

            // --- Eventos táctiles para dispositivos móviles ---
            let lastTap = 0;

            // Touch end: detecta doble toque (300ms) para chord,
            // o ignora si fue un long press (bandera)
            cell.addEventListener('touchend', (e) => {
                clearTimeout(longPressTimer);

                // Si fue long press, cancelar el click normal
                if (longPressTriggered) {
                    e.preventDefault();
                    longPressTriggered = false;
                    return;
                }

                // Detección de doble toque
                const now = Date.now();
                if (now - lastTap < 300) {
                    e.preventDefault();
                    handleDoubleClick(_r, _c);
                    lastTap = 0;
                } else {
                    lastTap = now;
                }
            });

            // Touch start: inicia timer de long press (400ms) para bandera
            cell.addEventListener('touchstart', (e) => {
                longPressTriggered = false;
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    handleRightClick(e, _r, _c);
                    // Vibración háptica al colocar bandera
                    if (navigator.vibrate) navigator.vibrate(50);
                }, 400);
            }, { passive: true });

            // Touch move: cancela long press si el dedo se mueve más de 10px
            cell.addEventListener('touchmove', (e) => {
                if (!touchStartPos) return;
                const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
                if (dx > 10 || dy > 10) {
                    clearTimeout(longPressTimer);
                }
            }, { passive: true });

            grid.appendChild(cell);
        }
    }
}


// ============================================
// INICIALIZACIÓN
// Arranca el juego en dificultad fácil
// ============================================
restart();
