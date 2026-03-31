import google.generativeai as genai

genai.configure(api_key="AIzaSyC4NIgHG3mxtMPVmEFuaj8fJNTIn_h5PHE")

model = genai.GenerativeModel("gemini-1.5-flash")

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Request format
class IntentRequest(BaseModel):
    intent: str

# Predefined responses (FAST + reliable)
PREDEFINED = {
    "water": "I’m feeling thirsty. Can I have some water?",
    "help": "I need help. Please come here.",
    "pain": "I am in pain. Please assist me.",
    "food": "I’m hungry. Can I have something to eat?",
    "ok": "I’m feeling okay."
}

@app.get("/")
def home():
    return {"message": "Iris backend is running 🚀"}

import requests

@app.post("/generate")
def generate_text(data: IntentRequest):
    intent = data.intent.lower()

    # Predefined (fast)
    if intent in PREDEFINED:
        return {"text": PREDEFINED[intent]}
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY"

        prompt = f"""
You are helping a patient who cannot speak.

Your job is to convert a single-word intent into a natural, human-like sentence.

Rules:
- Always expand the sentence
- Add a specific request (like water, blanket, help)
- Make it sound emotional and polite

Examples:
water → I'm feeling thirsty. Can I have some water?
pain → I am in pain. Please help me.
cold → I'm feeling cold. Could I get a blanket?

Now convert this:

Intent: {intent}
Answer:
"""

        data_payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }

        response = requests.post(url, json=data_payload)
        result = response.json()

        text = result["candidates"][0]["content"]["parts"][0]["text"]

        return {"text": text}

    except Exception as e:
        print("ERROR:", e)
        return {"text": f"I'm feeling {intent}. Please help me."}