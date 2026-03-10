"""
Etapa 2 – IA: a partir do JSON extraído pelo scrapeInstagram.js,
gera perfil_do_lead (resumo único, tom de observador humano, sem copiar)
e punch_line (dica de abordagem ligada ao último post).
Usa Vision para descrever imagens dos posts quando image_paths estiverem presentes.

Regras: usar apenas o conteúdo fornecido; se insuficiente, retornar string vazia.
Não copiar trechos literais; sintetizar compreensão (operação, produtos, eventos, comportamento).
"""

import json
import os
import sys
import base64
from pathlib import Path

# Carrega .env para que OPENAI_API_KEY esteja disponível quando o script é chamado pelo Node
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(_env_path)
    load_dotenv()  # também o .env no cwd
except ImportError:
    pass

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_TIMEOUT = int(os.environ.get("OPENAI_TIMEOUT", "60"))


def load_extracao(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_image_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def describe_images_with_vision(paths: list) -> list:
    """Descreve cada imagem com Vision (para análise de negócio). Retorna lista de strings."""
    if not paths or OpenAI is None:
        return [""] * len(paths)
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return [""] * len(paths)
    client = OpenAI(api_key=api_key)
    results = []
    for p in paths:
        if not Path(p).exists():
            results.append("")
            continue
        try:
            b64 = load_image_base64(p)
            r = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Descreva de forma objetiva o que aparece na imagem para análise de negócio: pratos, produtos, ambiente, textos visíveis (cardápio, preços, ofertas), pessoas, cenário. Não invente nada; use só o que está visível. Se não houver conteúdo útil, retorne string vazia.",
                            },
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                        ],
                    }
                ],
                max_tokens=300,
                timeout=OPENAI_TIMEOUT,
            )
            text = (r.choices[0].message.content or "").strip()
            if "Foto do perfil de" in text or "Photo by" in text:
                text = ""
            results.append(text)
        except Exception:
            results.append("")
    return results


def build_prompt(extracao: dict, post_descriptions: list) -> str:
    """Monta o texto que será enviado à IA (sem inventar fora do extracao)."""
    parts = []
    parts.append("=== DADOS EXTRAÍDOS DO PERFIL (não inventar nada fora disso) ===\n")
    if extracao.get("bio"):
        parts.append(f"Bio: {extracao['bio']}\n")
    if extracao.get("seguidores"):
        parts.append(f"Seguidores: {extracao['seguidores']}\n")
    if extracao.get("seguindo"):
        parts.append(f"Seguindo: {extracao['seguindo']}\n")

    for h in extracao.get("highlights", [])[:20]:
        titulo = h.get("titulo", "")
        conteudo = h.get("conteudo_visivel") or []
        if isinstance(conteudo, list):
            conteudo = " | ".join(str(c) for c in conteudo[:50])
        parts.append(f"Destaque '{titulo}': {conteudo}\n")

    posts = extracao.get("posts_recentes", [])
    for i, p in enumerate(posts[:5]):
        legenda = p.get("legenda", "")
        desc_imagem = ""
        if i < len(post_descriptions) and post_descriptions[i]:
            desc_imagem = post_descriptions[i]
        if legenda or desc_imagem:
            parts.append(f"Post {i+1} (mais recente primeiro): Legenda: {legenda}")
            if desc_imagem:
                parts.append(f" | Descrição da imagem: {desc_imagem}")
            parts.append("\n")

    ifood = extracao.get("ifood_context") or {}
    if ifood:
        parts.append("\nContexto iFood (nome/cozinha/região): ")
        parts.append(json.dumps(ifood, ensure_ascii=False) + "\n")

    parts.append("\n=== INSTRUÇÕES ===\n")
    parts.append(
        "Gere em português, em tom afirmativo (para uso como guia de prospecção):\n"
        "1) perfil_do_lead: um único texto que AFIRME o que o estabelecimento é e faz, com base nos dados extraídos. "
        "Use frases diretas (ex.: \"É um restaurante de...\", \"A operação inclui...\", \"Os destaques mostram...\"). "
        "PROIBIDO usar: \"parece ser\", \"aparentemente\", \"sugere que\", \"indica que\". "
        "Não copie trechos literais; sintetize com certeza. Se não houver informação suficiente, deixe vazio.\n"
        "2) punch_line: uma dica OBJETIVA de como abordar o lead no primeiro contato, ligada ao último post. "
        "Formato: frase curta que o agente possa usar ou adaptar (ex.: \"Aborde mencionando a parceria com X\" ou \"Gancho: elogie o destaque em Y\"). "
        "PROIBIDO usar: \"Considere explorar\", \"Explore como\", \"Talvez\". Seja direto e acionável.\n"
        "Responda APENAS com JSON válido: {\"perfil_do_lead\":\"...\",\"punch_line\":\"...\"}\n"
    )
    return "".join(parts)


def call_openai(prompt: str) -> dict:
    if OpenAI is None:
        raise RuntimeError("Instale: pip install openai")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Defina OPENAI_API_KEY no ambiente.")
    client = OpenAI(api_key=api_key)
    r = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": "Você é um analista que produz guias de prospecção a partir de perfis Instagram. "
                "Escreva em tom AFIRMATIVO: diga o que o estabelecimento É e FAZ, sem hesitação (evite 'parece', 'sugere', 'aparentemente'). "
                "Na punch_line, dê uma dica DIRETA e acionável para o primeiro contato (evite 'Considere explorar' ou 'Talvez'). "
                "Use apenas o que foi fornecido; não invente. Se não houver base, retorne string vazia.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=1200,
        timeout=OPENAI_TIMEOUT,
    )
    text = (r.choices[0].message.content or "").strip()
    if "```" in text:
        for block in text.split("```"):
            block = block.strip()
            if block.startswith("json"):
                block = block[4:].strip()
            if block.startswith("{"):
                try:
                    return json.loads(block)
                except json.JSONDecodeError:
                    pass
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    return {"perfil_do_lead": "", "punch_line": ""}


def main():
    if len(sys.argv) < 2:
        print("Uso: python instagram_profile_ai.py <extracao.json>", file=sys.stderr)
        sys.exit(1)
    extracao_path = sys.argv[1]
    extracao = load_extracao(extracao_path)

    post_descriptions = []
    for post in extracao.get("posts_recentes", [])[:5]:
        paths = post.get("image_paths") or []
        if paths:
            descs = describe_images_with_vision(paths)
            post_descriptions.append(" ".join(d for d in descs if d).strip() if descs else "")
        else:
            post_descriptions.append("")

    prompt = build_prompt(extracao, post_descriptions)
    out = call_openai(prompt)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
