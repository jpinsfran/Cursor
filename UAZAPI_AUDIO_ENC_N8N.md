# Tratar `.enc` da Uazapi no n8n (antes do OpenAI Transcribe)

Este guia implementa um fluxo robusto para quando o webhook da Uazapi entrega audio criptografado (`.enc`).

## 1) Pré-requisitos

- Defina variaveis de ambiente no n8n (ou credenciais seguras):
  - `UAZAPI_BASE_URL`
  - `UAZAPI_TOKEN`
  - `UAZAPI_MEDIA_DECRYPT_PATH` (endpoint da sua conta/plano que devolve midia decodificada)
  - `OPENAI_API_KEY`
- O payload precisa trazer, no minimo:
  - URL da midia criptografada (`url`, `mediaUrl` ou equivalente)
  - `mediaKey`
  - `mimetype`
  - hash/sha quando exigido pela operacao de decrypt

## 2) Estrutura recomendada do workflow

1. **Webhook (trigger Uazapi)**
2. **IF - Is Audio**: processa apenas mensagens de audio
3. **Code - Normalize Media Fields**: normaliza nomes de campos vindos do webhook
4. **IF - Has Required Fields**: valida `mediaUrl + mediaKey`
5. **HTTP Request - Uazapi Decrypt Download** (`GET`, `Response: File`, binary `audioFile`)
6. **Code - Validate Audio Binary**: confere MIME e assinatura de arquivo
7. **IF - Audio Is Valid**
8. **OpenAI Transcribe** (usando binary property `audioFile`)
9. **Error branch (retry/log/dead-letter)** para qualquer falha

## 3) Node `Code - Normalize Media Fields`

Use este codigo para mapear payloads diferentes da Uazapi sem inventar dados:

```javascript
const item = $input.first().json;

const body = item.body ?? item.data ?? item;
const msg = body.message ?? body.msg ?? body;

const mimetype =
  msg.mimetype ??
  msg.mimeType ??
  body.mimetype ??
  "";

const mediaUrl =
  msg.url ??
  msg.mediaUrl ??
  msg.media_url ??
  body.url ??
  body.mediaUrl ??
  "";

const mediaKey =
  msg.mediaKey ??
  msg.media_key ??
  body.mediaKey ??
  "";

const fileSha256 =
  msg.fileSha256 ??
  msg.file_sha256 ??
  body.fileSha256 ??
  "";

const fileEncSha256 =
  msg.fileEncSha256 ??
  msg.file_enc_sha256 ??
  body.fileEncSha256 ??
  "";

const fileLength =
  msg.fileLength ??
  msg.file_length ??
  body.fileLength ??
  "";

const messageType =
  msg.messageType ??
  msg.type ??
  body.messageType ??
  "";

const isAudio = String(messageType).toLowerCase().includes("audio") || mimetype.startsWith("audio/");
const hasRequiredFields = Boolean(mediaUrl && mediaKey);

return [
  {
    json: {
      ...item,
      normalized: {
        isAudio,
        mimetype,
        mediaUrl,
        mediaKey,
        fileSha256,
        fileEncSha256,
        fileLength,
      },
      hasRequiredFields,
    },
  },
];
```

## 4) Node `HTTP Request - Uazapi Decrypt Download`

Configuracao:

- **Method**: `GET`
- **URL**: `={{ $env.UAZAPI_BASE_URL + $env.UAZAPI_MEDIA_DECRYPT_PATH }}`
- **Headers**:
  - `Authorization: Bearer {{$env.UAZAPI_TOKEN}}`
- **Query params** (ajuste os nomes conforme a documentacao da sua versao):
  - `url={{ $json.normalized.mediaUrl }}`
  - `mediaKey={{ $json.normalized.mediaKey }}`
  - `mimetype={{ $json.normalized.mimetype }}`
  - `fileSha256={{ $json.normalized.fileSha256 }}`
  - `fileEncSha256={{ $json.normalized.fileEncSha256 }}`
  - `fileLength={{ $json.normalized.fileLength }}`
- **Response Format**: `File`
- **Binary Property**: `audioFile`
- **Ignore Response Code**: `false`

Importante: nao envie a URL `.enc` diretamente para OpenAI; sempre use esse passo de decrypt/download antes.

## 5) Node `Code - Validate Audio Binary`

Valida se o retorno realmente e audio antes de transcrever:

```javascript
const binary = $input.first().binary ?? {};
const audio = binary.audioFile;

if (!audio) {
  return [{ json: { isValidAudio: false, reason: "audioFile ausente", retryable: true } }];
}

const mime = (audio.mimeType ?? "").toLowerCase();
const fileName = (audio.fileName ?? "").toLowerCase();

const allowedMime = [
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/aac",
  "audio/flac",
];

const hasAllowedMime = allowedMime.includes(mime) || mime.startsWith("audio/");
const hasAudioExt = [".ogg", ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".aac", ".flac"].some((ext) => fileName.endsWith(ext));

if (!hasAllowedMime && !hasAudioExt) {
  return [
    {
      json: {
        isValidAudio: false,
        reason: `arquivo nao parece audio (mime=${mime || "vazio"}, fileName=${fileName || "vazio"})`,
        retryable: false,
      },
      binary,
    },
  ];
}

return [{ json: { isValidAudio: true }, binary }];
```

## 6) Node OpenAI Transcribe

No node OpenAI de audio/transcription:

- **Input Data Field Name**: `audioFile`
- Modelo de transcricao suportado pela sua conta (ex.: `gpt-4o-mini-transcribe` ou `whisper-1`)
- So execute quando `isValidAudio = true`

## 7) Retry e dead-letter (resiliencia)

Para qualquer falha de decrypt/binario invalido:

1. Grave log com:
   - `reason`
   - `normalized.mediaUrl`
   - `normalized.mimetype`
   - `messageId` (se houver)
2. Faça **retry curto** (ex.: 2 tentativas com espera de 10s/30s)
3. Se falhar de novo, envie para **dead-letter** (planilha, banco ou canal Slack)

Exemplo de payload para dead-letter:

```json
{
  "stage": "uazapi_audio_decrypt",
  "status": "failed",
  "reason": "audioFile ausente",
  "retryable": true,
  "mediaUrl": "https://...",
  "mimetype": "audio/ogg",
  "createdAt": "{{$now}}"
}
```

## 8) Checklist de aceite

- Audio recebido nao chega mais como `.enc` ao OpenAI.
- OpenAI recebe `binary.audioFile` com MIME de audio valido.
- Fluxo nao quebra em erro de midia: falhas vao para retry e depois dead-letter.
