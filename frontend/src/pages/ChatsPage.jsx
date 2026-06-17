import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Search, Send, Paperclip, Smile, ArrowLeft,
  Plus, Users, User, X, MessageSquarePlus, ChevronDown,
  WifiOff, Image as ImageIcon, Mic, Square, Trash2, Download, Reply
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import './ChatsPage.css';

/* ── Lista de países ─────────────────────────────────────────────── */
const countries = [
  { code: '+1', name: 'Estados Unidos', flag: '🇺🇸', dial: '1', example: '2125551234' },
  { code: '+1', name: 'Canadá', flag: '🇨🇦', dial: '1', example: '4165551234' },
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧', dial: '44', example: '7712345678' },
  { code: '+34', name: 'España', flag: '🇪🇸', dial: '34', example: '612345678' },
  { code: '+52', name: 'México', flag: '🇲🇽', dial: '52', example: '5512345678' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', dial: '54', example: '91123456789' },
  { code: '+56', name: 'Chile', flag: '🇨🇱', dial: '56', example: '912345678' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴', dial: '57', example: '3123456789' },
  { code: '+51', name: 'Perú', flag: '🇵🇪', dial: '51', example: '912345678' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷', dial: '55', example: '11912345678' },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪', dial: '58', example: '4121234567' },
  { code: '+33', name: 'Francia', flag: '🇫🇷', dial: '33', example: '612345678' },
  { code: '+49', name: 'Alemania', flag: '🇩🇪', dial: '49', example: '15123456789' },
  { code: '+39', name: 'Italia', flag: '🇮🇹', dial: '39', example: '3123456789' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', dial: '61', example: '412345678' },
  { code: '+81', name: 'Japón', flag: '🇯🇵', dial: '81', example: '9012345678' },
  { code: '+86', name: 'China', flag: '🇨🇳', dial: '86', example: '13812345678' },
  { code: '+91', name: 'India', flag: '🇮🇳', dial: '91', example: '9876543210' },
  { code: '+7', name: 'Rusia', flag: '🇷🇺', dial: '7', example: '9123456789' },
  { code: '+27', name: 'Sudáfrica', flag: '🇿🇦', dial: '27', example: '712345678' },
  { code: '+20', name: 'Egipto', flag: '🇪🇬', dial: '20', example: '1012345678' },
  { code: '+966', name: 'Arabia Saudita', flag: '🇸🇦', dial: '966', example: '512345678' },
  { code: '+971', name: 'Emiratos Árabes', flag: '🇦🇪', dial: '971', example: '501234567' },
  { code: '+65', name: 'Singapur', flag: '🇸🇬', dial: '65', example: '91234567' },
  { code: '+60', name: 'Malasia', flag: '🇲🇾', dial: '60', example: '123456789' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩', dial: '62', example: '8123456789' },
  { code: '+63', name: 'Filipinas', flag: '🇵🇭', dial: '63', example: '9123456789' },
  { code: '+64', name: 'Nueva Zelanda', flag: '🇳🇿', dial: '64', example: '211234567' },
  { code: '+46', name: 'Suecia', flag: '🇸🇪', dial: '46', example: '701234567' },
  { code: '+47', name: 'Noruega', flag: '🇳🇴', dial: '47', example: '41234567' },
  { code: '+45', name: 'Dinamarca', flag: '🇩🇰', dial: '45', example: '21123456' },
  { code: '+358', name: 'Finlandia', flag: '🇫🇮', dial: '358', example: '412345678' },
  { code: '+353', name: 'Irlanda', flag: '🇮🇪', dial: '353', example: '851234567' },
  { code: '+32', name: 'Bélgica', flag: '🇧🇪', dial: '32', example: '470123456' },
  { code: '+41', name: 'Suiza', flag: '🇨🇭', dial: '41', example: '791234567' },
  { code: '+43', name: 'Austria', flag: '🇦🇹', dial: '43', example: '6641234567' },
  { code: '+48', name: 'Polonia', flag: '🇵🇱', dial: '48', example: '501234567' },
  { code: '+420', name: 'República Checa', flag: '🇨🇿', dial: '420', example: '601123456' },
  { code: '+36', name: 'Hungría', flag: '🇭🇺', dial: '36', example: '201234567' },
  { code: '+40', name: 'Rumania', flag: '🇷🇴', dial: '40', example: '712345678' },
  { code: '+30', name: 'Grecia', flag: '🇬🇷', dial: '30', example: '6912345678' },
  { code: '+90', name: 'Turquía', flag: '🇹🇷', dial: '90', example: '5012345678' },
  { code: '+972', name: 'Israel', flag: '🇮🇱', dial: '972', example: '501234567' },
  { code: '+98', name: 'Irán', flag: '🇮🇷', dial: '98', example: '9123456789' },
  { code: '+92', name: 'Pakistán', flag: '🇵🇰', dial: '92', example: '3123456789' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰', dial: '94', example: '712345678' },
  { code: '+66', name: 'Tailandia', flag: '🇹🇭', dial: '66', example: '812345678' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳', dial: '84', example: '912345678' },
  { code: '+82', name: 'Corea del Sur', flag: '🇰🇷', dial: '82', example: '1012345678' },
];

/* ── Helpers ─────────────────────────────────────────────── */
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ayer';
  return format(d, 'dd/MM/yy');
}

function AckIcon({ status }) {
  if (!status) return null;
  const map = {
    pending:   { sym: '○', color: 'var(--text-muted)' },
    sent:      { sym: '✓', color: 'var(--text-muted)' },
    delivered: { sym: '✓✓', color: 'var(--text-muted)' },
    read:      { sym: '✓✓', color: '#53bdeb' },
    error:     { sym: '✗',  color: 'var(--color-error)' },
  };
  const { sym, color } = map[status] || map.sent;
  return <span style={{ fontSize: 11, color, marginLeft: 2, fontWeight: 600 }}>{sym}</span>;
}

function Avatar({ name, isGroup, avatarUrl, size = 44 }) {
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt="avatar" className="chat-avatar" style={{ width: size, height: size, objectFit: 'cover' }} />
    );
  }
  const letter = isGroup ? null : (name || '?')[0]?.toUpperCase();
  return (
    <div className="chat-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {isGroup ? <Users size={size * 0.44} /> : letter}
    </div>
  );
}

/* ── Selector de países con búsqueda ──────────────────────────────── */
function CountrySelector({ selectedCountry, onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dial.includes(searchTerm) ||
    country.code.includes(searchTerm)
  );

  return (
    <div className="country-selector-overlay" onClick={onClose}>
      <div className="country-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="country-selector-header">
          <h4>Seleccionar país</h4>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="country-selector-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Buscar país o código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="country-selector-list">
          {filteredCountries.map(country => (
            <div
              key={`${country.code}-${country.name}`}
              className={`country-option ${selectedCountry?.code === country.code && selectedCountry?.name === country.name ? 'selected' : ''}`}
              onClick={() => onSelect(country)}
            >
              <span className="country-flag">{country.flag}</span>
              <span className="country-name">{country.name}</span>
              <span className="country-code">{country.code}</span>
            </div>
          ))}
          {filteredCountries.length === 0 && (
            <div className="country-empty">No se encontraron países</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── New chat modal ──────────────────────────────────────── */
function NewChatModal({ onClose, onOpen }) {
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries.find(c => c.name === 'Perú') || countries[0]);

  function formatPhoneNumber(value) {
    // Solo permitir números
    return value.replace(/\D/g, '');
  }

  function handleNumberChange(e) {
    setNumber(formatPhoneNumber(e.target.value));
  }

  async function handleOpen() {
    const cleanNumber = number;
    if (cleanNumber.length < 6) { 
      setErr('Ingresa un número válido (mínimo 6 dígitos)'); 
      return; 
    }
    
    const fullNumber = `${selectedCountry.dial}${cleanNumber}`;
    const jid = `${fullNumber}@s.whatsapp.net`;
    
    setLoading(true);
    setErr('');
    try {
      onOpen(jid, fullNumber);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Nueva conversación</h3>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="input-label">País</label>
              <button
                type="button"
                className="country-selector-button"
                onClick={() => setShowCountrySelector(true)}
              >
                <span className="country-flag">{selectedCountry.flag}</span>
                <span className="country-name">{selectedCountry.name}</span>
                <span className="country-code">{selectedCountry.code}</span>
                <ChevronDown size={16} className="chevron-icon" />
              </button>
            </div>

            <div className="form-group">
              <label className="input-label">Número de WhatsApp</label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+{selectedCountry.dial}</span>
                <input
                  className="input phone-number-input"
                  placeholder={selectedCountry.example}
                  value={number}
                  onChange={handleNumberChange}
                  onKeyDown={e => e.key === 'Enter' && handleOpen()}
                  autoFocus
                  type="tel"
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Ej: {selectedCountry.example} (sin el código de país)
              </p>
            </div>
            {err && <p style={{ color: 'var(--color-error)', fontSize: 12 }}>{err}</p>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleOpen} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 15, height: 15 }} /> : 'Abrir chat'}
            </button>
          </div>
        </div>
      </div>

      {showCountrySelector && (
        <CountrySelector
          selectedCountry={selectedCountry}
          onSelect={(country) => {
            setSelectedCountry(country);
            setShowCountrySelector(false);
          }}
          onClose={() => setShowCountrySelector(false)}
        />
      )}
    </>
  );
}

/* ── Image Modal ──────────────────────────────────────── */
function ImageModal({ url, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!url) return null;
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out' }}>
      <button 
        style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '50%', padding: '8px' }}
        onClick={onClose}
      >
        <X size={24} />
      </button>
      <img src={url} alt="Expanded" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', cursor: 'default' }} onClick={e => e.stopPropagation()} />
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function ChatsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessionStatus, setSessionStatus] = useState('loading'); // loading | connected | disconnected | connecting

  const [chats, setChats]             = useState([]);
  const [search, setSearch]           = useState('');
  const [hideGroups, setHideGroups]   = useState(false);
  const [activeChat, setActiveChat]   = useState(null);
  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState('');
  const [showEmoji, setShowEmoji]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  
  // Nuevos estados
  const [expandedImage, setExpandedImage] = useState(null);
  const [replyTo, setReplyTo]             = useState(null);
  const [recording, setRecording]         = useState(false);
  const [recordTime, setRecordTime]       = useState(0);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const messagesEndRef  = useRef(null);
  const fileInputRef    = useRef(null);
  const stickerInputRef = useRef(null);
  const textInputRef    = useRef(null);
  const typingTimeout   = useRef(null);
  
  // Refs para audio
  const mediaRecorder = useRef(null);
  const audioChunks   = useRef([]);
  const recordTimer   = useRef(null);
  const isAudioCancelled = useRef(false);

  /* Track session status via socket + initial fetch */
  useEffect(() => {
    const socket = getSocket();

    // Get initial status
    api.get('/session/status')
      .then(({ data }) => {
        setSessionStatus(data?.session?.status || 'disconnected');
      })
      .catch(() => setSessionStatus('disconnected'));

    const handler = (data) => {
      const s = data?.status || 'disconnected';
      setSessionStatus(s);
      // Clear local state immediately when session goes away
      if (s !== 'connected') {
        setChats([]);
        setActiveChat(null);
        setMessages([]);
      }
    };
    socket.on('session:status', handler);
    return () => socket.off('session:status', handler);
  }, []);

  /* Load chat list */
  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const { data } = await api.get('/chats', { params: { limit: 200 } });
      setChats(data.chats || []);
    } catch {}
    setLoadingChats(false);
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  /* Load messages */
  async function loadMessages(jid) {
    setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/chats/${encodeURIComponent(jid)}/messages`, { params: { limit: 100 } });
      setMessages(data.messages || []);
    } catch {}
    setLoadingMsgs(false);
  }

  /* Open a chat (existing or new) */
  function openChat(chat) {
    // Normalize JID to canonical @s.whatsapp.net form
    const jid = chat.jid?.includes('@')
      ? chat.jid.replace(/@c\.us$/, '@s.whatsapp.net')
      : `${chat.jid}@s.whatsapp.net`;
    const normalizedChat = { ...chat, jid };
    setActiveChat(normalizedChat);
    loadMessages(jid);
    setShowEmoji(false);
    setTimeout(() => textInputRef.current?.focus(), 100);
  }

  /* Handle "new chat" from modal */
  function handleNewChat(jid, phone) {
    const normalizedJid = jid.replace(/@c\.us$/, '@s.whatsapp.net');
    const synthetic = {
      jid: normalizedJid,
      name: phone,
      phone_number: phone,
      is_group: 0,
      last_message: null,
      unread_count: 0,
    };
    openChat(synthetic);
  }

  /* Scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Socket real-time */
  useEffect(() => {
    const socket = getSocket();

    // Strip suffix for loose JID comparison (@s.whatsapp.net vs @c.us)
    const normalizeJid = (jid) => (jid || '').replace(/@(s\.whatsapp\.net|c\.us)$/, '');

    socket.on('message:new', (data) => {
      const msg = data.message;
      const msgJid    = normalizeJid(msg?.from || msg?.jid || '');
      const activeJid = normalizeJid(activeChat?.jid || '');

      // Append to open conversation if same contact
      if (msgJid && activeJid && msgJid === activeJid) {
        setMessages(prev => {
          if (prev.find(m => m.message_id === (msg.id || msg.message_id))) return prev;
          return [...prev, { ...msg, message_id: msg.id, from_me: msg.fromMe ? 1 : 0 }];
        });
      }

      // Refresh sidebar chat list (new last_message, unread count)
      loadChats();

      // If the chat was opened as synthetic (new chat modal) and we get a real
      // message back from the same number, sync the jid to the canonical form
      // so it never splits into two entries.
      setActiveChat(prev => {
        if (!prev) return prev;
        const prevBase = normalizeJid(prev.jid);
        const incomingJid = msg?.from || msg?.jid;
        if (incomingJid && prevBase === msgJid && prev.jid !== incomingJid) {
          return { ...prev, jid: incomingJid };
        }
        return prev;
      });
    });

    socket.on('message:status', (data) => {
      setMessages(prev =>
        prev.map(m => m.message_id === data.messageId ? { ...m, status: data.status } : m)
      );
    });

    socket.on('presence:update', (payload) => {
      const { data } = payload;
      if (activeChat && data.id === activeChat.jid) {
        const parts = Object.values(data.presences || {});
        const isTyping = parts.some(p => p.lastKnownPresence === 'composing' || p.lastKnownPresence === 'recording');
        setPartnerTyping(isTyping);
        if (isTyping) {
          setTimeout(() => setPartnerTyping(false), 5000);
        }
      }
    });

    return () => {
      socket.off('message:new');
      socket.off('message:status');
      socket.off('presence:update');
    };
  }, [activeChat, loadChats]);

  /* Typing event */
  function handleTyping(e) {
    setText(e.target.value);
    
    if (activeChat) {
      if (!typingTimeout.current) {
        api.post(`/chats/${encodeURIComponent(activeChat.jid)}/presence`, { state: 'composing' }).catch(()=>{});
      } else {
        clearTimeout(typingTimeout.current);
      }
      
      typingTimeout.current = setTimeout(() => {
        api.post(`/chats/${encodeURIComponent(activeChat.jid)}/presence`, { state: 'paused' }).catch(()=>{});
        typingTimeout.current = null;
      }, 3000);
    }
  }

  /* Send text */
  async function handleSendText(e) {
    e?.preventDefault();
    if (!text.trim() || !activeChat || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);

    const quoted = replyTo ? replyTo.message_id : undefined;
    setReplyTo(null);

    const tmpId = `tmp_${Date.now()}`;
    const optimistic = {
      message_id: tmpId,
      from_me: 1,
      type: 'text',
      body,
      status: 'pending',
      timestamp: Math.floor(Date.now() / 1000),
      quoted_msg_id: quoted
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await api.post(`/chats/${encodeURIComponent(activeChat.jid)}/send`, { 
        type: 'text', 
        text: body,
        quotedMessageId: quoted
      });
      setMessages(prev => prev.map(m => m.message_id === tmpId ? { ...m, status: 'sent' } : m));
      loadChats();
    } catch {
      setMessages(prev => prev.map(m => m.message_id === tmpId ? { ...m, status: 'error' } : m));
    }
    setSending(false);
    textInputRef.current?.focus();
  }

  /* Send file */
  async function handleSendFile(e) {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async () => {
      setSending(true);
      try {
        let type = 'document';
        if (file.type === 'image/webp')      type = 'sticker';
        else if (file.type.startsWith('image/'))  type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.includes('pdf'))   type = 'pdf';

        await api.post(`/chats/${encodeURIComponent(activeChat.jid)}/send`, {
          type,
          fileB64: reader.result,
          fileName: file.name,
          quotedMessageId: replyTo?.message_id
        });
        setReplyTo(null);
        loadMessages(activeChat.jid);
      } catch {}
      setSending(false);
    };
    reader.readAsDataURL(file);
  }

  /* Send Custom Sticker via Canvas */
  async function handleSendSticker(e) {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
        
        const ratio = 512 / Math.max(img.width, img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (512 - w) / 2;
        const y = (512 - h) / 2;
        
        ctx.drawImage(img, x, y, w, h);
        const webpBase64 = canvas.toDataURL('image/webp');
        
        setSending(true);
        try {
          await api.post(`/chats/${encodeURIComponent(activeChat.jid)}/send`, {
            type: 'sticker',
            fileB64: webpBase64,
            fileName: 'sticker.webp',
            quotedMessageId: replyTo?.message_id
          });
          setReplyTo(null);
          loadMessages(activeChat.jid);
        } catch {}
        setSending(false);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* Audio Recording */
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      isAudioCancelled.current = false;
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordTimer.current);
        
        if (isAudioCancelled.current) return;
        
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          setSending(true);
          try {
            await api.post(`/chats/${encodeURIComponent(activeChat.jid)}/send`, {
              type: 'audio',
              fileB64: reader.result,
              fileName: 'voice_note.webm',
              ptt: true,
              quotedMessageId: replyTo?.message_id
            });
            setReplyTo(null);
            loadMessages(activeChat.jid);
          } catch {}
          setSending(false);
        };
      };
      
      mediaRecorder.current.start();
      setRecording(true);
      setRecordTime(0);
      recordTimer.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err) {
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  function cancelRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      isAudioCancelled.current = true;
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  /* Filtered + sorted chats */
  const filteredChats = chats.filter(c => {
    if (hideGroups && c.is_group) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
           (c.jid  || '').toLowerCase().includes(q);
  });

  const phone = activeChat?.jid?.split('@')[0] || '';

  /* ── No session: show blocking overlay ──────────────────── */
  if (sessionStatus === 'loading') {
    return (
      <div className="chats-page">
        <div className="chat-empty-state">
          <span className="spinner" style={{ width: 40, height: 40 }} />
          <p style={{ marginTop: 14, color: 'var(--text-muted)' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus !== 'connected') {
    return (
      <div className="chats-page">
        <div className="chat-empty-state">
          <div className="chat-empty-icon">
            <WifiOff size={52} strokeWidth={1.2} />
          </div>
          <h3>Sin sesión activa</h3>
          <p style={{ marginBottom: 16 }}>
            {sessionStatus === 'connecting'
              ? 'WhatsApp está conectando... escanea el QR en Sesión.'
              : 'Conecta tu WhatsApp para ver los chats.'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/session')}>
            Ir a Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chats-page">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <div className={`chats-sidebar ${activeChat ? 'hidden-mobile' : ''}`}>

        <div className="chats-sidebar-header">
          <h2>Chats</h2>
          <div className="chats-header-actions">
            <button
              className={`btn btn-ghost btn-icon ${hideGroups ? 'active-filter' : ''}`}
              onClick={() => setHideGroups(p => !p)}
              title={hideGroups ? 'Mostrando solo contactos' : 'Mostrar solo contactos'}
            >
              <User size={17} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setShowNewChat(true)}
              title="Nueva conversación"
            >
              <MessageSquarePlus size={17} />
            </button>
          </div>
        </div>

        <div className="chats-search">
          <Search size={14} className="chats-search-icon" />
          <input
            className="input chats-search-input"
            placeholder="Buscar o iniciar conversación"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="chats-search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {hideGroups && (
          <div className="filter-pill">
            <User size={12} /> Solo contactos
            <button onClick={() => setHideGroups(false)}><X size={11} /></button>
          </div>
        )}

        <div className="chats-list">
          {loadingChats && (
            <div className="chats-empty"><span className="spinner" /></div>
          )}
          {!loadingChats && filteredChats.length === 0 && (
            <div className="chats-empty">
              {search ? `Sin resultados para "${search}"` : 'No hay conversaciones'}
            </div>
          )}
          {filteredChats.map(chat => {
            const displayName = chat.name || chat.push_name || chat.jid.split('@')[0];
            return (
            <div
              key={chat.jid}
              className={`chat-item ${activeChat?.jid === chat.jid ? 'active' : ''}`}
              onClick={() => openChat(chat)}
            >
              <Avatar name={displayName} isGroup={!!chat.is_group} avatarUrl={chat.avatar_url} />
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">
                    {displayName}
                  </span>
                  <span className="chat-item-time">{formatTime(chat.last_message_time)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-last">{chat.last_message || ''}</span>
                  {chat.unread_count > 0 && (
                    <span className="unread-badge">{chat.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat window ──────────────────────────────────── */}
      <div className={`chat-window ${!activeChat ? 'hidden-mobile' : ''}`}>
        {!activeChat ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <MessageSquarePlus size={52} strokeWidth={1.2} />
            </div>
            <h3>Bienvenido, {user?.name?.split(' ')[0]}</h3>
            <p>Selecciona una conversación o inicia una nueva</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewChat(true)}>
              <Plus size={15} /> Nueva conversación
            </button>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="btn btn-ghost btn-icon mobile-back" onClick={() => setActiveChat(null)}>
                <ArrowLeft size={20} />
              </button>

              <Avatar
                name={activeChat.name || activeChat.push_name || phone}
                isGroup={!!activeChat.is_group}
                avatarUrl={activeChat.avatar_url}
                size={40}
              />

              <div className="chat-header-info">
                <div className="chat-header-name">
                  {activeChat.name || activeChat.push_name || phone}
                </div>
                <div className="chat-header-sub">
                  {partnerTyping ? (
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Escribiendo...</span>
                  ) : (
                    activeChat.is_group ? 'Grupo' : `+${phone}`
                  )}
                </div>
              </div>

              <div className="chat-sender-chip">
                <User size={12} />
                <span>{user?.name}</span>
              </div>
            </div>

            <div className="messages-list">
              {loadingMsgs && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <span className="spinner" />
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="msgs-empty">
                  <p>Sin mensajes aún. ¡Di hola! 👋</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isOut = msg.from_me === 1 || msg.from_me === true;
                return (
                  <div key={msg.message_id || msg.id || i} className={`message ${isOut ? 'outgoing' : 'incoming'} ${msg.type === 'sticker' ? 'message-type-sticker' : ''}`} style={{ position: 'relative' }}>
                    <div className="message-bubble">
                      
                      {/* Quoted Message */}
                      {msg.quoted_msg_id && (
                        <div style={{ background: 'rgba(0,0,0,0.05)', borderLeft: `3px solid ${isOut ? '#fff' : 'var(--accent)'}`, padding: '4px 8px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px', opacity: 0.8 }}>
                          Respuesta a un mensaje anterior
                        </div>
                      )}

                      {/* Mostrar imagen o sticker si hay URL */}
                      {(msg.type === 'image' || msg.type === 'sticker') && msg.media_url && (
                        <img 
                          src={msg.media_url} 
                          alt="img" 
                          className={`message-media ${msg.type === 'sticker' ? 'is-sticker' : ''}`} 
                          onClick={() => setExpandedImage(msg.media_url)}
                        />
                      )}

                      {/* Placeholder solo cuando NO hay URL */}
                      {((msg.type === 'image' && !msg.media_url) || (msg.type === 'sticker' && !msg.media_url) || (msg.type === 'video' && !msg.media_url) || (msg.type === 'audio' && !msg.media_url)) && (
                        <div className="message-file" style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8, fontStyle: 'italic', background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '4px', marginBottom: msg.body ? '6px' : '0' }}>
                          <Paperclip size={14} />
                          <span>
                            {msg.type === 'image' ? '📷 Imagen adjunta' : 
                             msg.type === 'video' ? '🎥 Video adjunto' : 
                             msg.type === 'audio' ? '🎵 Audio adjunto' : 
                             '🖼️ Sticker'}
                          </span>
                          {msg.media_url && (msg.type === 'audio' || msg.type === 'video') && (
                            <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'inherit' }}><Download size={14} /></a>
                          )}
                        </div>
                      )}

                      {/* Mostrar adjuntos normales (documentos, pdfs) */}
                      {msg.type !== 'text' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'audio' && msg.type !== 'sticker' && msg.type !== 'unknown' && (
                        <div className="message-file" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.05)', padding: '6px 10px', borderRadius: '4px', marginBottom: msg.body ? '6px' : '0' }}>
                          <Paperclip size={14} />
                          <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.body || 'Documento adjunto'}</span>
                          {msg.media_url && (
                            <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }} title="Descargar">
                              <Download size={16} />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Mostrar el texto/caption (ignorando body de docs si ya se mostró como archivo) */}
                      {msg.body && (msg.type === 'text' || msg.type === 'unknown' || msg.type === 'image' || msg.type === 'video') && (
                        <span className="message-text">{msg.body}</span>
                      )}
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.timestamp || msg.created_at)}</span>
                        {isOut && <AckIcon status={msg.status} />}
                      </div>
                    </div>
                    {/* Reply Button on hover */}
                    <button 
                      className="btn btn-ghost btn-icon reply-btn" 
                      onClick={() => setReplyTo(msg)}
                      style={{ position: 'absolute', [isOut ? 'left' : 'right']: '-30px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, padding: '4px' }}
                      title="Responder"
                    >
                      <Reply size={14} />
                    </button>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
              
              {/* Reply Preview Area */}
              {replyTo && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg-tertiary)', borderLeft: '4px solid var(--accent)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent)' }}>Respondiendo a {replyTo.from_me ? 'ti' : activeChat.name || phone}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {replyTo.type === 'text' ? replyTo.body : `Mensaje multimedia (${replyTo.type})`}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => setReplyTo(null)}><X size={16} /></button>
                </div>
              )}

              <div className="chat-input-area" style={{ borderTop: 'none' }}>
              {showEmoji && (
                <>
                  {/* Overlay invisible para cerrar al click fuera */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => setShowEmoji(false)}
                  />
                  <div className="emoji-picker-wrap">
                    <EmojiPicker
                      theme="dark"
                      onEmojiClick={(ev) => { setText(t => t + ev.emoji); setShowEmoji(false); textInputRef.current?.focus(); }}
                      height={360}
                      width={300}
                      searchDisabled={false}
                    />
                  </div>
                </>
              )}

              <button className="btn btn-ghost btn-icon input-action" onClick={() => setShowEmoji(p => !p)} title="Emojis">
                <Smile size={20} />
              </button>

              <button className="btn btn-ghost btn-icon input-action" onClick={() => stickerInputRef.current?.click()} title="Enviar Imagen como Sticker">
                <ImageIcon size={20} />
              </button>
              <input ref={stickerInputRef} type="file" hidden accept="image/png, image/jpeg, image/webp" onChange={handleSendSticker} />

              <button className="btn btn-ghost btn-icon input-action" onClick={() => fileInputRef.current?.click()} title="Adjuntar archivo">
                <Paperclip size={20} />
              </button>
              <input ref={fileInputRef} type="file" hidden
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                onChange={handleSendFile}
              />

              {recording ? (
                <div className="chat-input-row" style={{ background: 'rgba(255,0,0,0.1)', borderColor: 'red' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', color: 'red', fontWeight: 500, fontSize: 14 }}>
                    <div className="record-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: 'red' }} />
                    Grabando... {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={cancelRecording} title="Cancelar">
                    <Trash2 size={18} color="red" />
                  </button>
                  <button className="btn btn-primary send-btn" onClick={stopRecording} title="Enviar Audio">
                    <Send size={17} />
                  </button>
                </div>
              ) : (
                <div className="chat-input-row">
                  <input
                    ref={textInputRef}
                    className="input chat-text-input"
                    placeholder="Escribe un mensaje..."
                    value={text}
                    onChange={handleTyping}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}}
                    disabled={sending}
                  />
                  {text.trim() ? (
                    <button
                      className="btn btn-primary send-btn"
                      onClick={handleSendText}
                      disabled={sending}
                      title="Enviar (Enter)"
                    >
                      {sending ? <span className="spinner" style={{ width: 16, height: 16, borderColor: '#fff3', borderTopColor: '#fff' }} /> : <Send size={17} />}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-icon send-btn"
                      onClick={startRecording}
                      disabled={sending}
                      title="Grabar mensaje de voz"
                    >
                      <Mic size={20} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onOpen={handleNewChat} />
      )}

      <ImageModal url={expandedImage} onClose={() => setExpandedImage(null)} />
    </div>
  );
}