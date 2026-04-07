import { useState } from "react";
import "./App.css";
import BubbleGrid from "./components/BubbleGrid";

function App() {
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBubbleClick = async (intentId) => {
    setLoading(true);
    setSentence("");

    try {
      const response = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intentId }),
      });

      const data = await response.json();
      console.log("Response from backend:", data);

      const generatedSentence = data.sentence;
      setSentence(generatedSentence);

      const utterance = new SpeechSynthesisUtterance(generatedSentence);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      speechSynthesis.speak(utterance);

    } catch (error) {
      console.log("Error:", error);
      setSentence("⚠️ Could not connect to backend. Is it running?");
    } finally {
      setLoading(false);
    }
  };

  const handleSOS = async () => {
    setSentence("🆘 SOS Alert sent to caregiver!");
    const utterance = new SpeechSynthesisUtterance("Emergency! Please help immediately!");
    speechSynthesis.speak(utterance);
    try {
      await fetch("http://localhost:8000/sos", { method: "POST" });
    } catch (error) {
      console.log("SOS error:", error);
    }
  };

  return (
    <div className="app-wrapper">

      <header className="iris-header">
        <h1 className="iris-title">👁️ IRIS</h1>
        <p className="iris-subtitle">The Intent-Based Eye-Voice Bridge</p>
      </header>

      <main>
        <BubbleGrid onBubbleClick={handleBubbleClick} />
      </main>

      <button className="sos-btn" onClick={handleSOS}>
        🆘 SOS
      </button>

      <div className={`output-panel ${!sentence && !loading ? "waiting" : ""}`}>
        {loading && "⏳ Generating sentence..."}
        {!loading && sentence && sentence}
        {!loading && !sentence && "👁️ Click a bubble to generate a sentence"}
      </div>

    </div>
  );
}

export default App;