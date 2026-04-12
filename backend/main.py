from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

# ── Import new Google Gemini library ──
from google import genai

# ── Setup client ──
GEMINI_API_KEY = os.getenv("AIzaSyB9Vpn4YNb7ImaLmJXYI_W1PzuTP8J4fKs")
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

# ── CORS — allow everything ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request model ──
class IntentRequest(BaseModel):
    intent: str

# ── Health check ──
@app.get("/")
def root():
    return {"status": "Iris backend is running ✅"}

# ── Main route: intent → sentence ──
@app.post("/generate")
def generate_sentence(request: IntentRequest):
    intent = request.intent.strip().lower()

    prompt = f"""You are a compassionate voice assistant for a patient with ALS or Locked-In Syndrome who cannot speak.
The patient selected the intent: "{intent}"

Generate ONE natural, warm, full sentence they would want to say out loud.
Reply with ONLY the sentence. No quotes, no explanation, nothing else.

Examples:
- water → Could I please have a glass of water? I am feeling a bit thirsty.
- food → I think I am ready to eat something, could you help me with a meal?
- help → I need some assistance please, could someone come help me?
- tired → I am feeling quite tired, I would like to rest for a while.
- family → I would really love to see my family right now, could you contact them?"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        sentence = response.text.strip()
        return {"intent": intent, "sentence": sentence}

    except Exception as e:
        print(f"Gemini API error: {e}")
        # ── Fallback sentences if API fails ──
        fallback = {
            "water":  "Could I please have a glass of water?",
            "food":   "I am ready to eat, could you help me with a meal?",
            "help":   "I need some assistance, could someone please help me?",
            "pain":   "I am in pain,could you please help me?",
            "tired":  "I am feeling very tired, I would like to rest now.",
        }
        sentence = fallback.get(intent, "I need help, please come to me.")
        return {"intent": intent, "sentence": sentence}

# ── SOS route ──
@app.post("/sos")
def sos_alert():
    return {"status": "SOS triggered", "message": "Alert sent to caregiver ✅"}
