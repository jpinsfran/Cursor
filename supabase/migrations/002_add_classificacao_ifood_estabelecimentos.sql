ALTER TABLE ifood_estabelecimentos
ADD COLUMN IF NOT EXISTS classificacao INTEGER;

CREATE INDEX IF NOT EXISTS idx_ifood_estabelecimentos_regiao_classificacao
ON ifood_estabelecimentos(regiao, classificacao);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY regiao
      ORDER BY
        CASE
          WHEN regexp_replace(COALESCE(rating, ''), '[^0-9,.]', '', 'g') ~ '^[0-9]+([,.][0-9]+)?$'
            THEN REPLACE(regexp_replace(rating, '[^0-9,.]', '', 'g'), ',', '.')::numeric
          ELSE NULL
        END DESC NULLS LAST,
        name ASC,
        ifood_url ASC
    ) AS nova_classificacao
  FROM ifood_estabelecimentos
  WHERE regiao IS NOT NULL
    AND BTRIM(regiao) <> ''
)
UPDATE ifood_estabelecimentos AS destino
SET classificacao = ranked.nova_classificacao
FROM ranked
WHERE destino.id = ranked.id;
