import BUBBLES from "../data/bubbles.js";
import "../styles/bubbles.css";

function BubbleGrid({ onBubbleClick }) {
  return (
    <div className="bubble-grid">
      {BUBBLES.map((bubble) => (
        <div
          key={bubble.id}
          className="bubble"
          id={`bubble-${bubble.id}`}
          onClick={() => onBubbleClick(bubble.id)}
          style={{
            background: bubble.color + "20",
            borderColor: bubble.color,
            boxShadow: `0 0 24px ${bubble.color}33`,
          }}
        >
          <span className="bubble-icon">{bubble.icon}</span>
          <span className="bubble-label">{bubble.label}</span>
        </div>
      ))}
    </div>
  );
}

export default BubbleGrid;
