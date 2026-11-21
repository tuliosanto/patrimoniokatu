# Nosso Patrimônio — contexto da rodada 2 (direção H travada)

**Trava:** em 2026-11-19 o casal escolheu H ("H, é esta"), depois de comparar A–J e as variações FH1–FH3. As demais direções estão encerradas. Arquivos da rodada 1 (com valores reais, fora do Git): `design/round-1/`.

## Ficha original de H (sem alterações)
- **Premissa:** o caminho desde 2021. A página começa no primeiro fechamento e desce em degraus até o total de hoje, grande e no fim.
- **Fontes:** Zodiak variável (Jérémie Hornus e equipe; Indian Type Foundry) para as duas pontas e o título. Amulya variável (Joana Correia; Indian Type Foundry), tnum, para listas. Licença ITF Free Font License: uso pessoal e comercial gratuito, sem compra; servidas pelo CDN da Fontshare (api.fontshare.com), sem redistribuir arquivos no repositório.
- **Hierarquia:** ponta inicial ~2,4vw itálico Zodiak 300; total final 12vw Zodiak 700, tracking −0,04em, entrelinha 0,9; listas Amulya 16–19px; rótulos 13px peso 500, tracking 0,04em.
- **Cor:** fundo #F4F1FA. Primária #2A1B3D para valores (~70%). Secundária #7C6A91 para rótulos (~22%). **Ajuste de acessibilidade na rodada 2:** #76648B (contraste 4,74:1; o original dava 4,35:1, abaixo da WCAG AA). Destaque #C2410C só no valor de hoje (~8%).
- **Espaço:** cada bloco recua mais 8vw, de 0 a 40vw; 9vh entre blocos; chegada alinhada à direita. No celular os recuos achatam para 4vw.
- **Relação-assinatura:** escada de recuos que termina no total de hoje.
- **Invariantes:** leitura do passado para o presente; laranja só para o agora.
- **Riscos registrados:** ordem invertida do resumo pode confundir; no celular os degraus se achatam.
- **Para a rodada 2:** linha do tempo como navegação principal; gráfico de evolução com a mesma direção.

## Constituição visual (para o app)
1. **Lei de composição:** o tempo desce. Toda tela que mostra história lê do mais antigo (topo, à esquerda) ao mais recente (embaixo, à direita). O valor atual é sempre o ponto de chegada.
2. **Degraus:** blocos recuam em passos fixos (8vw no desktop, máx. 40vw; 4vw no celular). O recuo é o único separador; não há caixas, cartões, bordas nem sombras como divisores.
3. **Duas vozes:** Zodiak = marcos (título do app, ponto de partida, valor de chegada, nomes de tela). Amulya = tudo que se lê ou digita (listas, formulários, rótulos, tabelas), sempre com algarismos tabulares.
4. **Cor:** ameixa #2A1B3D para dados; lilás-acinzentado #7C6A91 para rótulos e metadados; laranja #C2410C exclusivamente para "agora" (valor atual, mês aberto, ação principal do momento). Nunca laranja para erro ou decoração.
5. **Tema escuro:** derivado depois, preservando os papéis (fundo ameixa profundo, texto lilás claro, laranja mantido); exige aprovação.
6. **Formato brasileiro:** R$, ponto de milhar, vírgula decimal; percentuais com vírgula.
7. **Gráficos:** eixo do tempo da esquerda para a direita; o último ponto é o único em laranja; demais séries em tons de ameixa/lilás com contraste validado para daltonismo.
8. **Elementos não tipográficos** (linhas de gráfico, controles de formulário, foco) entram só onde a função exige, finos, na cor ameixa ou lilás; nenhum ícone decorativo.
9. **Acessibilidade:** WCAG 2.2 AA; foco visível; alvos de 44px; movimento reduzido respeitado.
10. **Proibido normalizar para:** cartões com sombra, painéis cinza de dashboard, azul SaaS, ícones em cada rótulo, gradientes, glassmorphism.

## Reabertura
Só com nova evidência, falha de acessibilidade/implementação, mudança de necessidade ou pedido explícito do casal.

## Ajuste decidido pelo casal (2026-11-19, depois de usar o app)
"Lindo, mas pouco funcional: preciso rolar muito." Decisão: cada tela vira um **painel de resumo** com o essencial de cara; listas longas ficam **abertas, em colunas**. Mantêm-se fontes, cores, o laranja só para o agora e a leitura do passado ao presente dentro dos blocos. A escada de recuos grandes e as pausas de 9vh deixam de ser regra; o total de hoje sobe para o topo do Início.

## Navegação entre módulos e análises (2026-11-20, pedido do casal)
- **Endereços com parâmetros:** cada tela lê `#/tela?…` (ex.: `#/carteira?ativo=…`, `#/mes?m=2026-03`, `#/analises?v=dividendos&de=…`). Um atalho abre a tela já no ponto certo; o destino pisca em lilás (`.alvo`).
- **Ficha do ativo** (painel lateral na Carteira): o ponto de encontro. Dela se lança (comprar, vender, resgatar, dividendo), se abre o gráfico do ativo, os últimos fechamentos (cada um leva ao Mês a mês) e o cadastro.
- **Mês a mês:** substitui as abas da planilha. Ano e mês em palavras; ← e → andam entre os fechamentos.
- **Análises:** um gráfico por vez, escolhido num menu de palavras; arrastar aproxima um trecho, tocar escolhe um mês, painel de consulta ao lado com resumo do trecho e perguntas rápidas.
- **Seletor de ativo:** busca por nome, código, banco ou corretora, filtro de classe em palavras e os usados há pouco no topo.
- **Cor de série 4:** #B0567F (validada; daltonismo na faixa 6–8, por isso sempre com rótulo direto no fim da linha). Elevação só no seletor flutuante (anel de 1px + sombra suave), por função.

## Fechar mês e Carteira (2026-11-20, decisão do casal)
- **Fechar mês = folha única.** Sem passos. No topo, o total ao vivo e o botão de confirmar; embaixo, a conferência por classe contra o **total do banco** (a forma como o casal confere). Itens de cada classe ficam recolhidos e só abrem quando se quer corrigir um preço ou um extrato. Total parcial aparece em lilás e diz o que falta. Revisar um mês já fechado pede confirmação, e a versão substituída vai para a cópia de segurança.
- **Carteira = mapa + detalhe.** À esquerda, as classes por grupo com o total (no celular, uma faixa de palavras); à direita, uma classe por vez, com colunas próprias por tipo (cotadas, CDB, demais). Colunas sem nenhum valor somem; o que falta cadastrar vira uma linha só, "Para completar". Fora do patrimônio e Arquivados viram entradas próprias.

## 2026-11-21 — H confirmada; combinações de cores
O casal comparou H e F com o app pronto e ficou com a H; a F foi retirada do código.
- A H ganhou combinações de cores em Ajustes › Cores, guardadas por aparelho (ou `?cores=` no endereço): Lilás (original), Areia, Sálvia, Névoa, Rosé e Noite (escura).
- Muda só a camada de papéis (`:root[data-cores=…]` em src/styles/index.css); estrutura, fontes e a regra de uma só cor para o "agora" ficam.
- Cada combinação: texto ≥ 4,5:1 sobre o fundo (rótulos também sobre o realce), texto dos botões = cor do fundo, séries dos gráficos validadas com o script da dataviz sobre o próprio fundo (claras com todos os pares; Noite com pares vizinhos, e as linhas de grupo levam rótulo direto).
- Botões, avisos e o véu das janelas passaram a usar tokens (--fundo, --dado-forte, --agora-forte, --sombra, --veu), sem cores fixas.
