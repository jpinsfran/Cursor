#!/usr/bin/env python3
"""
Análise com IA para o fluxo Instagram.
- Analisar imagens (Vision) e retornar descrição útil para entender o negócio.
- Todos os resumos (tema, último post, posts, destaques, stories, contextualização,
  conclusão, punch-line, link externo) são feitos em modo INTERPRETATIVO: o modelo
  age como analista que abriu o perfil, lê bio/posts/destaques e escreve suas
  conclusões — não copia nome da página nem trechos literais; agrega valor para
  prospecção. Dados usados: apenas o que foi fornecido (não inventa).

Comunicação: JSON via stdin -> JSON via stdout.
Requer: OPENAI_API_KEY no ambiente. pip install openai
"""

import json
import os
import sys
import base64
from pathlib import Path

# Modelo usado em todas as chamadas. gpt-4o tende a interpretar melhor; gpt-4o-mini é mais barato/rápido.
# Para trocar sem editar código: export OPENAI_MODEL=gpt-4o (ou gpt-4o-mini)
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_TIMEOUT_SEC = int(os.environ.get("OPENAI_TIMEOUT", "60"))

def load_image_as_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")

def analyze_images(paths: list) -> list:
    """Usa OpenAI Vision para descrever cada imagem. Não inventa nada; sem conteúdo seguro retorna vazio."""
    try:
        from openai import OpenAI
    except ImportError:
        return ["" for _ in paths]

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return ["" for _ in paths]

    client = OpenAI(api_key=api_key)
    results = []
    for path in paths:
        if not Path(path).exists():
            results.append("")
            continue
        try:
            b64 = load_image_as_base64(path)
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Descreva de forma objetiva o que aparece na imagem para análise de negócio: pratos, produtos, ambiente, textos visíveis (cardápio, preços, ofertas), pessoas, cenário. Não invente nada; use só o que está visível. Objetivo: depois essa descrição será usada com outras para concluir que tipo de estabelecimento é. Se não houver conteúdo útil, retorne string vazia."
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{b64}"}
                            }
                        ]
                    }
                ],
                max_tokens=300,
                timeout=OPENAI_TIMEOUT_SEC,
            )
            text = (resp.choices[0].message.content or "").strip()
            results.append(text)
        except Exception:
            results.append("")
    return results

def summarize_theme(text: str) -> str:
    """Interpreta o perfil e produz 'tema da loja': conclusão sobre ramo e posicionamento, não cópia do texto."""
    try:
        from openai import OpenAI
    except ImportError:
        return ""

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        s = (text or "").strip()
        return (s[:450] + ("..." if len(s) > 450 else "")) if s else ""

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que abriu o perfil Instagram de uma loja/restaurante. Com base APENAS no texto fornecido (bio, posts, etc.), tire SUAS CONCLUSÕES: qual o ramo e o posicionamento? Que tipo de negócio e de público transparece? Escreva 2-4 frases com sua interpretação. NÃO copie o nome da página nem trechos literais; NÃO invente dados que não estejam no texto. Separe ideias com ponto e vírgula (;). Se o texto for vazio ou irrelevante, retorne string vazia."
                },
                {"role": "user", "content": text[:12000]}
            ],
            max_tokens=400,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""

def summarize_last_post(caption: str, image_description: str) -> str:
    """Resumo do último post: legenda + imagem + o que foi anunciado."""
    try:
        from openai import OpenAI
    except ImportError:
        return (caption or "") + "; " + (image_description or "")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return (caption or "") + "; " + (image_description or "")

    client = OpenAI(api_key=api_key)
    try:
        content = f"Legenda do post: {caption or '(vazio)'}\n\nAnálise da imagem: {image_description or '(vazio)'}"
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que viu o último post do perfil. INTERPRETE: o que a loja está comunicando? Que gancho isso dá para um primeiro contato (ex.: novidade, promoção, evento)? Escreva 2-4 frases com sua conclusão em prosa. NUNCA inclua @ ou nome de usuário; NUNCA copie a legenda palavra por palavra — só sua interpretação. Use APENAS o que está na legenda e na descrição da imagem; não invente. Separe com ponto e vírgula (;). Se não houver conteúdo útil, retorne string vazia."
                },
                {"role": "user", "content": content}
            ],
            max_tokens=300,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        out = (resp.choices[0].message.content or "").strip()
        return out if out else ((caption or "") + ("; " + image_description if image_description else ""))
    except Exception:
        return (caption or "") + ("; " + image_description if image_description else "")


def summarize_posts(posts: list) -> str:
    """Resumo dos últimos N posts (legendas + descrições de imagem). Vídeos = ignorados."""
    try:
        from openai import OpenAI
    except ImportError:
        return _fallback_posts_text(posts)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_posts_text(posts)

    client = OpenAI(api_key=api_key)
    try:
        lines = []
        for i, p in enumerate((posts or [])[:20], 1):
            cap = (p.get("caption") or "").strip()
            img = (p.get("imageDesc") or "").strip()
            if p.get("imageDesc") == "[vídeo ignorado]":
                lines.append(f"Post {i}: [vídeo ignorado]")
            else:
                lines.append(f"Post {i}: Legenda: {cap[:200]}. Imagem: {img[:150]}")
        text = "\n".join(lines)
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que percorreu os posts do perfil. Com base nas legendas e descrições de imagem fornecidas, TIRE SUAS CONCLUSÕES: qual a linha editorial? Que tipo de oferta e tom transparecem? O que esse perfil transmite para quem vai fazer prospecção? Um único parágrafo (4-8 frases) com sua interpretação. NÃO liste posts nem copie legendas; interprete e conclua. Use APENAS o que foi fornecido; não invente. Separe ideias com ponto e vírgula (;). Ignore posts marcados como vídeo. Se não houver conteúdo suficiente, retorne string vazia."
                },
                {"role": "user", "content": text[:8000]}
            ],
            max_tokens=400,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        return _fallback_posts_text(posts)


def _fallback_posts_text(posts: list) -> str:
    out = []
    for i, p in enumerate((posts or [])[:20], 1):
        cap = (p.get("caption") or "").strip()[:100]
        img = (p.get("imageDesc") or "").strip()
        if img == "[vídeo ignorado]":
            out.append(f"Post {i}: [vídeo]")
        else:
            out.append(f"Post {i}: {cap} | {img[:80]}")
    return "; ".join(out)


def summarize_external_page(text: str) -> str:
    """Análise do conteúdo da página. Só usa o texto fornecido; não inventa."""
    try:
        from openai import OpenAI
    except ImportError:
        return (text or "")[:500] if (text or "").strip() else ""

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return (text or "")[:500] if (text or "").strip() else ""

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você analisou o link da bio/site do perfil. INTERPRETE o conteúdo: do que se trata o negócio; que informações são relevantes para quem vai fazer prospecção (oferta, contato, endereço)? Um parágrafo (3-6 frases) com sua síntese. Use APENAS o texto fornecido; não invente. NÃO copie trechos longos; conclua com suas palavras. Separe com ponto e vírgula (;). Se o texto for vazio ou irrelevante, retorne string vazia."
                },
                {"role": "user", "content": (text or "")[:6000]}
            ],
            max_tokens=350,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return (text or "")[:500] if (text or "").strip() else ""


def contextualizacao_prospeccao(data: dict) -> str:
    """Gera um único texto de contextualização da loja para prospecção/atendimento personalizado.
    Usa APENAS os campos fornecidos; não inventa. Objetivo: quem for atender entender a loja e personalizar a abordagem."""
    try:
        from openai import OpenAI
    except ImportError:
        return _contexto_fallback(data)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _contexto_fallback(data)

    parts = []
    if data.get("perfil"):
        parts.append(f"Perfil/bio: {data['perfil']}")
    if data.get("seguidores"):
        parts.append(f"Seguidores: {data['seguidores']}")
    if data.get("tema_da_loja"):
        parts.append(f"Tema/ramo: {data['tema_da_loja']}")
    if data.get("destaques"):
        parts.append(f"Destaques: {data['destaques']}")
    if data.get("link_externo_resumo"):
        parts.append(f"Link da bio/site: {data['link_externo_resumo']}")
    if data.get("unidades"):
        parts.append(f"Unidades/lojas: {data['unidades']}")
    if data.get("funcionarios"):
        parts.append(f"Funcionários: {data['funcionarios']}")

    text = "\n".join(parts).strip()
    if not text:
        return ""

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que acabou de abrir o perfil Instagram dessa loja/restaurante. Escreva UM único parágrafo (4-8 frases) com SUA LEITURA para um time de prospecção: quem é essa loja, como se posiciona, o que destacaria para quem vai fazer o primeiro contato. Conclusões e interpretação suas, baseadas apenas nos dados fornecidos. NÃO copie a bio nem o nome da página; NÃO invente dados. Separe ideias com ponto e vírgula (;). Se os dados forem insuficientes, seja breve ou retorne string vazia."
                },
                {"role": "user", "content": text[:6000]}
            ],
            max_tokens=450,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return _contexto_fallback(data)


def _contexto_fallback(data: dict) -> str:
    """Fallback sem IA: junta só o que foi passado, sem inventar."""
    parts = []
    if data.get("perfil"):
        parts.append(str(data["perfil"]))
    if data.get("tema_da_loja"):
        parts.append(str(data["tema_da_loja"]))
    if data.get("destaques"):
        parts.append(str(data["destaques"])[:300])
    if data.get("link_externo_resumo"):
        parts.append(str(data["link_externo_resumo"])[:200])
    if data.get("unidades"):
        parts.append(f"Unidades: {data['unidades']}")
    if data.get("funcionarios"):
        parts.append(f"Funcionários: {data['funcionarios']}")
    return "; ".join(parts) if parts else ""


def punch_line_abordagem(ultimo_post: str, ifood_context: dict = None) -> str:
    """Gera uma punch-line concisa que crie engajamento, vinculada ao que foi exposto no último post.
    Para uso por agente de outbound. Usa APENAS o que está no texto; não inventa."""
    try:
        from openai import OpenAI
    except ImportError:
        return (ultimo_post or "")[:250]

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or not (ultimo_post or "").strip():
        return (ultimo_post or "")[:250]

    ctx_block = _format_ifood_context(ifood_context or {})
    user_content = (ctx_block + "\n\nResumo do último post:\n" + (ultimo_post or "")) if ctx_block else (ultimo_post or "")

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que viu o último post. Sugira uma punch-line CONCISA (1-2 frases) para um agente abrir a conversa: um gancho baseado no que o post comunica (novidade, promoção, evento, prato). SUA proposta de abertura em prosa; NUNCA inclua @ ou nome de usuário; NUNCA copie a legenda. Use APENAS o que está no texto; não invente. Máximo 150 caracteres. Se o texto estiver vazio, retorne string vazia."
                },
                {"role": "user", "content": user_content[:1500]}
            ],
            max_tokens=120,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return (ultimo_post or "")[:250]


def _format_ifood_context(ctx: dict) -> str:
    if not ctx or not isinstance(ctx, dict):
        return ""
    parts = []
    if ctx.get("name"):
        parts.append(f"Nome do estabelecimento: {ctx.get('name')}")
    if ctx.get("cuisine"):
        parts.append(f"Tipo de cozinha (iFood): {ctx.get('cuisine')}")
    if ctx.get("regiao"):
        parts.append(f"Região: {ctx.get('regiao')}")
    if ctx.get("neighborhood"):
        parts.append(f"Bairro: {ctx.get('neighborhood')}")
    return "\n".join(parts).strip()


def summarize_store_conclusion(posts: list, ifood_context: dict = None) -> str:
    """Gera uma conclusão em um único parágrafo: tipo de estabelecimento e o que o cardápio/oferta abrange.
    Para uso por agente de outbound. Usa contexto iFood (nome, cozinha, região) quando fornecido."""
    if not posts or not isinstance(posts, list):
        return ""
    try:
        from openai import OpenAI
    except ImportError:
        return _fallback_conclusion(posts)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_conclusion(posts)

    lines = []
    for i, p in enumerate((posts or [])[:20], 1):
        cap = (p.get("caption") or "").strip()[:400]
        img = (p.get("imageDescription") or "").strip()[:300]
        if cap or img:
            lines.append(f"Post {i}: Legenda: {cap}. Imagem: {img}")
    text = "\n".join(lines)
    if not text.strip():
        return ""

    ctx_block = _format_ifood_context(ifood_context or {})
    user_content = (ctx_block + "\n\n---\n\nDados dos posts (legendas e imagens):\n\n" + text) if ctx_block else text

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você é um analista que viu os posts e o contexto do estabelecimento. Escreva UM único parágrafo com SUA CONCLUSÃO: que tipo de estabelecimento é e o que a oferta/cardápio transmite (comidas, bebidas, estilo). Síntese para quem vai ligar ou abordar, não enumeração de dados. NUNCA inclua @ ou nome de usuário do perfil; NUNCA copie trechos de legenda — apenas sua conclusão em prosa. Use o contexto iFood quando fornecido. Baseie-se APENAS no que foi fornecido; não invente. Separe ideias com ponto e vírgula (;)."
                },
                {"role": "user", "content": user_content[:12000]}
            ],
            max_tokens=450,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return _fallback_conclusion(posts)


def _fallback_conclusion(posts: list) -> str:
    parts = []
    for p in (posts or [])[:5]:
        cap = (p.get("caption") or "").strip()[:150]
        if cap:
            parts.append(cap)
    return "; ".join(parts)[:500] if parts else ""


def summarize_highlights_overview(highlights: list, ifood_context: dict = None) -> str:
    """Gera visão geral dos destaques com informações concretas (horários, unidades, etc.) para agente de outbound."""
    if not highlights or not isinstance(highlights, list):
        return ""
    try:
        from openai import OpenAI
    except ImportError:
        return _fallback_highlights(highlights)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _fallback_highlights(highlights)

    lines = []
    for h in highlights[:15]:
        title = (h.get("title") or "").strip() or "Sem título"
        descs = h.get("slideDescriptions") or h.get("descriptions") or []
        valid = [d for d in descs if isinstance(d, str) and d.strip()]
        slide_text = "; ".join(valid[:10])
        if title or slide_text:
            lines.append(f"Destaque \"{title}\": {slide_text}")
    text = "\n".join(lines)
    if not text.strip():
        return ""

    ctx_block = _format_ifood_context(ifood_context or {})
    user_content = (ctx_block + "\n\n---\n\nConteúdo dos destaques:\n\n" + text) if ctx_block else text

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você analisou os destaques do perfil (cada um com título e conteúdo dos slides). INTERPRETE: qual informação é útil para quem vai entrar em contato com a loja? (horários, unidades, promoções, cardápio, endereços.) Escreva um único parágrafo com sua conclusão. Ignore descrições genéricas como 'Foto do perfil de X' ou 'Photo by X'; use apenas trechos que tragam informação concreta. NÃO copie títulos literalmente; NUNCA inclua @ ou nome de usuário. Use APENAS o que foi fornecido; não invente. Separe ideias com ponto e vírgula (;)."
                },
                {"role": "user", "content": user_content[:8000]}
            ],
            max_tokens=450,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return _fallback_highlights(highlights)


def _fallback_highlights(highlights: list) -> str:
    parts = []
    for h in (highlights or [])[:8]:
        title = (h.get("title") or "").strip()
        descs = h.get("slideDescriptions") or h.get("descriptions") or []
        if title:
            parts.append(f"{title}: {'; '.join(str(d)[:80] for d in descs[:3])}")
    return "; ".join(parts)[:600] if parts else ""


def summarize_stories_overview(descriptions: list, ifood_context: dict = None) -> str:
    """Gera visão geral dos stories ativos (24h) para agente de outbound."""
    if not descriptions or not isinstance(descriptions, list):
        return ""
    try:
        from openai import OpenAI
    except ImportError:
        return "; ".join((str(d)[:100] for d in descriptions[:10] if d))

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return "; ".join((str(d)[:100] for d in descriptions[:10] if d))

    text = "\n".join(f"Story {i+1}: {d}" for i, d in enumerate(descriptions[:20]) if d and str(d).strip())
    if not text.strip():
        return ""

    ctx_block = _format_ifood_context(ifood_context or {})
    user_content = (ctx_block + "\n\n---\n\nConteúdo dos stories:\n\n" + text) if ctx_block else text

    client = OpenAI(api_key=api_key)
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Você analisou os stories ativos (24h) do perfil. INTERPRETE: o que a loja está comunicando agora? (promoções, novidades, produtos, eventos.) Conclusão em 2-5 frases para quem vai fazer prospecção. Não copie descrições; dê sua leitura do que importa. Use APENAS o que foi fornecido; não invente. Separe com ponto e vírgula (;)."
                },
                {"role": "user", "content": user_content[:6000]}
            ],
            max_tokens=300,
            timeout=OPENAI_TIMEOUT_SEC,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return "; ".join((str(d)[:100] for d in descriptions[:10] if d))


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print(json.dumps({"error": "JSON inválido no stdin"}))
        sys.exit(1)

    action = payload.get("action")
    out = {}

    if action == "analyze_images":
        paths = payload.get("paths") or []
        out["descriptions"] = analyze_images(paths)
    elif action == "summarize_theme":
        text = payload.get("text") or ""
        out["theme"] = summarize_theme(text)
    elif action == "summarize_last_post":
        out["summary"] = summarize_last_post(
            payload.get("caption", ""),
            payload.get("image_description", "")
        )
    elif action == "summarize_posts":
        out["summary"] = summarize_posts(payload.get("posts") or [])
    elif action == "summarize_external_page":
        out["summary"] = summarize_external_page(payload.get("text") or "")
    elif action == "contextualizacao_prospeccao":
        out["text"] = contextualizacao_prospeccao(payload.get("data") or {})
    elif action == "punch_line_abordagem":
        out["text"] = punch_line_abordagem(
            payload.get("ultimo_post") or "",
            payload.get("ifood_context") or {}
        )
    elif action == "summarize_store_conclusion":
        out["text"] = summarize_store_conclusion(
            payload.get("posts") or [],
            payload.get("ifood_context") or {}
        )
    elif action == "summarize_highlights_overview":
        out["text"] = summarize_highlights_overview(
            payload.get("highlights") or [],
            payload.get("ifood_context") or {}
        )
    elif action == "summarize_stories_overview":
        out["text"] = summarize_stories_overview(
            payload.get("descriptions") or [],
            payload.get("ifood_context") or {}
        )
    else:
        out["error"] = f"Ação desconhecida: {action}"

    print(json.dumps(out, ensure_ascii=False))

if __name__ == "__main__":
    main()
