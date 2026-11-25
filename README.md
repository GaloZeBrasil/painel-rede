# Painel da rede Galo Zé

Site estático do painel da franqueadora (visão geral + modo TV).

- `index.html` — a página. Abra com `#tv` no fim do endereço para ir direto ao modo TV.
- `data/` — os números. As tarefas agendadas substituem estes arquivos:
  - `vendas.csv` — unidade, mês, loja/iFood/99Food (valor e pedidos), total e dias cobertos.
  - `unidades.csv` — notas Google/iFood, promoções, posts do Instagram.
  - `hoje.csv` — vendas do dia por unidade e canal.
  - `hoje_entrega.csv` — tempo dos pedidos delivery do dia.
- `dash.js` — lê os CSV e desenha a página; recarrega os dados a cada 5 minutos.
- `tv.js`, `tv2.js`, `tv.css` — modo TV.

A meta do mês fica em `tv2.js` (`GZ_META_CRESC`, em %).
