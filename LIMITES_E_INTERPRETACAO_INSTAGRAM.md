# Resumos Instagram: interpretação e limites

## O que foi alterado

Os prompts no `instagram_ai.py` foram reescritos para que o GPT **interprete** em vez de copiar:

- **Tema da loja**: conclusão sobre ramo e posicionamento; não repete nome da página.
- **Último post**: o que a loja está comunicando e que gancho dá para primeiro contato.
- **Posts (visão geral)**: linha editorial, tipo de oferta e tom; conclusão para prospecção.
- **Contextualização prospecção**: sua leitura de “quem é a loja” e o que destacar no primeiro contato.
- **Conclusão (estabelecimento)**: tipo de negócio e oferta; síntese para quem vai ligar/abordar.
- **Destaques**: informação útil para contato (horários, unidades, promoções); interpretação, não cópia de títulos.
- **Stories ativos**: o que a loja está comunicando agora; conclusão para prospecção.
- **Punch-line**: sugestão de gancho para abrir a conversa; não cópia da legenda.
- **Link externo (bio/site)**: síntese do conteúdo e do que é relevante para prospecção.
- **Imagens (Vision)**: descrição com foco no que importa para entender o negócio.

Tudo continua baseado **apenas** nos dados fornecidos (bio, legendas, descrições de imagens, etc.); o modelo não inventa dados que não estejam aí.

---

## O que o pipeline já analisa

| Fonte | Como é coletado | O que a IA recebe |
|-------|-----------------|-------------------|
| **Bio** | Scraper (Puppeteer) lê o texto do perfil | Texto da bio |
| **Posts** | Screenshot + Vision por imagem; legendas extraídas | Legenda + descrição de cada imagem |
| **Destaques** | Para cada destaque, abre cada slide → screenshot → Vision | Título do destaque + descrição de cada slide |
| **Stories ativos (24h)** | Abre `/stories/username`, percorre slides → screenshot → Vision | Descrições dos slides (quando há stories) |
| **Link da bio** | Acessa URL, extrai texto da página | Texto da página para resumo |

Ou seja: **cada destaque** e **cada story** são de fato analisados — o scraper abre, tira screenshot e o Python manda para o Vision; o texto resultante entra nos prompts de “destaques” e “stories”.

---

## Limitações (o que eu, o agente, não faço)

1. **Não abro o Instagram em tempo real**  
   Quem abre e coleta é o `scrapeInstagram.js` (Puppeteer). Eu só altero o código e os prompts; o GPT só vê o que esse fluxo já enviou (textos e descrições de imagens).

2. **Stories só existem se o scraper rodar enquanto houver story**  
   Stories somem em 24h. Se o script rodar depois, não há story para analisar.

3. **Qualidade da coleta**  
   Se o scraper não achar bio, não abrir um destaque ou a página travar, a IA não tem esse conteúdo para interpretar. Melhorar a cobertura depende do scraper (seletores, tempo de espera, etc.).

4. **Não inventamos dados**  
   Interpretação = conclusões a partir do que foi fornecido. Não preenchemos horário, número de unidades etc. se isso não tiver aparecido no material coletado.

---

## Como melhorar

- **Mais dados para a IA**: garantir que o scraper capture sempre bio, todos os destaques e, quando existir, os stories (por exemplo, rodar o pipeline com mais frequência para pegar stories).
- **Ajuste fino**: se algum resumo ainda sair genérico ou “copiado”, dá para endurecer o prompt dessa função em `instagram_ai.py` (ex.: “nunca incluir o nome do perfil na primeira frase”).
- **Outros canais**: se você tiver mais fontes (ex.: resposta de API oficial, outro scraper), podemos encaixar no mesmo fluxo e pedir à IA que interprete também esses dados.
