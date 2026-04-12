const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const buttons = document.querySelectorAll(".gaze-btn");
const output = document.getElementById("output");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

const BACKEND_URL = "http://localhost:8000";
const HOLD_TIME = 1500;
const CIRCUMFERENCE = 440;

let currentDirection = null;
let directionStartTime = null;
let selectionLocked = false;
let baselineX = null, baselineY = null;
let calibrationFrames = 0;
const CALIBRATION_TARGET = 50;
let smoothX = null, smoothY = null;
const SMOOTHING = 0.15;

function getButton(dir) {
  return document.querySelector(`.gaze-btn[data-dir="${dir}"]`);
}

function getProgressCircle(dir) {
  return document.getElementById(`progress-${dir}`);
}

function setProgress(dir, ratio) {
  const circle = getProgressCircle(dir);
  if (!circle) return;
  circle.style.strokeDashoffset = CIRCUMFERENCE - ratio * CIRCUMFERENCE;
}

function resetAllProgress() {
  ["up","down","left","right"].forEach(d => setProgress(d, 0));
}

function highlightDirection(dir) {
  buttons.forEach(b => b.classList.remove("active"));
  const btn = getButton(dir);
  if (btn) btn.classList.add("active");
}

async function callBackend(intent) {
  output.innerText = "⏳ Generating...";
  output.classList.remove("speaking");

  try {
    const res = await fetch(`${BACKEND_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent })
    });
    const data = await res.json();
    const sentence = data.sentence;
    output.innerText = sentence;
    output.classList.add("speaking");
    const u = new SpeechSynthesisUtterance(sentence);
    u.rate = 0.9; u.pitch = 1.0;
    u.onend = () => output.classList.remove("speaking");
    speechSynthesis.speak(u);
  } catch (err) {
    const fallback = {
      water: "Could I please have a glass of water?",
      food:  "I am ready to eat, could you help me with a meal?",
      help:  "I need assistance, could someone please help me?",
      pain:  "I am in pain, please help me right away.",
    };
    const sentence = fallback[intent] || "I need help, please come.";
    output.innerText = sentence;
    output.classList.add("speaking");
    const u = new SpeechSynthesisUtterance(sentence);
    u.onend = () => output.classList.remove("speaking");
    speechSynthesis.speak(u);
  }
}

function selectButton(button) {
  buttons.forEach(b => b.classList.remove("selected", "active"));
  button.classList.add("selected");
  resetAllProgress();
  callBackend(button.getAttribute("data-value"));
  selectionLocked = true;
  setTimeout(() => {
    selectionLocked = false;
    buttons.forEach(b => b.classList.remove("selected"));
  }, 2800);
}

function triggerSOS() {
  output.innerText = "🆘 SOS Alert sent to caregiver!";
  output.classList.add("speaking");
  const u = new SpeechSynthesisUtterance("Emergency! Please help immediately!");
  u.onend = () => output.classList.remove("speaking");
  speechSynthesis.speak(u);
  fetch(`${BACKEND_URL}/sos`, { method: "POST" }).catch(() => {});
}
window.triggerSOS = triggerSOS;

function avgPoint(pts, lm) {
  let x = 0, y = 0;
  pts.forEach(i => { x += lm[i].x; y += lm[i].y; });
  return { x: x / pts.length, y: y / pts.length };
}

function drawDot(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = "#a78bfa";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#7c3aed";
  ctx.fill();
  ctx.shadowBlur = 0;
}

function estimateGaze(lm) {
  const leftIris  = avgPoint([468,469,470,471,472], lm);
  const rightIris = avgPoint([473,474,475,476,477], lm);
  const leftRatioX  = (leftIris.x  - lm[33].x)  / (lm[133].x - lm[33].x);
  const rightRatioX = (rightIris.x - lm[362].x) / (lm[263].x - lm[362].x);
  const leftRatioY  = (leftIris.y  - lm[159].y) / (lm[145].y - lm[159].y);
  const rightRatioY = (rightIris.y - lm[386].y) / (lm[374].y - lm[386].y);
  return {
    gazeX: (leftRatioX + rightRatioX) / 2,
    gazeY: (leftRatioY + rightRatioY) / 2,
    leftIris, rightIris
  };
}

function getDirection(gx, gy) {
  const dx = gx - (baselineX ?? 0.5);
  const dy = gy - (baselineY ?? 0.5);
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -0.035) return "right";
    if (dx >  0.035) return "left";
  } else {
    if (dy < -0.025) return "up";
    if (dy >  0.025) return "down";
  }
  return null;
}

startBtn.addEventListener("click", async () => {
  try {
    statusText.innerText = "Requesting camera...";
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    startBtn.style.opacity = "0.5";
    startBtn.disabled = true;

    video.onloadedmetadata = async () => {
      await video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      statusText.innerText = "Look straight ahead to calibrate...";

      const faceMesh = new FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults(results => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!results.multiFaceLandmarks?.length) {
          buttons.forEach(b => b.classList.remove("active"));
          currentDirection = null;
          resetAllProgress();
          statusText.innerText = "⚠️ No face detected — look at camera";
          return;
        }

        const lm = results.multiFaceLandmarks[0];
        const { gazeX, gazeY, leftIris, rightIris } = estimateGaze(lm);

        drawDot(leftIris.x * canvas.width, leftIris.y * canvas.height);
        drawDot(rightIris.x * canvas.width, rightIris.y * canvas.height);

        if (calibrationFrames < CALIBRATION_TARGET) {
          baselineX = baselineX === null ? gazeX : (baselineX * calibrationFrames + gazeX) / (calibrationFrames + 1);
          baselineY = baselineY === null ? gazeY : (baselineY * calibrationFrames + gazeY) / (calibrationFrames + 1);
          calibrationFrames++;
          statusText.innerText = `Calibrating ${calibrationFrames}/${CALIBRATION_TARGET} — look straight ahead`;
          return;
        }

        smoothX = smoothX === null ? gazeX : smoothX * (1 - SMOOTHING) + gazeX * SMOOTHING;
        smoothY = smoothY === null ? gazeY : smoothY * (1 - SMOOTHING) + gazeY * SMOOTHING;

        const direction = getDirection(smoothX, smoothY);

        if (direction && !selectionLocked) {
          highlightDirection(direction);
          if (currentDirection !== direction) {
            currentDirection = direction;
            directionStartTime = Date.now();
            resetAllProgress();
          } else {
            const held = Date.now() - directionStartTime;
            const progress = Math.min(held / HOLD_TIME, 1);
            setProgress(direction, progress);
            statusText.innerText = `Selecting... ${Math.round(progress * 100)}%`;
            if (held >= HOLD_TIME) {
              const btn = getButton(direction);
              if (btn) selectButton(btn);
            }
          }
        } else if (!direction && !selectionLocked) {
          buttons.forEach(b => b.classList.remove("active"));
          currentDirection = null;
          resetAllProgress();
          statusText.innerText = "✅ Tracking active — look at a bubble and hold";
        }
      });

      const camera = new Camera(video, {
        onFrame: async () => { await faceMesh.send({ image: video }); },
        width: 640, height: 480
      });
      camera.start();
    };
  } catch (err) {
    statusText.innerText = "Camera error: " + err.message;
  }
});