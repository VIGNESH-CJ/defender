// --- CANVAS SETUP ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- UI ELEMENTS ---
const scoreVal = document.getElementById("score-val");
const highscoreVal = document.getElementById("highscore-val");
const healthVal = document.getElementById("health-val");
const finalScoreVal = document.getElementById("final-score-val");

const startScreen = document.getElementById("start-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

// --- GAME STATE ---
let score = 0;
let highScore = localStorage.getItem("cosmic_highscore") || 0;
let health = 100;
let isGameRunning = false;
let animationFrameId = null;
let lastTime = 0;

highscoreVal.textContent = highScore;

// --- INPUT HANDLER ---
const keys = {
  left: false,
  right: false
};

// Prevent spacebar repeat keypress spam & fix browser scrolling behavior
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // Prevents page scrolling/fast triggers
    if (!e.repeat && isGameRunning) {
      shootLaser();
    }
  }
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

// --- ENTITIES ---
class Player {
  constructor() {
    this.width = 40;
    this.height = 40;
    this.x = canvas.width / 2 - this.width / 2;
    this.y = canvas.height - 60;
    this.speed = 6;
  }

  draw() {
    ctx.fillStyle = "#00f0ff";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00f0ff";

    // Draw Spaceship
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height - 10);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  update() {
    if (keys.left && this.x > 0) this.x -= this.speed;
    if (keys.right && this.x + this.width < canvas.width) this.x += this.speed;
  }
}

class Laser {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 4;
    this.height = 16;
    this.speed = 10;
  }

  draw() {
    ctx.fillStyle = "#ffe600";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffe600";
    ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }

  update() {
    this.y -= this.speed;
  }
}

class Enemy {
  constructor() {
    this.width = 34;
    this.height = 30;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -this.height;
    this.speed = 2 + Math.random() * 1.5;
    this.color = Math.random() > 0.5 ? "#ff0055" : "#b000ff";
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  update() {
    this.y += this.speed;
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.radius = Math.random() * 3 + 1;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.03;
  }
}

class Star {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.radius = Math.random() * 1.5;
    this.speed = Math.random() * 0.8 + 0.2;
  }

  draw() {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  update() {
    this.y += this.speed;
    if (this.y > canvas.height) {
      this.y = 0;
      this.x = Math.random() * canvas.width;
    }
  }
}

// --- GAME OBJECTS CONTAINER ---
let player = new Player();
let lasers = [];
let enemies = [];
let particles = [];
let stars = Array.from({ length: 60 }, () => new Star());
let spawnTimer = 0;

function createExplosion(x, y, color) {
  for (let i = 0; i < 15; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function shootLaser() {
  lasers.push(new Laser(player.x + player.width / 2, player.y));
}

// --- RESET GAME STATE ---
function initGame() {
  // Cancel previous animation loop if running to prevent double-speed bug
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  score = 0;
  health = 100;
  player = new Player();
  lasers = [];
  enemies = [];
  particles = [];
  spawnTimer = 0;

  scoreVal.textContent = score;
  healthVal.textContent = health;

  startScreen.classList.remove("active");
  gameoverScreen.classList.remove("active");

  isGameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// --- MAIN LOOP ---
function gameLoop(currentTime) {
  if (!isGameRunning) return;

  // Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Stars
  stars.forEach((star) => {
    star.update();
    star.draw();
  });

  // Player logic
  player.update();
  player.draw();

  // Update & Draw Lasers
  for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
    let laser = lasers[lIndex];
    laser.update();
    laser.draw();

    if (laser.y < -laser.height) {
      lasers.splice(lIndex, 1);
    }
  }

  // Spawn Enemies
  spawnTimer++;
  if (spawnTimer % 50 === 0) {
    enemies.push(new Enemy());
  }

  // Update & Draw Enemies
  for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
    let enemy = enemies[eIndex];
    enemy.update();
    enemy.draw();

    // Collision: Enemy reaching bottom
    if (enemy.y > canvas.height) {
      enemies.splice(eIndex, 1);
      health -= 10;
      healthVal.textContent = Math.max(0, health);
      if (health <= 0) {
        triggerGameOver();
        return;
      }
      continue;
    }

    // Collision: Enemy hit by Laser
    for (let lIndex = lasers.length - 1; lIndex >= 0; lIndex--) {
      let laser = lasers[lIndex];
      if (
        laser.x > enemy.x &&
        laser.x < enemy.x + enemy.width &&
        laser.y > enemy.y &&
        laser.y < enemy.y + enemy.height
      ) {
        createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
        enemies.splice(eIndex, 1);
        lasers.splice(lIndex, 1);
        score += 100;
        scoreVal.textContent = score;
        break;
      }
    }

    // Collision: Enemy hits Player
    if (
      enemy.x < player.x + player.width &&
      enemy.x + enemy.width > player.x &&
      enemy.y < player.y + player.height &&
      enemy.y + enemy.height > player.y
    ) {
      createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
      enemies.splice(eIndex, 1);
      health -= 20;
      healthVal.textContent = Math.max(0, health);
      if (health <= 0) {
        triggerGameOver();
        return;
      }
    }
  }

  // Update & Draw Particles
  for (let pIndex = particles.length - 1; pIndex >= 0; pIndex--) {
    let particle = particles[pIndex];
    particle.update();
    particle.draw();
    if (particle.alpha <= 0) {
      particles.splice(pIndex, 1);
    }
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// --- GAME OVER ---
function triggerGameOver() {
  isGameRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("cosmic_highscore", highScore);
    highscoreVal.textContent = highScore;
  }

  finalScoreVal.textContent = score;
  gameoverScreen.classList.add("active");
}

// --- BUTTON LISTENERS ---
startBtn.addEventListener("click", initGame);
restartBtn.addEventListener("click", initGame);