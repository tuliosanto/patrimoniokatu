# Nosso Patrimônio

Os investimentos da família, mês a mês: lançamentos (aporte, compra, venda, resgate, transferência, retirada, dividendo),
fechamento guiado do mês com cotações automáticas e conferência com o banco, carteira com preço médio,
análises com gráficos, metas de alocação e meta de patrimônio.

- Site e app instalável (PWA): https://tuliosanto.github.io/patrimoniokatu/ — no Chrome/Edge/Safari, "Instalar app" / "Adicionar à Tela de Início".
- Dados: Firestore (projeto `investimentos-katu`), acessíveis só pelas contas listadas em [`firestore.rules`](firestore.rules). **Nenhum dado financeiro fica neste repositório.**
- Visual: direção H, travada em [`design/ROUND-2-CONTEXT.md`](design/ROUND-2-CONTEXT.md). Fontes Zodiak e Amulya (Indian Type Foundry, licença ITF FFL, servidas pela Fontshare).

## Desenvolvimento

```sh
npm install
npm run dev     # servidor local
npm test        # testes (preço médio, totais, importação, rentabilidade, formatos)
npm run build   # build de produção em dist/
```

Modo de demonstração (só em desenvolvimento, sem login e sem tocar na nuvem), com o histórico local:

```sh
DEMO_HISTORICO=/caminho/para/historico-consolidado.json npm run dev
# abrir http://localhost:5173/patrimoniokatu/?demo
```

Cada push em `main` roda os testes e publica no GitHub Pages (`.github/workflows/deploy.yml`).

## Estrutura

| Pasta | O quê |
|---|---|
| `src/domain/` | Modelo de dados e cálculos puros, com testes: carteira (posição, preço médio, totais, metas), histórico (rendimento, TWR, projeção), importação da planilha |
| `src/data/` | Firebase (login, leitura em tempo real, cache offline, gravação, backup) e cotações (PTAX, CDI, CoinGecko, brapi) |
| `src/app/` | Telas em React: Início, Lançar, Fechar mês, Carteira, Análises, Metas, Ajustes |
| `src/components/ui/` | Componentes acessíveis (shadcn/ui sobre Radix), redesenhados na direção H |
| `src/styles/index.css` | Tokens de design (primitivos → papéis → componentes) e Tailwind |

## Regras do Firestore

O 3.0 usa coleções novas (`v3_*`); as do 2.0 ficam só para leitura, como cópia.
Ao mudar `firestore.rules`, cole o conteúdo em *Console do Firebase → Firestore Database → Regras* e publique.
