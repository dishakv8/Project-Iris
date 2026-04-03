const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const buttons = document.querySelectorAll(".gaze-btn");
const output = document.getElementById("output");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

let currentDirection = null;
let directionStartTime = null;
let selectionLocked = false;

// Calibration
let baselineX = null;
let baselineY = null;
let calibrationFrames = 0;
const CALIBRATION_TARGET = 50;

// Smoothing
let smoothX = null;
let smoothY = null;
const SMOOTHING = 0.15;

// Hold time
const HOLD_TIME = 1500;

// Map direction to button
function getButtonForDirection(direction) {
  return document.querySelector(`.gaze-btn[data-dir="${direction}"]`);
}

function highlightDirection(direction) {
  buttons.forEach(btn => btn.classList.remove("active"));
  const btn = getButtonForDirection(direction);
  if (btn) btn.classList.add("active");
}

function selectButton(button) {
  buttons.forEach(btn => {
    btn.classList.remove("selected");
    btn.classList.remove("active");
  });

  button.classList.add("selected");
  const value = button.getAttribute("data-value");
  output.innerText = `User selected: ${value}`;

  // Optional speech
  const utterance = new SpeechSynthesisUtterance(value);
  speechSynthesis.speak(utterance);
}

function avgPoint(points, landmarks) {
  let x = 0, y = 0;
  points.forEach(i => {
    x += landmarks[i].x;
    y += landmarks[i].y;
  });
  return { x: x / points.length, y: y / points.length };
}

function drawPoint(x, y, color = "red", radius = 4) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function estimateGaze(landmarks) {
  // Left eye
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftTop = landmarks[159];
  const leftBottom = landmarks[145];

  // Right eye
  const rightInner = landmarks[362];
  const rightOuter = landmarks[263];
  const rightTop = landmarks[386];
  const rightBottom = landmarks[374];

  // Iris centers
  const leftIris = avgPoint([468, 469, 470, 471, 472], landmarks);
  const rightIris = avgPoint([473, 474, 475, 476, 477], landmarks);

  // Ratios
  const leftRatioX = (leftIris.x - leftOuter.x) / (leftInner.x - leftOuter.x);
  const rightRatioX = (rightIris.x - rightInner.x) / (rightOuter.x - rightInner.x);

  const leftRatioY = (leftIris.y - leftTop.y) / (leftBottom.y - leftTop.y);
  const rightRatioY = (rightIris.y - rightTop.y) / (rightBottom.y - rightTop.y);

  const gazeX = (leftRatioX + rightRatioX) / 2;
  const gazeY = (leftRatioY + rightRatioY) / 2;

  return { gazeX, gazeY, leftIris, rightIris };
}

function getDirection(gazeX, gazeY) {
  const centerX = baselineX ?? 0.5;
  const centerY = baselineY ?? 0.5;

  const dx = gazeX - centerX;
  const dy = gazeY - centerY;

  // Dead zone for center
  const thresholdX = 0.035;
  const thresholdY = 0.025;

  // Since display is mirrored, reverse left/right
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -thresholdX) return "right";
    if (dx > thresholdX) return "left";
  } else {
    if (dy < -thresholdY) return "up";
    if (dy > thresholdY) return "down";
  }

  return null;
}

startBtn.addEventListener("click", async () => {
  try {
    statusText.innerText = "Requesting camera access...";

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    video.onloadedmetadata = async () => {
      await video.play();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      statusText.innerText = "Starting iris tracking... Look straight for calibration.";

      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults((results) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          const { gazeX, gazeY, leftIris, rightIris } = estimateGaze(landmarks);

          // Draw iris points
          drawPoint(leftIris.x * canvas.width, leftIris.y * canvas.height, "red", 5);
          drawPoint(rightIris.x * canvas.width, rightIris.y * canvas.height, "red", 5);

          // Calibration
          if (calibrationFrames < CALIBRATION_TARGET) {
            if (baselineX === null) {
              baselineX = gazeX;
              baselineY = gazeY;
            } else {
              baselineX = (baselineX * calibrationFrames + gazeX) / (calibrationFrames + 1);
              baselineY = (baselineY * calibrationFrames + gazeY) / (calibrationFrames + 1);
            }

            calibrationFrames++;
            statusText.innerText = `Calibrating... ${calibrationFrames}/${CALIBRATION_TARGET}. Look at center.`;
            return;
          }

          // Smooth values
          if (smoothX === null) {
            smoothX = gazeX;
            smoothY = gazeY;
          } else {
            smoothX = smoothX * (1 - SMOOTHING) + gazeX * SMOOTHING;
            smoothY = smoothY * (1 - SMOOTHING) + gazeY * SMOOTHING;
          }

          statusText.innerText = "Tracking active. Look in one direction and hold.";

          const direction = getDirection(smoothX, smoothY);

          if (direction) {
            highlightDirection(direction);

            if (!selectionLocked) {
              if (currentDirection !== direction) {
                currentDirection = direction;
                directionStartTime = Date.now();
              } else {
                const holdTime = Date.now() - directionStartTime;

                if (holdTime >= HOLD_TIME) {
                  const btn = getButtonForDirection(direction);
                  if (btn) {
                    selectButton(btn);
                    selectionLocked = true;

                    setTimeout(() => {
                      selectionLocked = false;
                    }, 1800);
                  }
                }
              }
            }
          } else {
            buttons.forEach(btn => btn.classList.remove("active"));
            currentDirection = null;
            directionStartTime = null;
          }
        } else {
          buttons.forEach(btn => btn.classList.remove("active"));
          currentDirection = null;
          directionStartTime = null;
        }
      });

      const camera = new Camera(video, {
        onFrame: async () => {
          await faceMesh.send({ image: video });
        },
        width: 640,
        height: 480
      });

      camera.start();
    };
  } catch (err) {
    console.error(err);
    statusText.innerText = "Camera failed: " + err.message;
  }
});