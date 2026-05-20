const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Images ---
const bgImage = new Image();
bgImage.src = 'background.jpg';
const playerImage = new Image();
playerImage.src = 'player.png';
const enemyImage = new Image();
enemyImage.src = 'enemy.png';

// --- Audio ---
const bgMusic = new Audio('sounds/bg.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;
const hitSound = new Audio('sounds/hit.wav');
const spawnSound = new Audio('sounds/spawn.wav');

let audioUnlocked = false;
function initAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  [bgMusic, hitSound, spawnSound].forEach(a => {
    a.play().then(() => a.pause()).catch(() => {});
  });
}

function playSound(sound) {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// --- Responsive canvas ---
const wrapper = document.getElementById('wrapper');
const touchControls = document.getElementById('touchControls');
const isTouchDevice = document.documentElement.classList.contains('touch-device');

function resizeCanvas() {
  const controlsH = isTouchDevice ? touchControls.offsetHeight || 80 : 0;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - controlsH;
  const scale = Math.min(maxW / 480, maxH / 640);
  canvas.style.width = `${Math.floor(480 * scale)}px`;
  canvas.style.height = `${Math.floor(640 * scale)}px`;
}

window.addEventListener('resize', resizeCanvas);

// --- Game state ---
const player = {
  x: canvas.width / 2 - 20,
  y: canvas.height - 60,
  width: 40,
  height: 40,
  speed: 5,
  moveLeft: false,
  moveRight: false,
  bullets: [],
};

let enemies = [];
let powerUps = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('dodgeHighScore')) || 0;
let lives = 3;
let gameOver = false;
let started = false;
let paused = false;
let enemySpeed = 2;
let shieldActive = false;
let shieldTimer = 0;
let isNewHighScore = false;
let frameCount = 0;

// --- Drawing ---
function drawBackground() {
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
  ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
  if (shieldActive) {
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemies() {
  enemies.forEach(e => ctx.drawImage(enemyImage, e.x, e.y, e.width, e.height));
}

function drawPowerUps() {
  powerUps.forEach(p => {
    ctx.fillStyle = p.type === 'shield' ? 'cyan' : 'orange';
    ctx.fillRect(p.x, p.y, 20, 20);
  });
}

function drawBullets() {
  ctx.fillStyle = 'yellow';
  player.bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));
}

function drawUI() {
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);
  ctx.fillText(`Lives: ${lives}`, canvas.width - 90, 30);
  if (shieldActive) {
    ctx.fillStyle = 'cyan';
    ctx.fillText('SHIELD', canvas.width / 2 - 32, 30);
  }
}

function drawOverlay(text) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.font = '36px Arial';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 60);
  ctx.font = '24px Arial';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
  if (isNewHighScore) {
    ctx.fillStyle = 'gold';
    ctx.fillText('New High Score!', canvas.width / 2, canvas.height / 2 + 15);
    ctx.fillStyle = 'white';
  } else {
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 15);
  }
  ctx.font = '20px Arial';
  ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 55);
  ctx.textAlign = 'left';
}

// --- Update ---
function updateEnemies() {
  enemies.forEach(e => e.y += enemySpeed);
  enemies = enemies.filter(e => e.y < canvas.height);
}

function updatePowerUps() {
  powerUps.forEach(p => p.y += 2);
  powerUps = powerUps.filter(p => p.y < canvas.height);
}

function updateBullets() {
  player.bullets.forEach(b => b.y -= 8);
  player.bullets = player.bullets.filter(b => b.y > 0);
}

function checkCollision(a, b) {
  const aW = a.width || 4;
  const aH = a.height || 10;
  return a.x < b.x + b.width && a.x + aW > b.x && a.y < b.y + b.height && a.y + aH > b.y;
}

function handleCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (checkCollision(player, enemies[i])) {
      if (!shieldActive) {
        lives--;
        playSound(hitSound);
        if (lives <= 0) {
          gameOver = true;
          bgMusic.pause();
          isNewHighScore = score > highScore;
          if (isNewHighScore) {
            highScore = score;
            localStorage.setItem('dodgeHighScore', highScore);
          }
        }
      }
      enemies.splice(i, 1);
      continue;
    }
    for (let j = player.bullets.length - 1; j >= 0; j--) {
      if (checkCollision(player.bullets[j], enemies[i])) {
        enemies.splice(i, 1);
        player.bullets.splice(j, 1);
        score += 10;
        playSound(hitSound);
        break;
      }
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    if (checkCollision(player, powerUps[i])) {
      if (powerUps[i].type === 'shield') {
        shieldActive = true;
        shieldTimer = 300;
      }
      powerUps.splice(i, 1);
    }
  }
}

function shoot() {
  player.bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y,
  });
}

function createEnemy() {
  const x = Math.random() * (canvas.width - 40);
  enemies.push({ x, y: -40, width: 40, height: 40 });
  playSound(spawnSound);
}

function createPowerUp() {
  const x = Math.random() * (canvas.width - 20);
  powerUps.push({ x, y: -20, width: 20, height: 20, type: 'shield' });
}

function startGame() {
  if (started) return;
  started = true;
  initAudio();
  bgMusic.play().catch(() => {});
}

function resetGame() {
  enemies = [];
  powerUps = [];
  player.bullets = [];
  score = 0;
  lives = 3;
  enemySpeed = 2;
  shieldActive = false;
  shieldTimer = 0;
  isNewHighScore = false;
  frameCount = 0;
  player.x = canvas.width / 2 - 20;
  gameOver = false;
  started = true;
  initAudio();
  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  paused ? bgMusic.pause() : bgMusic.play().catch(() => {});
}

// --- Game loop ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (!started) {
    drawOverlay('Press Enter or Tap to Start');
    requestAnimationFrame(gameLoop);
    return;
  }

  if (paused) {
    drawOverlay('Paused');
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!gameOver) {
    if (player.moveLeft && player.x > 0) player.x -= player.speed;
    if (player.moveRight && player.x + player.width < canvas.width) player.x += player.speed;

    updateEnemies();
    updatePowerUps();
    updateBullets();
    handleCollisions();

    drawPlayer();
    drawEnemies();
    drawPowerUps();
    drawBullets();
    drawUI();

    frameCount++;
    if (frameCount % 60 === 0) score++;

    if (frameCount % 500 === 0) enemySpeed += 0.5;
    if (frameCount % 800 === 0) createPowerUp();

    if (shieldActive) {
      shieldTimer--;
      if (shieldTimer <= 0) shieldActive = false;
    }
  } else {
    drawGameOver();
  }

  requestAnimationFrame(gameLoop);
}

// --- Input: Keyboard ---
document.addEventListener('keydown', (e) => {
  initAudio();
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.moveLeft = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.moveRight = true;
  if (e.key === ' ' && started && !paused && !gameOver) { e.preventDefault(); shoot(); }
  if ((e.key === 'Enter' || e.key === ' ') && !started) { e.preventDefault(); startGame(); }
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'r' && gameOver) resetGame();
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.moveLeft = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.moveRight = false;
});

// --- Input: Canvas click (desktop only) ---
if (!isTouchDevice) {
  canvas.addEventListener('click', () => {
    initAudio();
    if (!started) { startGame(); }
  });
}

// --- Input: Touch buttons ---
function setupButton(id, onStart, onEnd) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('mousedown', onStart);
  el.addEventListener('mouseup', onEnd);
  el.addEventListener('mouseleave', onEnd);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); onStart(); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); onEnd(); });
}

setupButton('leftBtn', () => { startGame(); player.moveLeft = true; }, () => player.moveLeft = false);
setupButton('rightBtn', () => { startGame(); player.moveRight = true; }, () => player.moveRight = false);
setupButton('shootBtn', () => { startGame(); if (started && !paused && !gameOver) shoot(); }, () => {});
setupButton('pauseBtn', () => { startGame(); togglePause(); }, () => {});

// --- Enemy spawn timer ---
setInterval(() => {
  if (started && !gameOver && !paused) createEnemy();
}, 800);

// --- Boot ---
window.addEventListener('load', () => {
  resizeCanvas();
  gameLoop();
});
