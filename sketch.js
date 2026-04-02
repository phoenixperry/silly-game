// Space Invaders in p5.js — Mobile + Desktop

let player;
let bullets = [];
let enemyBullets = [];
let invaders = [];
let barriers = [];
let particles = [];
let stars = [];
let score = 0;
let lives = 3;
let gameState = "play";
let invaderDirection = 1;
let invaderSpeed = 0.5;
let invaderDropAmount;
let lastEnemyShot = 0;
let enemyShotInterval = 1200;
let level = 1;
let shakeTimer = 0;
let flashTimer = 0;

// Scaling
let S = 1; // scale factor
let GW = 600; // game world width
let GH = 700; // game world height

// Touch controls
let isMobile = false;
let touchLeftActive = false;
let touchRightActive = false;
let touchShootActive = false;
let lastAutoShot = 0;
let autoShotInterval = 300;
let btnSize, btnY, btnMargin;
let playerMinX = 20;
let playerMaxX = 580;

function setup() {
  isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
             (windowWidth < 800 && "ontouchstart" in window);

  // Always fill the full window
  let cw = windowWidth;
  let ch = windowHeight;

  // Scale game world to fit, preserving aspect ratio
  let sx = cw / GW;
  let sy = ch / GH;
  S = min(sx, sy);

  // Use full window as canvas, we'll center the game world inside it
  createCanvas(cw, ch);
  textFont("monospace");

  invaderDropAmount = 20;
  btnSize = 70 * S;
  btnMargin = 20 * S;
  btnY = ch - btnSize - btnMargin;

  // Compute player movement bounds so it can't slide under touch buttons
  if (isMobile) {
    let leftZoneScreen = btnMargin + btnSize * 2 + btnMargin * 2 + 10;
    let rightZoneScreen = btnMargin + btnSize + 10;
    playerMinX = leftZoneScreen / S + 26;
    playerMaxX = GW - rightZoneScreen / S - 26;
  } else {
    playerMinX = 28;
    playerMaxX = GW - 28;
  }

  initStars();
  initGame();
}

function windowResized() {
  setup();
}

function initStars() {
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: random(GW),
      y: random(GH),
      size: random(0.5, 2.5),
      speed: random(0.1, 0.6),
      brightness: random(100, 255)
    });
  }
}

function initGame() {
  player = new Player();
  bullets = [];
  enemyBullets = [];
  invaders = [];
  barriers = [];
  particles = [];

  invaderDirection = 1;
  invaderSpeed = 0.5 + (level - 1) * 0.15;
  enemyShotInterval = max(400, 1200 - (level - 1) * 100);

  let types = [3, 2, 2, 1, 1];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      let x = 60 + col * 48;
      let y = 80 + row * 40;
      invaders.push(new Invader(x, y, types[row]));
    }
  }

  for (let i = 0; i < 4; i++) {
    let bx = 90 + i * 130;
    barriers.push(new Barrier(bx, 560));
  }
}

// Offset to center the game world in the canvas
function gameOffsetX() {
  return (width - GW * S) / 2;
}
function gameOffsetY() {
  return (height - GH * S) / 2;
}

function draw() {
  background(0);

  push();
  translate(gameOffsetX(), gameOffsetY());
  scale(S);

  drawStars();

  if (shakeTimer > 0) {
    translate(random(-3, 3), random(-3, 3));
    shakeTimer--;
  }

  if (flashTimer > 0) {
    background(255, 0, 0, map(flashTimer, 0, 10, 0, 40));
    flashTimer--;
  }

  if (gameState === "play") {
    updateGame();
  }

  drawGame();
  drawHUD();

  if (gameState === "gameover") {
    drawCenterText("GAME OVER", isMobile ? "Tap to restart" : "Press ENTER to restart");
  } else if (gameState === "win") {
    drawCenterText("LEVEL " + level + " COMPLETE!", isMobile ? "Tap for next level" : "Press ENTER for next level");
  }

  pop();

  // Draw touch controls on top (unscaled, in screen coords)
  if (isMobile && gameState === "play") {
    drawTouchControls();
  }
}

function drawStars() {
  noStroke();
  for (let s of stars) {
    s.y += s.speed;
    if (s.y > GH) {
      s.y = 0;
      s.x = random(GW);
    }
    let flicker = s.brightness + random(-30, 30);
    fill(flicker, flicker, flicker + 20);
    circle(s.x, s.y, s.size);
  }
}

function updateGame() {
  player.update();

  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    if (bullets[i].offscreen()) bullets.splice(i, 1);
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    enemyBullets[i].update();
    if (enemyBullets[i].offscreen()) enemyBullets.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  moveInvaders();

  if (millis() - lastEnemyShot > enemyShotInterval && invaders.length > 0) {
    enemyShoot();
    lastEnemyShot = millis();
  }

  // Auto-fire on mobile while shoot button held
  if (isMobile && touchShootActive && millis() - lastAutoShot > autoShotInterval) {
    if (bullets.length < 3) {
      bullets.push(new Bullet(player.x, player.y - 15));
      lastAutoShot = millis();
    }
  }

  checkCollisions();

  if (invaders.length === 0) {
    gameState = "win";
  }
}

function moveInvaders() {
  let shouldDrop = false;

  for (let inv of invaders) {
    inv.x += invaderSpeed * invaderDirection;
  }

  for (let inv of invaders) {
    if (inv.x > GW - 30 || inv.x < 30) {
      shouldDrop = true;
      break;
    }
  }

  if (shouldDrop) {
    invaderDirection *= -1;
    for (let inv of invaders) {
      inv.y += invaderDropAmount;
    }
    invaderSpeed += 0.1;
  }

  for (let inv of invaders) {
    if (inv.y > player.y - 20) {
      gameState = "gameover";
    }
  }

  for (let inv of invaders) {
    inv.animTimer++;
  }
}

function enemyShoot() {
  let columns = {};
  for (let inv of invaders) {
    let col = Math.round(inv.x / 48);
    if (!columns[col] || inv.y > columns[col].y) {
      columns[col] = inv;
    }
  }
  let shooters = Object.values(columns);
  if (shooters.length > 0) {
    let shooter = random(shooters);
    enemyBullets.push(new EnemyBullet(shooter.x, shooter.y + 15));
  }
}

function checkCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = invaders.length - 1; j >= 0; j--) {
      if (bullets[i] && invaders[j].hit(bullets[i])) {
        spawnExplosion(invaders[j].x, invaders[j].y, invaders[j].getColor());
        score += invaders[j].type * 10;
        invaders.splice(j, 1);
        bullets.splice(i, 1);
        if (invaders.length > 0 && invaders.length % 5 === 0) {
          invaderSpeed += 0.15;
        }
        break;
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let b of barriers) {
      if (b.hitByBullet(bullets[i])) {
        bullets.splice(i, 1);
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    for (let b of barriers) {
      if (b.hitByBullet(enemyBullets[i])) {
        enemyBullets.splice(i, 1);
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    if (enemyBullets[i] && player.hit(enemyBullets[i])) {
      enemyBullets.splice(i, 1);
      lives--;
      shakeTimer = 15;
      flashTimer = 10;
      spawnExplosion(player.x, player.y, color(0, 255, 100));
      if (lives <= 0) {
        gameState = "gameover";
      }
    }
  }

  for (let inv of invaders) {
    for (let b of barriers) {
      b.hitByInvader(inv);
    }
  }
}

function spawnExplosion(x, y, col) {
  for (let i = 0; i < 15; i++) {
    particles.push(new Particle(x, y, col));
  }
}

function drawGame() {
  for (let b of barriers) b.draw();
  for (let inv of invaders) inv.draw();
  player.draw();
  for (let b of bullets) b.draw();
  for (let b of enemyBullets) b.draw();
  for (let p of particles) p.draw();
}

function drawHUD() {
  noStroke();
  fill(255);
  textSize(18);
  textAlign(LEFT);
  text("SCORE: " + score, 20, 30);

  textAlign(CENTER);
  text("LEVEL " + level, GW / 2, 30);

  textAlign(RIGHT);
  text("LIVES: ", GW - 100, 30);
  for (let i = 0; i < lives; i++) {
    drawMiniShip(GW - 80 + i * 25, 24);
  }
}

function drawMiniShip(x, y) {
  noStroke();
  // Mini cat head
  fill(0, 255, 100);
  // Ears
  triangle(x - 7, -1 + y, x - 5, -7 + y, x - 2, 0 + y);
  triangle(x + 7, -1 + y, x + 5, -7 + y, x + 2, 0 + y);
  // Head
  ellipse(x, y, 14, 11);
  // Eyes
  fill(0);
  ellipse(x - 3, y - 1, 3, 3);
  ellipse(x + 3, y - 1, 3, 3);
}

function drawCenterText(title, subtitle) {
  fill(0, 0, 0, 160);
  noStroke();
  rect(0, GH / 2 - 60, GW, 120);

  fill(255);
  textAlign(CENTER);
  textSize(36);
  text(title, GW / 2, GH / 2 - 10);
  textSize(16);
  fill(200);
  text(subtitle, GW / 2, GH / 2 + 30);
}

// ---- Touch Controls ----

function drawTouchControls() {
  push();
  // Reset transform (we're drawing in screen space)
  resetMatrix();
  noStroke();

  let bs = btnSize;
  let m = btnMargin;
  let y = btnY;
  let alpha = 60;

  // Left button
  fill(255, 255, 255, touchLeftActive ? alpha + 40 : alpha);
  rect(m, y, bs, bs, 12);
  fill(255, 255, 255, 180);
  textAlign(CENTER, CENTER);
  textSize(bs * 0.45);
  text("\u25C0", m + bs / 2, y + bs / 2);

  // Right button
  fill(255, 255, 255, touchRightActive ? alpha + 40 : alpha);
  rect(m + bs + m, y, bs, bs, 12);
  fill(255, 255, 255, 180);
  text("\u25B6", m + bs + m + bs / 2, y + bs / 2);

  // Fire button
  fill(255, 80, 80, touchShootActive ? alpha + 60 : alpha);
  let fx = width - m - bs;
  rect(fx, y, bs, bs, 12);
  fill(255, 255, 255, 180);
  text("FIRE", fx + bs / 2, y + bs / 2);

  pop();
}

function getTouchButton(tx, ty) {
  let bs = btnSize;
  let m = btnMargin;
  let by = btnY;

  // Left
  if (tx >= m && tx <= m + bs && ty >= by && ty <= by + bs) return "left";
  // Right
  if (tx >= m + bs + m && tx <= m + bs + m + bs && ty >= by && ty <= by + bs) return "right";
  // Fire
  let fx = width - m - bs;
  if (tx >= fx && tx <= fx + bs && ty >= by && ty <= by + bs) return "fire";

  return null;
}

function touchStarted() {
  if (!isMobile) return;

  if (gameState === "gameover") {
    score = 0; lives = 3; level = 1;
    gameState = "play"; initGame();
    return false;
  }
  if (gameState === "win") {
    level++;
    gameState = "play"; initGame();
    return false;
  }

  for (let t of touches) {
    let btn = getTouchButton(t.x, t.y);
    if (btn === "left") touchLeftActive = true;
    if (btn === "right") touchRightActive = true;
    if (btn === "fire") {
      touchShootActive = true;
      // Immediate first shot
      if (bullets.length < 3) {
        bullets.push(new Bullet(player.x, player.y - 15));
        lastAutoShot = millis();
      }
    }
  }
  return false;
}

function touchMoved() {
  if (!isMobile) return;
  touchLeftActive = false;
  touchRightActive = false;
  touchShootActive = false;

  for (let t of touches) {
    let btn = getTouchButton(t.x, t.y);
    if (btn === "left") touchLeftActive = true;
    if (btn === "right") touchRightActive = true;
    if (btn === "fire") touchShootActive = true;
  }
  return false;
}

function touchEnded() {
  if (!isMobile) return;
  // Recalculate from remaining touches
  touchLeftActive = false;
  touchRightActive = false;
  touchShootActive = false;

  for (let t of touches) {
    let btn = getTouchButton(t.x, t.y);
    if (btn === "left") touchLeftActive = true;
    if (btn === "right") touchRightActive = true;
    if (btn === "fire") touchShootActive = true;
  }
  return false;
}

// ---- Keyboard ----

function keyPressed() {
  if (key === " " && gameState === "play") {
    if (bullets.length < 3) {
      bullets.push(new Bullet(player.x, player.y - 15));
    }
  }

  if (keyCode === ENTER) {
    if (gameState === "gameover") {
      score = 0; lives = 3; level = 1;
      gameState = "play"; initGame();
    } else if (gameState === "win") {
      level++;
      gameState = "play"; initGame();
    }
  }
}

// ---- Classes ----

class Player {
  constructor() {
    this.x = GW / 2;
    this.y = GH - 50;
    this.w = 40;
    this.speed = 5;
  }

  update() {
    // Keyboard
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) this.x -= this.speed;
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) this.x += this.speed;
    // Touch
    if (touchLeftActive) this.x -= this.speed;
    if (touchRightActive) this.x += this.speed;

    this.x = constrain(this.x, playerMinX, playerMaxX);
  }

  draw() {
    push();
    translate(this.x, this.y);
    noStroke();

    // Glow
    fill(0, 255, 100, 25);
    ellipse(0, 0, 55, 25);

    // Ears (triangles)
    fill(0, 255, 100);
    triangle(-14, -6, -10, -20, -4, -8);
    triangle(14, -6, 10, -20, 4, -8);
    // Inner ears
    fill(100, 255, 180);
    triangle(-12, -8, -10, -17, -6, -9);
    triangle(12, -8, 10, -17, 6, -9);

    // Head
    fill(0, 255, 100);
    ellipse(0, 0, 32, 26);

    // Eyes
    fill(0);
    ellipse(-6, -3, 7, 8);
    ellipse(6, -3, 7, 8);
    // Pupils (look forward)
    fill(200, 255, 220);
    ellipse(-6, -3, 3, 4);
    ellipse(6, -3, 3, 4);

    // Nose
    fill(255, 150, 180);
    triangle(-2, 2, 2, 2, 0, 4);

    // Mouth
    stroke(0);
    strokeWeight(1);
    noFill();
    arc(-3, 5, 5, 4, 0, PI);
    arc(3, 5, 5, 4, 0, PI);

    // Whiskers
    stroke(200, 255, 200);
    strokeWeight(0.8);
    line(-16, 1, -22, -2);
    line(-16, 3, -22, 4);
    line(-16, 5, -21, 8);
    line(16, 1, 22, -2);
    line(16, 3, 22, 4);
    line(16, 5, 21, 8);

    pop();
  }

  hit(bullet) {
    return dist(bullet.x, bullet.y, this.x, this.y) < 18;
  }
}

class Invader {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.w = 30;
    this.h = 24;
    this.animTimer = floor(random(60));
  }

  getColor() {
    if (this.type === 1) return color(100, 255, 100);
    if (this.type === 2) return color(100, 200, 255);
    return color(255, 100, 100);
  }

  draw() {
    push();
    translate(this.x, this.y);
    let frame = floor(this.animTimer / 30) % 2;
    noStroke();

    if (this.type === 1) {
      fill(100, 255, 100);
      rect(-10, -6, 20, 12, 3);
      rect(-14, -2, 4, 8);
      rect(10, -2, 4, 8);
      fill(0);
      rect(-5, -3, 4, 4);
      rect(1, -3, 4, 4);
      fill(100, 255, 100);
      if (frame === 0) {
        rect(-12, 6, 4, 5); rect(-4, 6, 4, 5);
        rect(0, 6, 4, 5); rect(8, 6, 4, 5);
      } else {
        rect(-10, 6, 4, 5); rect(-2, 6, 4, 5);
        rect(4, 6, 4, 5); rect(10, 6, 4, 5);
      }
    } else if (this.type === 2) {
      fill(100, 200, 255);
      rect(-8, -8, 16, 14, 2);
      rect(-12, -4, 4, 8);
      rect(8, -4, 4, 8);
      fill(0);
      rect(-5, -5, 3, 4);
      rect(2, -5, 3, 4);
      fill(100, 200, 255);
      if (frame === 0) {
        rect(-6, -10, 2, 4); rect(4, -10, 2, 4);
      } else {
        rect(-8, -11, 2, 4); rect(6, -11, 2, 4);
      }
      if (frame === 0) {
        rect(-14, 2, 4, 3); rect(10, 2, 4, 3);
      } else {
        rect(-14, 4, 4, 3); rect(10, 4, 4, 3);
      }
    } else {
      fill(255, 100, 100);
      ellipse(0, -2, 24, 18);
      fill(0);
      ellipse(-5, -3, 5, 6);
      ellipse(5, -3, 5, 6);
      fill(255, 100, 100);
      ellipse(-5, -2, 2, 3);
      ellipse(5, -2, 2, 3);
      fill(255, 100, 100);
      if (frame === 0) {
        rect(-10, 6, 3, 5); rect(-4, 7, 3, 5);
        rect(1, 6, 3, 5); rect(7, 7, 3, 5);
      } else {
        rect(-10, 7, 3, 5); rect(-4, 6, 3, 5);
        rect(1, 7, 3, 5); rect(7, 6, 3, 5);
      }
    }
    pop();
  }

  hit(bullet) {
    return abs(bullet.x - this.x) < this.w / 2 && abs(bullet.y - this.y) < this.h / 2;
  }
}

class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = -8;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.y += this.speed;
  }

  draw() {
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let a = map(i, 0, this.trail.length, 30, 150);
      fill(0, 255, 100, a);
      rect(this.trail[i].x - 1, this.trail[i].y, 2, 6);
    }
    fill(200, 255, 200);
    rect(this.x - 2, this.y, 4, 10, 2);
  }

  offscreen() {
    return this.y < -10;
  }
}

class EnemyBullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 4 + level * 0.3;
    this.wobble = random(0.3, 0.8);
  }

  update() {
    this.y += this.speed;
    this.x += sin(this.y * 0.05) * this.wobble;
  }

  draw() {
    noStroke();
    fill(255, 80, 80);
    ellipse(this.x, this.y, 4, 10);
    fill(255, 150, 150, 150);
    ellipse(this.x, this.y - 4, 2, 6);
  }

  offscreen() {
    return this.y > GH + 10;
  }
}

class Barrier {
  constructor(x, y) {
    this.blocks = [];
    let shape = [
      "  XXXXXX  ",
      " XXXXXXXX ",
      "XXXXXXXXXX",
      "XXXXXXXXXX",
      "XXXXXXXXXX",
      "XXX    XXX"
    ];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] === "X") {
          this.blocks.push({ x: x + c * 5, y: y + r * 5, alive: true });
        }
      }
    }
  }

  draw() {
    noStroke();
    fill(0, 180, 80);
    for (let b of this.blocks) {
      if (b.alive) rect(b.x, b.y, 5, 5);
    }
  }

  hitByBullet(bullet) {
    for (let b of this.blocks) {
      if (b.alive && abs(bullet.x - b.x - 2.5) < 5 && abs(bullet.y - b.y - 2.5) < 6) {
        b.alive = false;
        for (let other of this.blocks) {
          if (other.alive && dist(b.x, b.y, other.x, other.y) < 8) {
            if (random() > 0.5) other.alive = false;
          }
        }
        return true;
      }
    }
    return false;
  }

  hitByInvader(inv) {
    for (let b of this.blocks) {
      if (b.alive && abs(inv.x - b.x) < 20 && abs(inv.y - b.y) < 18) {
        b.alive = false;
      }
    }
  }
}

class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, 3);
    this.vy = random(-4, 2);
    this.life = 255;
    this.decay = random(5, 12);
    this.size = random(2, 6);
    this.col = col;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1;
    this.life -= this.decay;
  }

  draw() {
    noStroke();
    let c = this.col;
    fill(red(c), green(c), blue(c), this.life);
    rect(this.x, this.y, this.size, this.size);
  }

  isDead() {
    return this.life <= 0;
  }
}
