import React, { useState } from 'react';
import {
  Copy, Check, ChevronDown, ChevronRight,
  Send, Clock, MessageSquare, List, Wifi, Zap,
} from 'lucide-react';
import './DocsPage.css';

/* ── Helpers ──────────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="docs-copy-btn" onClick={handle} title="Copiar">
      {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function CodeBlock({ code, lang = 'json' }) {
  return (
    <div className="docs-code-wrap">
      <div className="docs-code-header">
        <span className="docs-code-lang">{lang}</span>
        <CopyButton text={code.trim()} />
      </div>
      <pre className="docs-pre"><code>{code.trim()}</code></pre>
    </div>
  );
}

function Badge({ method }) {
  const colors = {
    POST: '#10b981',
    GET:  '#3b82f6',
    PUT:  '#f59e0b',
    DELETE: '#ef4444',
  };
  return (
    <span className="docs-method-badge" style={{ background: colors[method] || '#6b7280' }}>
      {method}
    </span>
  );
}

function EndpointCard({ method, path, title, description, params, body, response, children }) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${window.location.origin}${path}`;

  return (
    <div className={`docs-endpoint ${open ? 'open' : ''}`}>
      <button className="docs-endpoint-header" onClick={() => setOpen(o => !o)}>
        <div className="docs-endpoint-left">
          <Badge method={method} />
          <code className="docs-endpoint-path">{path}</code>
          <span className="docs-endpoint-title">{title}</span>
        </div>
        <div className="docs-endpoint-right">
          <CopyButton text={fullUrl} />
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className="docs-endpoint-body">
          {description && <p className="docs-endpoint-desc">{description}</p>}

          {params && params.length > 0 && (
            <div className="docs-params">
              <h4>Parámetros</h4>
              <table className="docs-table">
                <thead>
                  <tr><th>Campo</th><th>Tipo</th><th>Requerido</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {params.map(p => (
                    <tr key={p.name}>
                      <td><code>{p.name}</code></td>
                      <td><span className="docs-type">{p.type}</span></td>
                      <td>{p.required ? <span className="docs-required">Sí</span> : <span className="docs-optional">No</span>}</td>
                      <td>{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {body && (
            <div className="docs-section">
              <h4>Ejemplo de Request</h4>
              <CodeBlock code={body} />
            </div>
          )}

          {response && (
            <div className="docs-section">
              <h4>Ejemplo de Response</h4>
              <CodeBlock code={response} />
            </div>
          )}

          {children}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="docs-section-block">
      <div className="docs-section-title">
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function DocsPage() {
  const baseUrl = window.location.origin;

  return (
    <div className="docs-page">
      {/* Hero */}
      <div className="docs-hero">
        <div className="docs-hero-inner">
          <div className="docs-hero-badge"><Zap size={14} /> REST API</div>
          <h1>Documentación de la API</h1>
          <p>Integra tu sistema externo para enviar mensajes, consultar chats y automatizar flujos de WhatsApp.</p>
          <div className="docs-base-url">
            <span className="docs-base-label">Base URL</span>
            <code>{baseUrl}</code>
            <CopyButton text={baseUrl} />
          </div>
        </div>
      </div>

      <div className="docs-content">

        {/* Auth */}
        <section className="docs-auth-card">
          <h3>🔑 Autenticación</h3>
          <p>Todas las rutas requieren el token de API en la cabecera HTTP:</p>
          <CodeBlock code={`Authorization: Bearer TU_TOKEN_AQUI`} lang="http" />
          <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Encuentra tu token en <strong>Usuarios → tu perfil → Token de API</strong>.
          </p>
        </section>

        {/* Send */}
        <Section icon={Send} title="Envío de Mensajes">

          <EndpointCard
            method="POST"
            path="/api/send"
            title="Envío inmediato"
            description="Envía un mensaje de forma inmediata. La API responde una vez que el mensaje fue entregado al servidor de WhatsApp. El envío queda registrado en el historial de cola como 'sent'."
            params={[
              { name: 'numero',         type: 'string',  required: true,  desc: 'Número destino con código de país, sin +. Ej: 51912345678' },
              { name: 'tipo',           type: 'string',  required: true,  desc: 'text | image | video | audio | pdf | document | sticker' },
              { name: 'mensaje',        type: 'string',  required: false, desc: 'Texto del mensaje (requerido si tipo=text). También se usa como caption en imágenes/videos.' },
              { name: 'archivo_url',    type: 'string',  required: false, desc: 'URL pública del archivo a enviar (para tipos multimedia).' },
              { name: 'archivo_b64',    type: 'string',  required: false, desc: 'Contenido del archivo en base64. Alternativa a archivo_url. No se almacena en historial.' },
              { name: 'nombre_archivo', type: 'string',  required: false, desc: 'Nombre del archivo para documentos/PDFs.' },
            ]}
            body={`{
  "numero": "51912345678",
  "tipo": "text",
  "mensaje": "Hola, este es un mensaje de prueba."
}`}
            response={`{
  "success": true,
  "message": "Message sent",
  "messageId": "3EB0ABC123456"
}`}
          >
            <div className="docs-examples">
              <h4>Más ejemplos por tipo</h4>

              <div className="docs-example-tab-group">
                <ExampleTabs examples={[
                  {
                    label: 'Texto',
                    code: `{
  "numero": "51912345678",
  "tipo": "text",
  "mensaje": "Hola desde mi sistema 👋"
}`,
                  },
                  {
                    label: 'Imagen',
                    code: `{
  "numero": "51912345678",
  "tipo": "image",
  "archivo_url": "https://mi-servidor.com/foto.jpg",
  "mensaje": "Aquí tu comprobante de pago."
}`,
                  },
                  {
                    label: 'PDF / Documento',
                    code: `{
  "numero": "51912345678",
  "tipo": "pdf",
  "archivo_url": "https://mi-servidor.com/reporte.pdf",
  "nombre_archivo": "Reporte_2025.pdf",
  "mensaje": "Adjunto el reporte solicitado."
}`,
                  },
                  {
                    label: 'Audio',
                    code: `{
  "numero": "51912345678",
  "tipo": "audio",
  "archivo_url": "https://mi-servidor.com/nota.mp3"
}`,
                  },
                  {
                    label: 'Video',
                    code: `{
  "numero": "51912345678",
  "tipo": "video",
  "archivo_url": "https://mi-servidor.com/clip.mp4",
  "mensaje": "Mira este video."
}`,
                  },
                  {
                    label: 'Sticker',
                    code: `{
  "numero": "51912345678",
  "tipo": "sticker",
  "archivo_url": "https://mi-servidor.com/sticker.webp"
}`,
                  },
                ]} />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard
            method="POST"
            path="/api/queue"
            title="Encolar mensaje"
            description="Encola el mensaje para que el Worker lo envíe en segundo plano. Ideal para envíos masivos o programados. El Worker procesa la cola cada pocos segundos."
            params={[
              { name: 'numero',         type: 'string',  required: true,  desc: 'Número destino con código de país, sin +.' },
              { name: 'tipo',           type: 'string',  required: true,  desc: 'text | image | video | audio | pdf | document | sticker' },
              { name: 'mensaje',        type: 'string',  required: false, desc: 'Texto del mensaje (requerido si tipo=text).' },
              { name: 'archivo_url',    type: 'string',  required: false, desc: 'URL pública del archivo.' },
              { name: 'archivo_b64',    type: 'string',  required: false, desc: 'Archivo en base64. Se guarda temporalmente hasta ser procesado.' },
              { name: 'nombre_archivo', type: 'string',  required: false, desc: 'Nombre del archivo para documentos/PDFs.' },
              { name: 'programado',     type: 'string',  required: false, desc: 'Fecha/hora ISO 8601 para envío diferido. Ej: 2025-12-31T23:59:00Z' },
            ]}
            body={`{
  "numero": "51912345678",
  "tipo": "text",
  "mensaje": "Recordatorio: tu cita es mañana a las 10am.",
  "programado": "2025-12-31T09:00:00Z"
}`}
            response={`{
  "success": true,
  "message": "Message queued",
  "queueId": 42
}`}
          />
        </Section>

        {/* Consultas */}
        <Section icon={List} title="Consultas">

          <EndpointCard
            method="GET"
            path="/api/chats"
            title="Listar chats"
            description="Devuelve la lista de conversaciones activas de la sesión."
            params={[
              { name: 'search', type: 'string',  required: false, desc: 'Filtrar por nombre o número.' },
              { name: 'limit',  type: 'number',  required: false, desc: 'Máximo de resultados. Default: 50.' },
            ]}
            body={`GET ${baseUrl}/api/chats?limit=20&search=Juan`}
            response={`{
  "success": true,
  "chats": [
    {
      "jid": "51912345678@s.whatsapp.net",
      "name": "Juan Pérez",
      "is_group": 0,
      "unread_count": 2,
      "last_message": "Hola, ¿cómo estás?",
      "last_message_time": "2025-06-05T14:30:00.000Z"
    }
  ]
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/messages"
            title="Historial de mensajes"
            description="Devuelve los últimos mensajes de una conversación específica."
            params={[
              { name: 'numero', type: 'string', required: true,  desc: 'Número con código de país, sin +.' },
              { name: 'limit',  type: 'number', required: false, desc: 'Máximo de mensajes. Default: 50.' },
            ]}
            body={`GET ${baseUrl}/api/messages?numero=51912345678&limit=20`}
            response={`{
  "success": true,
  "messages": [
    {
      "message_id": "3EB0ABC123456",
      "jid": "51912345678@s.whatsapp.net",
      "from_me": 1,
      "type": "text",
      "body": "Hola, ¿cómo estás?",
      "status": "read",
      "timestamp": 1749120000
    }
  ]
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/session/status"
            title="Estado de sesión"
            description="Devuelve el estado actual de la sesión de WhatsApp."
            response={`{
  "success": true,
  "session": {
    "session_id": "default",
    "status": "connected",
    "phone_number": "51912345678",
    "account_name": "Mi Empresa",
    "connected_at": "2025-06-05T10:00:00.000Z"
  }
}`}
          />
        </Section>

        {/* Notas */}
        <section className="docs-notes">
          <h3>📝 Notas importantes</h3>
          <div className="docs-notes-grid">
            <div className="docs-note-card">
              <h4>Tipos de mensaje</h4>
              <p>Valores válidos para <code>tipo</code>:</p>
              <div className="docs-type-list">
                {['text','image','video','audio','pdf','document','sticker'].map(t => (
                  <span key={t} className="docs-type-chip">{t}</span>
                ))}
              </div>
            </div>
            <div className="docs-note-card">
              <h4>Base64 vs URL</h4>
              <p>Prefiere siempre <code>archivo_url</code> (URL pública). El base64 es pesado, no se guarda en el historial de <code>/api/send</code>, y puede causar timeouts en archivos grandes.</p>
            </div>
            <div className="docs-note-card">
              <h4>Firma automática</h4>
              <p>Si tienes la firma habilitada en tu perfil, se adjunta automáticamente al final de todos los mensajes de texto enviados por API.</p>
            </div>
            <div className="docs-note-card">
              <h4>Rate limit</h4>
              <p>El endpoint <code>/api/*</code> tiene un límite de <strong>100 requests/minuto</strong> por IP. Para envíos masivos usa <code>/api/queue</code>.</p>
            </div>
            <div className="docs-note-card">
              <h4>Formato de número</h4>
              <p>Siempre incluye el código de país sin el símbolo <code>+</code>.<br />✅ <code>51912345678</code> &nbsp; ❌ <code>+51912345678</code> &nbsp; ❌ <code>912345678</code></p>
            </div>
            <div className="docs-note-card">
              <h4>Envío programado</h4>
              <p>Usa <code>programado</code> en <code>/api/queue</code> con formato ISO 8601. El Worker solo procesa mensajes cuya fecha ya pasó.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ── Example tabs ─────────────────────────────────────────── */
function ExampleTabs({ examples }) {
  const [active, setActive] = useState(0);
  return (
    <div className="docs-tabs">
      <div className="docs-tabs-header">
        {examples.map((ex, i) => (
          <button
            key={i}
            className={`docs-tab-btn ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {ex.label}
          </button>
        ))}
      </div>
      <CodeBlock code={examples[active].code} />
    </div>
  );
}
