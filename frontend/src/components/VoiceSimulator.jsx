import React, { useState } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Bot, 
  User, 
  CheckCheck, 
  ShieldCheck,
  FileCode,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PRESET_PROMPTS = [
  {
    label: "🌾 40 Qtl Wheat (Rampur)",
    text: "Namaste, Rampur se 40 quintal gehu tractor me kal subah 10 baje lana hai"
  },
  {
    label: "🟡 35 Qtl Mustard (Taraori)",
    text: "Taraori se 35 quintal sarso leke aa raha hu kal 11 baje tractor trolley me"
  },
  {
    label: "🍚 60 Qtl Paddy (Indri)",
    text: "60 quintal dhan mini truck se Indri se kal subah 9 baje Lana hai"
  },
  {
    label: "🌽 25 Qtl Maize (Nilokheri)",
    text: "Nilokheri gaav se 25 quintal makka kal dopahar 2 baje"
  }
];

export default function VoiceSimulator({ onBookingCreated }) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: '🌾 Namaste Kisan Bandhu! Main Karnal Mandi Mitra bot hu. Aap bolkar ya likhkar apna anaaj, matra, aur aane ka samay batayein.',
      time: '09:00 AM'
    }
  ]);
  const [extractedIntent, setExtractedIntent] = useState(null);
  const [loading, setLoading] = useState(false);

  // Web Speech API Voice Recognition (if supported in browser)
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Using preset Hindi voice notes instead.");
      setInputText(PRESET_PROMPTS[0].text);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isListening) {
      recognition.start();
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg = {
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/voice-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          caller_phone: '+919812' + Math.floor(100000 + Math.random() * 900000)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setExtractedIntent(data.parsed_intent);

        const botMsg = {
          sender: 'bot',
          text: data.whatsapp_reply,
          booking: data.booking,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatMessages((prev) => [...prev, botMsg]);
        confetti({ particleCount: 50, spread: 60 });
        if (onBookingCreated) onBookingCreated();
      }
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [...prev, {
        sender: 'bot',
        text: 'Error processing request. Ensure FastAPI backend is running on port 8000.',
        time: 'Now'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: '24px',
      alignItems: 'start'
    }}>
      {/* WhatsApp Chat Phone Container */}
      <div style={{
        background: '#0c1612',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        {/* WhatsApp Header */}
        <div style={{
          background: '#12261e',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--emerald-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            color: '#ffffff'
          }}>
            🌾
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Karnal Mandi Mitra
              <span className="badge badge-emerald" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>Official APMC Bot</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--emerald-400)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="pulse-dot"></span> WhatsApp AI Gateway Online
            </div>
          </div>
        </div>

        {/* Chat Stream */}
        <div style={{
          height: '420px',
          overflowY: 'auto',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'linear-gradient(rgba(10, 20, 15, 0.95), rgba(7, 14, 10, 0.98))'
        }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '8px'
              }}>
                <div style={{
                  maxWidth: '82%',
                  background: isUser ? '#005c4b' : '#1e2c24',
                  color: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: isUser ? '14px 14px 0 14px' : '14px 14px 14px 0',
                  fontSize: '0.86rem',
                  lineHeight: 1.45,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                  whiteSpace: 'pre-line'
                }}>
                  {msg.text}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.66rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginTop: '4px'
                  }}>
                    <span>{msg.time}</span>
                    {isUser && <CheckCheck size={13} color="#53bdeb" />}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={15} /> MandiFlow AI parsing voice intent & solving capacity constraints...
            </div>
          )}
        </div>

        {/* Presets Bar */}
        <div style={{
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto'
        }}>
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(p.text)}
              style={{
                background: 'rgba(255, 255, 255, 0.07)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '12px 14px',
          background: '#12231b',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <button
            onClick={toggleSpeechRecognition}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: isListening ? 'var(--red-500)' : 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isListening ? '0 0 12px var(--red-500)' : 'none'
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isListening ? "Listening in Hindi/English..." : "Bolkar ya likhkar sandesh bhejein..."}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              padding: '10px 14px',
              borderRadius: '20px',
              color: '#ffffff',
              fontSize: '0.86rem',
              outline: 'none'
            }}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || loading}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'var(--emerald-500)',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* AI Extraction & Capacity Allocation Inspector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Sparkles size={20} color="var(--emerald-400)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
              Real-Time NLP Intent Extraction
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Converts noisy Hindi/Hinglish audio voice notes into strictly typed JSON entities for the OR-Tools constraint allocator.
          </p>

          {extractedIntent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>CROP DETECTED</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--emerald-400)' }}>
                    {extractedIntent.crop}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>QUANTITY</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#ffffff' }}>
                    {extractedIntent.quantity_quintals} Quintals
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>VEHICLE TYPE</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#ffffff' }}>
                    {extractedIntent.vehicle_type}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>VILLAGE ORIGIN</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#ffffff' }}>
                    {extractedIntent.village}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>PRICE LOCK RATE</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--amber-400)' }}>
                    ₹{extractedIntent.price_lock_rate}/qtl
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>NLP CONFIDENCE</span>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--emerald-400)' }}>
                    {(extractedIntent.confidence * 100).toFixed(0)}% Match
                  </div>
                </div>
              </div>

              {/* Raw JSON Preview */}
              <div style={{
                background: '#09120e',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '6px' }}>
                  <FileCode size={13} /> Extracted JSON Payload:
                </div>
                <pre className="mono" style={{ fontSize: '0.74rem', color: '#34d399', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(extractedIntent, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.84rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm)'
            }}>
              Send a voice note or pick a sample above to view live intent extraction and constraint allocation.
            </div>
          )}
        </div>

        {/* Twilio Production Notes Card */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--emerald-400)', fontWeight: 700, fontSize: '0.88rem' }}>
            <ShieldCheck size={16} /> Zero-Hardware Architecture
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
            Farmers require zero app downloads or smartphones. WhatsApp Voice Notes are transcribed via Whisper on the backend webhook (<code className="mono">/webhook/whatsapp</code>), while this web simulator uses browser speech / presets connected to the live backend LLM intent-parsing engine.
          </p>
        </div>
      </div>
    </div>
  );
}
