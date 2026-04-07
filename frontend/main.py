from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

# ✅ Configure Gemini
genai.configure(api_key="AIzaSyCUom2-VZgGuM1PvKTd27v1i2ovxpZ7Gws")

model = genai.GenerativeModel("gemini-1.5-flash")

app = FastAPI()

# ✅ CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Request model
class IntentRequest(BaseModel):
    intent: str

# ✅ Fast responses
PREDEFINED = {
    "water": "I’m feeling thirsty. Can I have some water?",
    "help": "I need help. Please come here.",
    "pain": "I am in pain. Please assist me.",
    "food": "I’m hungry. Can I have something to eat?",
    "tired": "I am feeling tired. I need some rest.",
}

@app.get("/")
def home():
    return {"message": "Iris backend running 🚀"}

@app.post("/generate")
def generate(data: IntentRequest):
    intent = data.intent.lower()

    # ✅ Fast predefined
    if intent in PREDEFINED:
        return {"text": PREDEFINED[intent]}

    # ✅ AI fallback
    try:
        response = model.generate_content(
            f"Convert '{intent}' into a polite sentence for a patient."
        )
        return {"text": response.text}

    except:
        return {"text": f"I'm feeling {intent}. Please help me."}