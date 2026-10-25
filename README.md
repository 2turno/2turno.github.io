# Apuração 2º Turno — ao vivo

Painel da apuração presidencial em tempo real, direto dos dados públicos do TSE:
Brasil → estados → municípios → escolas → seções (boletim de urna decodificado no navegador).

- `?turno=1` mostra o 1º turno.
- Site 100% estático (GitHub Pages); o navegador consulta `resultados.tse.jus.br` diretamente.
- `public/locais/*.json`: locais de votação (nome, endereço, coordenadas), gerados por
  `node scripts/gerar-locais.mjs <pasta-dos-csv>` a partir dos dados abertos do TSE.

```
npm install
npm run dev
```
