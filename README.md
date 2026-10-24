# Nosso Patrimônio

Controle de investimentos da família: fechamento mensal, carteira, relatórios e projeções.

- Site: https://tuliosanto.github.io/patrimoniokatu/
- Dados: Firestore (projeto `investimentos-katu`), acessíveis só pelas contas listadas em [`firestore.rules`](firestore.rules). **Nenhum dado financeiro fica neste repositório.**

## Desenvolvimento

```sh
npm install
npm run dev     # servidor local
npm test        # testes (cálculos, migração, leitura de números)
npm run build   # build de produção em dist/
```

Cada push em `main` roda os testes e publica no GitHub Pages (`.github/workflows/deploy.yml`).

## Estrutura

| Arquivo | O quê |
|---|---|
| `src/types.ts` | Modelo de dados (ativos, meses, config) |
| `src/calc.ts` | Rendimento, retorno no tempo (TWR), relatório anual, projeções |
| `src/migrate.ts` | Conversão do formato antigo (documento único) para o modelo por ativo |
| `src/store.ts` | Firebase: login, leitura em tempo real, cache offline, gravação, backup mensal |
| `src/ui/` | Telas (lit-html) e gráficos em SVG |

## Regras do Firestore

Ao mudar `firestore.rules`, cole o conteúdo em *Console do Firebase → Firestore Database → Regras* e publique.
