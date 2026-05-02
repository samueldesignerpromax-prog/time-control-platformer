/**
 * Time Control Platformer - SUPERHOT Style
 * O tempo só avança quando o jogador se move!
 * 
 * Controles:
 * - A/D ou ←/→: Movimento
 * - Espaço ou ↑: Pular
 * - Shift: Dash (movimento rápido)
 * 
 * Mecânica principal: TimeScale baseado no movimento do jogador
 */

// ==================== CONFIGURAÇÕES DO CANVAS ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 550;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ==================== SISTEMA DE TEMPO ====================
let timeScale = 0; // 0 = congelado, 1 = movimento normal
let playerMovementThisFrame = false;
let totalTime = 0;
let highScore = localStorage.getItem('timeControlHighScore') || 0;
let currentLevel = 1;
let enemiesAlive = 0;

// Elementos UI
const timeValueEl = document.getElementById('timeValue');
const levelValueEl = document.getElementById('levelValue');
const timeStatusEl = document.getElementById('timeStatus');
const statusDot = document.querySelector('.status-dot');
const timeBarEl = document.getElementById('timeBar');
const enemiesCountEl = document.getElementById('enemiesCount');
const highScoreEl = document.getElementById('highScore');

highScoreEl.textContent = highScore.toFixed(2);

// ==================== CONSTANTES DO JOGO ====================
const GRAVITY = 0.8;
const GROUND_Y = CANVAS_HEIGHT - 60;
const LEVEL_WIDTH = 2500; // Largura da fase

// ==================== ESTADO DO JOGO ====================
let gameRunning = true;
let cameraX = 0;
let frame = 0;

// Efeito visual de slow-motion
let slowMotionIntensity = 0;

// ==================== CLASSE DO JOGADOR ====================
class Player {
    constructor() {
        this.x = 100;
        this.y = GROUND_Y - 50;
        this.width = 30;
        this.height = 45;
        this.vx = 0;
        this.vy = 0;
        this.isJumping = false;
        this.facingRight = true;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Efeitos visuais
        this.trail = [];
        this.trailLength = 10;
    }
    
    update(deltaTime = 1) {
        if (!gameRunning) return;
        
        // Salvar posição anterior para rastro
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) this.trail.pop();
        
        // Aplicar movimento (escalado pelo deltaTime)
        if (!this.isDashing) {
            this.vx *= 0.96; // Atrito
        }
        this.x += this.vx * deltaTime;
        
        // Aplicar gravidade
        this.vy += GRAVITY * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Limites laterais
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > LEVEL_WIDTH) this.x = LEVEL_WIDTH - this.width;
        
        // Chão
        if (this.y + this.height >= GROUND_Y) {
            this.y = GROUND_Y - this.height;
            this.vy = 0;
            this.isJumping = false;
            this.isDashing = false;
        }
        
        // Atualizar dash
        if (this.dashTimer > 0) {
            this.dashTimer -= deltaTime;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }
        if (this.dashCooldown > 0) {
            this.dashCooldown -= deltaTime;
        }
        
        // Detectar movimento para o sistema de tempo
        const moved = Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
        if (moved && !this.isDashing) {
            playerMovementThisFrame = true;
        }
        
        // Atualizar direção
        if (this.vx !== 0) this.facingRight = this.vx > 0;
    }
    
    move(direction, deltaTime = 1) {
        if (!gameRunning) return;
        const speed = this.isDashing ? 12 : 5;
        this.vx += direction * speed * deltaTime;
        if (this.vx > 8) this.vx = 8;
        if (this.vx < -8) this.vx = -8;
    }
    
    jump() {
        if (!gameRunning) return;
        if (!this.isJumping && !this.isDashing) {
            this.vy = -10;
            this.isJumping = true;
            playJumpSound();
        }
    }
    
    dash() {
        if (!gameRunning) return;
        if (this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = 0.3;
            this.dashCooldown = 1;
            const dashForce = this.facingRight ? 15 : -15;
            this.vx = dashForce;
            playDashSound();
        }
    }
    
    takeDamage() {
        if (!gameRunning) return;
        gameOver();
    }
    
    draw() {
        ctx.save();
        
        // Efeito de rastro (trail)
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            if (!t) continue;
            const alpha = 0.3 - (i / this.trail.length) * 0.3;
            ctx.fillStyle = `rgba(0, 255, 255, ${alpha * (timeScale > 0 ? 1 : 0.5)})`;
            ctx.beginPath();
            ctx.roundRect(t.x - cameraX, t.y, this.width, this.height, 6);
            ctx.fill();
        }
        
        // Corpo do jogador (efeito ciano quando em movimento)
        const bodyColor = timeScale > 0 ? '#00ffff' : '#3388aa';
        ctx.fillStyle = bodyColor;
        ctx.shadowBlur = timeScale > 0 ? 10 : 2;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.roundRect(this.x - cameraX, this.y, this.width, this.height, 8);
        ctx.fill();
        
        // Cabeça
        ctx.fillStyle = '#00ccdd';
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width/2, this.y - 6, this.width/2.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Olhos (se movendo, brilham)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width*0.35, this.y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width*0.65, this.y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#0a0a1a';
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width*0.35 + (this.facingRight ? 1 : -1), this.y - 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width*0.65 + (this.facingRight ? 1 : -1), this.y - 8, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Efeito de dash
        if (this.isDashing) {
            ctx.fillStyle = '#ffff00';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.ellipse(this.x - cameraX + (this.facingRight ? -10 : this.width+10), this.y + this.height/2, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

// ==================== CLASSE DO INIMIGO ====================
class Enemy {
    constructor(x, y, type = 'patrol') {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 42;
        this.type = type;
        this.vx = 0.8;
        this.direction = 1;
        this.moveRange = 120;
        this.startX = x;
        this.shootTimer = 0;
        this.shootDelay = 2;
        this.health = 1;
        this.active = true;
    }
    
    update(deltaTime = 1) {
        if (!this.active) return;
        
        if (timeScale > 0) {
            // Patrulha
            this.x += this.vx * this.direction * deltaTime;
            
            if (this.x - this.startX > this.moveRange) {
                this.direction = -1;
            }
            if (this.x - this.startX < -this.moveRange) {
                this.direction = 1;
            }
            
            // Atirar
            if (this.type === 'shooter') {
                if (this.shootTimer <= 0) {
                    bullets.push(new Bullet(this.x + this.width/2, this.y + this.height/2, this.direction));
                    this.shootTimer = this.shootDelay;
                    playShootSound();
                } else {
                    this.shootTimer -= deltaTime;
                }
            }
        }
    }
    
    takeDamage() {
        this.active = false;
        enemiesAlive--;
        updateUI();
    }
    
    draw() {
        if (!this.active) return;
        
        const drawX = this.x - cameraX;
        
        // Cor do inimigo (vermelho)
        ctx.fillStyle = timeScale > 0 ? '#ff3366' : '#883344';
        ctx.shadowBlur = timeScale > 0 ? 5 : 1;
        ctx.beginPath();
        ctx.roundRect(drawX, this.y, this.width, this.height, 6);
        ctx.fill();
        
        // Cabeça
        ctx.fillStyle = '#ff5555';
        ctx.beginPath();
        ctx.arc(drawX + this.width/2, this.y - 5, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Olhos vermelhos
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(drawX + this.width*0.35, this.y - 7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + this.width*0.65, this.y - 7, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Arma (se for atirador)
        if (this.type === 'shooter') {
            ctx.fillStyle = '#666';
            ctx.fillRect(drawX + (this.direction === 1 ? this.width : -10), this.y + 15, 15, 6);
        }
        
        ctx.shadowBlur = 0;
    }
}

// ==================== CLASSE DO PROJÉTIL ====================
class Bullet {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 6;
        this.vx = direction * 4;
        this.active = true;
    }
    
    update(deltaTime = 1) {
        if (timeScale > 0) {
            this.x += this.vx * deltaTime;
            
            if (this.x < 0 || this.x > LEVEL_WIDTH) {
                this.active = false;
            }
        }
    }
    
    checkCollision(player) {
        if (this.x < player.x + player.width &&
            this.x + this.width > player.x &&
            this.y < player.y + player.height &&
            this.y + this.height > player.y) {
            return true;
        }
        return false;
    }
    
    draw() {
        const drawX = this.x - cameraX;
        ctx.fillStyle = timeScale > 0 ? '#ffff00' : '#886600';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(drawX, this.y, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.ellipse(drawX, this.y, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==================== PLATAFORMAS ====================
class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    
    draw() {
        ctx.fillStyle = '#445566';
        ctx.shadowBlur = 2;
        ctx.fillRect(this.x - cameraX, this.y, this.width, this.height);
        
        // Borda iluminada
        ctx.fillStyle = '#6688aa';
        ctx.fillRect(this.x - cameraX, this.y, this.width, 3);
    }
}

// ==================== ENTIDADES DO JOGO ====================
let player;
let enemies = [];
let bullets = [];
let platforms = [];

// ==================== CENÁRIO ====================
function createLevel() {
    platforms = [];
    
    // Chão base
    platforms.push(new Platform(0, GROUND_Y, LEVEL_WIDTH, 10));
    
    // Plataformas espalhadas
    platforms.push(new Platform(200, GROUND_Y - 80, 100, 20));
    platforms.push(new Platform(500, GROUND_Y - 140, 80, 20));
    platforms.push(new Platform(800, GROUND_Y - 100, 120, 20));
    platforms.push(new Platform(1200, GROUND_Y - 160, 80, 20));
    platforms.push(new Platform(1500, GROUND_Y - 120, 100, 20));
    platforms.push(new Platform(1900, GROUND_Y - 90, 100, 20));
    platforms.push(new Platform(2200, GROUND_Y - 150, 80, 20));
    
    // Inimigos (baseado no nível)
    enemies = [];
    enemiesAlive = 0;
    
    const enemyCount = Math.min(3 + currentLevel, 8);
    const enemyTypes = ['patrol', 'shooter'];
    
    for (let i = 0; i < enemyCount; i++) {
        const x = 300 + i * 250;
        const y = GROUND_Y - 42;
        const type = enemyTypes[i % enemyTypes.length];
        enemies.push(new Enemy(x, y, type));
        enemiesAlive++;
    }
    
    // Inimigos nas plataformas altas
    enemies.push(new Enemy(550, GROUND_Y - 140 - 42, 'shooter'));
    enemies.push(new Enemy(1250, GROUND_Y - 160 - 42, 'patrol'));
    enemies.push(new Enemy(1950, GROUND_Y - 90 - 42, 'shooter'));
    
    enemiesAlive += 3;
    updateUI();
}

// ==================== COLISÕES ====================
function checkCollisions() {
    if (!gameRunning) return;
    
    // Colisão com plataformas
    player.isJumping = true;
    for (let platform of platforms) {
        if (player.y + player.height > platform.y &&
            player.y < platform.y + platform.height &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            
            if (player.vy > 0 && player.y + player.height - player.vy <= platform.y) {
                player.y = platform.y - player.height;
                player.vy = 0;
                player.isJumping = false;
            }
        }
    }
    
    // Colisão com inimigos
    for (let enemy of enemies) {
        if (enemy.active &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            player.takeDamage();
        }
    }
    
    // Colisão com balas
    for (let i = 0; i < bullets.length; i++) {
        if (bullets[i].checkCollision(player)) {
            player.takeDamage();
            bullets.splice(i, 1);
            break;
        }
    }
}

// ==================== ATAQUE DO JOGADOR ====================
function playerAttack() {
    if (!gameRunning) return;
    
    // Área de ataque frontal
    const attackX = player.facingRight ? player.x + player.width : player.x - 25;
    const attackBox = {
        x: attackX,
        y: player.y,
        w: 35,
        h: player.height
    };
    
    for (let enemy of enemies) {
        if (enemy.active &&
            attackBox.x < enemy.x + enemy.width &&
            attackBox.x + attackBox.w > enemy.x &&
            attackBox.y < enemy.y + enemy.height &&
            attackBox.y + attackBox.h > enemy.y) {
            enemy.takeDamage();
            playHitSound();
        }
    }
}

// ==================== SISTEMA DE TEMPO PRINCIPAL ====================
function updateTimeSystem() {
    // Verificar se o jogador está se movendo
    const isMoving = Math.abs(player.vx) > 0.1 || 
                     Math.abs(player.vy) > 0.1 || 
                     player.isDashing;
    
    // Atualizar timeScale baseado no movimento
    if (isMoving && gameRunning) {
        timeScale = Math.min(1, timeScale + 0.05);
        playerMovementThisFrame = true;
    } else {
        timeScale = Math.max(0, timeScale - 0.03);
    }
    
    // Atualizar tempo total apenas quando o tempo está fluindo
    if (timeScale > 0.1 && gameRunning) {
        totalTime += 0.016 * timeScale; // ~60fps
        timeValueEl.textContent = totalTime.toFixed(2);
        
        if (totalTime > highScore) {
            highScore = totalTime;
            highScoreEl.textContent = highScore.toFixed(2);
            localStorage.setItem('timeControlHighScore', highScore);
        }
    }
    
    // Atualizar barra de tempo visual
    const timePercent = timeScale * 100;
    timeBarEl.style.width = `${timePercent}%`;
    timeBarEl.style.background = `linear-gradient(90deg, #00ffff, ${timeScale > 0.5 ? '#00ff44' : '#ff6600'})`;
    
    // Atualizar status UI
    const timeStatusSpan = document.querySelector('.time-status span');
    if (timeScale > 0.1) {
        timeStatusEl.innerHTML = '<span class="status-dot moving"></span> FLUINDO';
        timeStatusEl.style.color = '#00ff44';
    } else {
        timeStatusEl.innerHTML = '<span class="status-dot frozen"></span> CONGELADO';
        timeStatusEl.style.color = '#ff4444';
    }
    
    // Efeito visual de slow-motion
    slowMotionIntensity = 1 - timeScale;
    if (slowMotionIntensity > 0.3) {
        canvas.style.filter = `blur(${slowMotionIntensity * 3}px) grayscale(${slowMotionIntensity * 0.5})`;
    } else {
        canvas.style.filter = 'none';
    }
}

// ==================== SISTEMA DE CÂMERA ====================
function updateCamera() {
    let targetX = player.x + player.width/2 - CANVAS_WIDTH/2;
    targetX = Math.max(0, Math.min(targetX, LEVEL_WIDTH - CANVAS_WIDTH));
    cameraX = targetX;
}

// ==================== FIM DE FASE ====================
function checkLevelComplete() {
    if (player.x + player.width > LEVEL_WIDTH - 50) {
        currentLevel++;
        levelValueEl.textContent = currentLevel;
        player.x = 100;
        cameraX = 0;
        createLevel();
        playLevelUpSound();
    }
    
    // Verificar se todos inimigos morreram (bônus de tempo)
    if (enemiesAlive === 0 && gameRunning) {
        // Bônus de sobrevivência
        totalTime += 2;
    }
}

// ==================== SONS (Web Audio API) ====================
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playJumpSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 523.25;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

function playDashSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
    } catch(e) {}
}

function playShootSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 330;
        gain.gain.value = 0.08;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
    } catch(e) {}
}

function playHitSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 220;
        gain.gain.value = 0.12;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
    } catch(e) {}
}

function playLevelUpSound() {
    if (!audioContext) return;
    try {
        const freqs = [523, 659, 784];
        freqs.forEach((f, i) => {
            setTimeout(() => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = f;
                gain.gain.value = 0.1;
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
                osc.stop(audioContext.currentTime + 0.2);
            }, i * 100);
        });
    } catch(e) {}
}

function playGameOverSound() {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 150;
        gain.gain.value = 0.2;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        osc.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
}

// ==================== UI E ESTADO ====================
function updateUI() {
    enemiesCountEl.textContent = enemiesAlive;
}

function gameOver() {
    gameRunning = false;
    playGameOverSound();
    document.getElementById('finalTime').textContent = totalTime.toFixed(2);
    document.getElementById('finalLevel').textContent = currentLevel;
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function restartGame() {
    gameRunning = true;
    totalTime = 0;
    currentLevel = 1;
    timeScale = 0;
    cameraX = 0;
    
    player = new Player();
    bullets = [];
    createLevel();
    
    timeValueEl.textContent = '0.00';
    levelValueEl.textContent = '1';
    document.getElementById('gameOverlay').classList.add('hidden');
    updateUI();
}

// ==================== CONTROLES ====================
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
    KeyX: false
};

document.addEventListener('keydown', (e) => {
    const code = e.code;
    if (keys.hasOwnProperty(code)) {
        keys[code] = true;
        e.preventDefault();
    }
    
    // Ataque com X
    if (code === 'KeyX') {
        playerAttack();
    }
});

document.addEventListener('keyup', (e) => {
    const code = e.code;
    if (keys.hasOwnProperty(code)) {
        keys[code] = false;
        e.preventDefault();
    }
});

// Mobile controls
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnJump = document.getElementById('btnJump');
const btnDash = document.getElementById('btnDash');

let mobileLeft = false, mobileRight = false;

if (btnLeft) {
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); mobileLeft = true; });
    btnLeft.addEventListener('touchend', () => { mobileLeft = false; });
    btnLeft.addEventListener('mousedown', () => { mobileLeft = true; });
    btnLeft.addEventListener('mouseup', () => { mobileLeft = false; });
    
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); mobileRight = true; });
    btnRight.addEventListener('touchend', () => { mobileRight = false; });
    btnRight.addEventListener('mousedown', () => { mobileRight = true; });
    btnRight.addEventListener('mouseup', () => { mobileRight = false; });
    
    btnJump.addEventListener('click', () => player.jump());
    btnDash.addEventListener('click', () => player.dash());
}

if ('ontouchstart' in window) {
    document.getElementById('mobileControls').classList.remove('hidden');
}

function handleInput(deltaTime) {
    if (!gameRunning) return;
    
    let move = 0;
    if (keys.ArrowLeft || keys.KeyA || mobileLeft) move = -1;
    if (keys.ArrowRight || keys.KeyD || mobileRight) move = 1;
    
    if (move !== 0) {
        player.move(move, deltaTime);
    }
    
    if (keys.ArrowUp || keys.Space) {
        player.jump();
        keys.ArrowUp = false;
        keys.Space = false;
    }
    
    if (keys.ShiftLeft) {
        player.dash();
        keys.ShiftLeft = false;
    }
}

// ==================== CENÁRIO ====================
function drawBackground() {
    // Gradiente de fundo
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Grade futurista (efeito matrix)
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.1 + (1 - timeScale) * 0.2})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < CANVAS_WIDTH; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_WIDTH, i);
        ctx.stroke();
    }
    
    // Partículas de tempo (quando congelado)
    if (timeScale < 0.1) {
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = `rgba(0, 255, 255, ${Math.sin(Date.now() * 0.001 + i) * 0.1})`;
            ctx.beginPath();
            ctx.arc((Date.now() * 0.05 + i * 37) % CANVAS_WIDTH, Math.sin(Date.now() * 0.002 + i) * 20 + CANVAS_HEIGHT/2, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function draw() {
    drawBackground();
    
    // Desenhar plataformas
    for (let platform of platforms) {
        platform.draw();
    }
    
    // Desenhar projéteis
    for (let bullet of bullets) {
        bullet.draw();
    }
    
    // Desenhar inimigos
    for (let enemy of enemies) {
        enemy.draw();
    }
    
    // Desenhar jogador
    player.draw();
    
    // Linha de chegada
    ctx.fillStyle = '#00ff44';
    ctx.fillRect(LEVEL_WIDTH - 40 - cameraX, 0, 10, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffff00';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(LEVEL_WIDTH - 45 - cameraX, i * 100 + 50, 20, 5);
    }
    
    // Texto de instrução
    if (timeScale < 0.1 && !gameRunning) {
        ctx.fillStyle = '#00ffff88';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ MOVA-SE PARA DESCONGELAR O TEMPO ⚡', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    }
}

// ==================== LOOP PRINCIPAL ====================
let lastTimestamp = 0;

function gameLoop(timestamp) {
    // Delta time baseado no timeScale
    let deltaTime = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
    if (deltaTime > 0.1) deltaTime = 0.016;
    
    // Escalar deltaTime pelo timeScale
    const scaledDelta = deltaTime * timeScale;
    
    if (gameRunning) {
        handleInput(scaledDelta);
        player.update(scaledDelta);
        
        // Atualizar entidades apenas se o tempo está fluindo
        if (timeScale > 0) {
            for (let enemy of enemies) {
                enemy.update(scaledDelta);
            }
            for (let i = 0; i < bullets.length; i++) {
                bullets[i].update(scaledDelta);
                if (!bullets[i].active) {
                    bullets.splice(i, 1);
                    i--;
                }
            }
        }
        
        checkCollisions();
        updateCamera();
        checkLevelComplete();
    }
    
    updateTimeSystem();
    draw();
    
    lastTimestamp = timestamp;
    requestAnimationFrame(gameLoop);
}

function init() {
    player = new Player();
    createLevel();
    updateUI();
    gameLoop(0);
}

// Iniciar áudio ao primeiro clique
canvas.addEventListener('click', () => {
    initAudio();
});

// Botão de reinício
document.getElementById('restartButton').addEventListener('click', () => {
    initAudio();
    restartGame();
});

init();

// Helper: roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x+r, y);
        this.lineTo(x+w-r, y);
        this.quadraticCurveTo(x+w, y, x+w, y+r);
        this.lineTo(x+w, y+h-r);
        this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        this.lineTo(x+r, y+h);
        this.quadraticCurveTo(x, y+h, x, y+h-r);
        this.lineTo(x, y+r);
        this.quadraticCurveTo(x, y, x+r, y);
        return this;
    };
}

// Prevenir scroll com setas
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
    }
});
