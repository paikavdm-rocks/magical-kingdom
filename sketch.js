const replicateProxy = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
// Note: We use an offscreen graphics buffer for better segmentation logic.

let video;
let canvas;
let feedback;
let particles = [];
let isCasting = false;
let handPose;
let hands = [];
let bodyPose;
let poses = [];

let fairyFilterActive = false;
let prevHandX = null;
let handVelocity = 0;

// Models will be loaded asynchronously in setup()

// Real-time Fairy Assets (Generated placeholders)
let fairyOverlay;
let wingColor;

// State of the current spell
let currentObjectMask = null; // AI result for object
let currentObjectTransformed = null; // AI result for object style

function setup() {
  // Enlarge for dramatic flair
  canvas = createCanvas(640, 480);
  canvas.parent('p5-container');
  
  // Custom layout for UI underneath canvas
  let controls = createDiv();
  controls.style('display', 'flex');
  controls.style('flex-direction', 'column');
  controls.style('align-items', 'center');
  controls.style('gap', '15px');
  controls.style('margin-top', '5px');
  
  let inputRow = createDiv();
  inputRow.style('display', 'flex');
  inputRow.style('gap', '10px');
  inputRow.parent(controls);
  
  let input_image_field = createInput("A crystal water flower");
  input_image_field.size(300);
  input_image_field.id("input_image_prompt");
  input_image_field.style('padding', '12px 20px');
  input_image_field.style('border-radius', '30px');
  input_image_field.style('border', '2px solid #ff00ff');
  input_image_field.style('background', 'rgba(20,0,40,0.8)');
  input_image_field.style('color', 'white');
  input_image_field.style('font-family', 'Quicksand');
  input_image_field.style('font-size', '1rem');
  input_image_field.style('outline', 'none');
  input_image_field.parent(inputRow);
  
  let castButton = createButton("✨ CAST SPELL ✨");
  castButton.style('padding', '12px 24px');
  castButton.style('border-radius', '30px');
  castButton.style('border', 'none');
  castButton.style('background', 'linear-gradient(90deg, #ff00ff, #00ffff)');
  castButton.style('color', 'black');
  castButton.style('font-family', 'Quicksand');
  castButton.style('font-weight', 'bold');
  castButton.style('cursor', 'pointer');
  castButton.style('font-size', '1rem');
  castButton.style('box-shadow', '0 0 15px rgba(255, 0, 255, 0.5)');
  castButton.mousePressed(() => {
    castRegionalSpell(input_image_field.value());
  });
  castButton.parent(inputRow);

  feedback = createP("Look into the Mirror! Conjure your item first.");
  feedback.style('color', '#ffbaff');
  feedback.style('font-family', 'Quicksand');
  feedback.style('font-size', '1.2rem');
  feedback.style('margin', '0');
  feedback.parent(controls);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  // Load models asynchronously so the page doesn't get stuck on "Loading..."
  handPose = ml5.handPose(() => {
    handPose.detectStart(video, (results) => {
      hands = results;
    });
  });
  
  bodyPose = ml5.bodyPose(() => {
    bodyPose.detectStart(video, (results) => {
      poses = results;
    });
  });

  // Create real-time fairy effect colors
  wingColor = color(200, 100, 255, 120); // Pink/Purple glow
}

function draw() {
  background(0);

  // 1. We always show the live feed, but with a fairy transformation
  push();
  translate(width, 0); // Flipped view
  scale(-1, 1);
  
  // Hand Shake velocity logic
  if (hands.length > 0) {
    // Only check shake if object has already been transformed
    let wrist = hands[0].wrist || hands[0].keypoints[0];
    if (prevHandX !== null && currentObjectTransformed) {
      let speed = abs(wrist.x - prevHandX);
      handVelocity = lerp(handVelocity, speed, 0.4); // Reacts faster
      if (handVelocity > 8) { // Much easier shake threshold
        fairyFilterActive = true;
      }
    }
    prevHandX = wrist.x;
  }

  // REAL-TIME FAIRY TRANSFORMATION (on the live video)
  if (currentObjectTransformed && fairyFilterActive) {
    tint(255, 180, 255); // Shift all live color slightly purple/fairy-like
  }
  image(video, 0, 0, width, height);
  noTint();
  
  // Basic real-time glowing particles around your "fairy form"
  if (currentObjectTransformed && fairyFilterActive) {
    applyFairyGlow();
  }
  
  pop(); // End flipped view

  // 2. We use AI to apply the object transformation (if the spell worked)
  if (currentObjectTransformed) {
    // If the AI identified the object segment, we can isolate it
    // Using simple masking here to demonstrate segmentation.
    // In a full implementation, the AI provides the mask itself.
    applyObjectTransformation();
  }

  // Magic Frame
  noFill();
  strokeWeight(20);
  stroke(wingColor);
  rect(0, 0, width, height);

  // Particle System
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].finished()) particles.splice(i, 1);
  }

  // Draw Wand
  drawWand();
  
  // Casting Overlay
  if (isCasting) {
    fill(255, 255, 255, 200);
    rect(0, 0, width, height);
  }
}

// REAL-TIME VISUALS: This simulates turning you into a fairy in p5.
function applyFairyGlow() {
  fill(wingColor);
  noStroke();
  
  if (poses.length > 0) {
    let pose = poses[0];
    
    // We are INSIDE the push/pop flipped canvas, so x already maps to width-x on screen!
    let getFx = (kp) => kp.x; 
    
    // Draw Wings on Shoulders
    let lShoulder = pose.left_shoulder;
    let rShoulder = pose.right_shoulder;
    
    if (lShoulder && lShoulder.confidence > 0.1) {
      drawWing(getFx(lShoulder), lShoulder.y, 1); // 1 = Left Shoulder (Flaring rightwards visually)
    }
    
    if (rShoulder && rShoulder.confidence > 0.1) {
      drawWing(getFx(rShoulder), rShoulder.y, -1); // -1 = Right Shoulder (Flaring leftwards visually)
    }
    
    // Draw Fairy Crown and Ears on the Head
    let leftEar = pose.left_ear;
    let rightEar = pose.right_ear;
    let nose = pose.nose;
    
    if (nose && nose.confidence > 0.1) {
      let nx = getFx(nose);
      let ny = nose.y;
      
      // Draw pointy ears
      if (leftEar && leftEar.confidence > 0.1) {
        drawElfEar(getFx(leftEar), leftEar.y, 1);
      }
      if (rightEar && rightEar.confidence > 0.1) {
        drawElfEar(getFx(rightEar), rightEar.y, -1);
      }
      
      // Draw intricate crown
      drawCrown(nx, ny - 90);
    }
    
    // Particles flowing down from wings
    if (frameCount % 3 === 0 && lShoulder && rShoulder) {
      particles.push(new Particle(getFx(lShoulder) + random(-20, 20), lShoulder.y));
      particles.push(new Particle(getFx(rShoulder) + random(-20, 20), rShoulder.y));
    }
  } else {
    // Fallback if no person found
    drawWing(width * 0.4, height * 0.4, 1);
    drawWing(width * 0.6, height * 0.4, -1);
    for(let i=0; i<3; i++) {
      particles.push(new Particle(random(width * 0.2, width * 0.8), random(height * 0.2, height * 0.6)));
    }
  }
}

function drawWing(x, y, dir) {
  push();
  translate(x, y);
  
  let flutter = sin(frameCount * 0.2) * 0.1;
  rotate(dir * PI/8 + flutter); 
  
  // Glowing effect
  blendMode(ADD);
  noStroke();
  
  // Insect wings (4 layers)
  fill(150, 50, 255, 100);
  ellipse(dir * 50, -80, 100, 200); 
  
  fill(50, 200, 255, 120);
  ellipse(dir * 40, -60, 60, 150); 
  
  fill(255, 150, 100, 150);
  ellipse(dir * 30, -50, 30, 100); 
  
  fill(200, 50, 150, 100);
  ellipse(dir * 35, 50, 70, 120); 
  
  fill(100, 100, 255, 150);
  ellipse(dir * 25, 40, 40, 80); 
  
  blendMode(BLEND); 
  strokeWeight(2);
  noFill();
  
  // Intricate pulsing veins
  let pulse = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  stroke(255, 255, 255, pulse);
  bezier(0, 0, dir * 25, -40, dir * 60, -90, dir * 50, -180);
  bezier(0, 0, dir * 15, -20, dir * 40, -60, dir * 70, -70);
  bezier(0, 0, dir * 10, -10, dir * 30, -30, dir * 50, -20);
  
  bezier(0, 0, dir * 15, 20, dir * 40, 60, dir * 30, 110);
  bezier(0, 0, dir * 10, 10, dir * 30, 40, dir * 60, 50);
  
  pop();
}

function drawCrown(x, y) {
  push();
  translate(x, y);
  
  // Floating magic halo rings
  noFill();
  strokeWeight(2);
  stroke(255, 215, 0, 150);
  push();
  rotate(frameCount * 0.02);
  ellipse(0, 5, 80, 20); 
  pop();
  
  push();
  rotate(-frameCount * 0.015);
  stroke(255, 150, 255, 150);
  ellipse(0, -10, 100, 30);
  pop();
  
  // Tiara lattice
  blendMode(ADD);
  noStroke();
  fill(255, 100, 255, 255); 
  ellipse(0, 0, 25, 30);
  fill(255, 255, 255, 255); 
  ellipse(0, 0, 10, 15);
  
  blendMode(BLEND);
  fill(255, 215, 0, 220);
  triangle(-12, 0, 12, 0, 0, -50);
  
  // Side gems
  for (let d = -1; d <= 1; d += 2) {
    for (let j = 1; j <= 3; j++) {
      let offset = j * 25;
      let heightOff = j * 10; 
      let gemSize = 20 - j * 4;
      
      stroke(255, 215, 0, 200);
      strokeWeight(3);
      noFill();
      bezier(d * (offset - 25), heightOff - 10, d * (offset - 15), heightOff, d * offset, heightOff, d * offset, heightOff);
      
      noStroke();
      blendMode(ADD);
      if (j === 2) fill(50, 200, 255, 255); 
      else fill(255, 255, 100, 255); 
      
      ellipse(d * offset, heightOff, gemSize, gemSize + 5);
      
      blendMode(BLEND);
      fill(255, 215, 0, 220);
      triangle(d * offset - gemSize/2, heightOff, d * offset + gemSize/2, heightOff, d * offset, heightOff - (40 - j * 8));
    }
  }
  pop();
}

function drawElfEar(x, y, dir) {
  push();
  translate(x, y);
  
  noStroke();
  fill(255, 220, 220, 255); 
  
  beginShape();
  vertex(dir * -10, 20); 
  vertex(dir * -15, -10); 
  vertex(dir * 50, -50); // longer tip!
  vertex(dir * 15, -5); 
  vertex(dir * 5, 25);
  endShape(CLOSE);
  
  fill(255, 120, 120, 200);
  beginShape();
  vertex(dir * -5, 10);
  vertex(dir * -5, -5);
  vertex(dir * 40, -40);
  vertex(dir * 5, 0);
  endShape(CLOSE);
  
  // Magical dangling earring!
  stroke(255, 215, 0, 255);
  strokeWeight(2);
  line(dir * 0, 20, dir * 0, 40); 
  noStroke();
  blendMode(ADD);
  fill(100, 255, 255, 255);
  ellipse(dir * 0, 45, 10, 20); 
  fill(255, 255, 255, 255);
  ellipse(dir * 0, 45, 4, 8); 
  
  blendMode(BLEND);
  pop();
}

// AI COMPOSITION: Apply the AI transformation only to the region of the object.
function applyObjectTransformation() {
  push();
  blendMode(SCREEN); // Makes the black background transparent!
  let objW = width * 0.3;
  let objH = height * 0.3;
  
  let targetX = width / 2;
  let targetY = height / 2;
  
  if (hands.length > 0) {
    let hand = hands[0];
    let wrist = hand.wrist || hand.keypoints[0]; // fallback
    
    // Map coordinates to account for the flipped video!
    targetX = width - wrist.x;
    targetY = wrist.y;
  }
  
  image(currentObjectTransformed, targetX - objW/2, targetY - objH/2, objW, objH);
  
  // Add glitter around the specific transformed object
  strokeWeight(2);
  stroke(255, 255, 0, 150);
  noFill();
  rect(targetX - objW/2, targetY - objH/2, objW, objH);
  pop();
}

function drawWand() {
  fill(255, 255, 200);
  noStroke();
  
  if (hands.length > 0) {
    let hand = hands[0];
    let indexFinger = hand.index_finger_tip || hand.keypoints[8];
    
    // Flipped coordinates
    let x = width - indexFinger.x;
    let y = indexFinger.y;
    
    ellipse(x, y, 15, 15);
    
    if (frameCount % 2 === 0) {
      particles.push(new Particle(x, y));
    }
  } else {
    ellipse(mouseX, mouseY, 10, 10);
  }
}

// This is the updated, complex AI function. It uses a model that supports
// segmentation or 'masking'.
async function castRegionalSpell(objectPrompt) {
  isCasting = true;
  feedback.html("Isolating the object... turning you into a Fairy...");

  // Capture flipped live feed for the AI
  let offscreen = createGraphics(width, height);
  offscreen.translate(width, 0);
  offscreen.scale(-1, 1);
  offscreen.image(video, 0, 0, width, height);
  let imgBase64 = offscreen.elt.toDataURL();

  // Updated Prompting for REGIONAL transformation. 
  // We use Stable Diffusion XL in-painting/segmentation.
  let fairyAesthetic = "ethereal lighting, cinematic, glittery fairy kingdom style";
  // We only want the wand/object to be generated, NOT the user.
  let targetModel = "google/nano-banana"; 

  // Prompt that ONLY asks for the standalone object
  let objectAesthetic = "A standalone, glowing magical item. " + fairyAesthetic + ", highly detailed 3D render, black background, isolated object.";
  let segmentedPrompt = objectPrompt + ". " + objectAesthetic;

  let postData = {
    model: targetModel,
    input: {
      prompt: segmentedPrompt,
      // We remove image_input so the AI doesn't try to redraw the whole human video feed
    },
  };

  try {
    const response = await fetch(replicateProxy, {
      headers: { "Content-Type": `application/json` },
      method: "POST",
      body: JSON.stringify(postData),
    });
    const result = await response.json();

    if (result.output) {
      loadImage(result.output, (incomingImage) => {
        currentObjectTransformed = incomingImage; // The whole transformed image
        isCasting = false;
        feedback.html("Spell successful! Look at your new magical item!");
        for(let i=0; i<60; i++) particles.push(new Particle(random(width), random(height)));
      });
    }
  } catch (error) {
    isCasting = false;
    feedback.html("The transformation spell failed! Make sure you are holding the object clearly!");
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.alpha = 255;
    this.color = color(random(180, 255), random(100, 255), 255);
  }
  finished() { return this.alpha < 0; }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 8;
  }
  show() {
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), this.alpha);
    ellipse(this.x, this.y, random(2, 5));
  }
}
