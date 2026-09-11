# PL Ambiental Consultoria

Landing page institucional da **PL Ambiental**, consultoria ambiental corporativa que resolve a papelada ambiental de empresas — licenciamento, regularização fundiária, gestão hídrica e capacitação de equipes — para que indústrias, produtores rurais e prestadores de serviço evitem auto de infração, embargo e multa.

🔗 **Site publicado:** https://pl-ambiental.169-58-217-209.sslip.io/

## Sobre a empresa

A PL Ambiental atua como parceira técnica de conformidade ambiental, acompanhando o cliente do diagnóstico até a entrega documental, sem deixar o time interno perder o foco na operação.

### Serviços

**Gestão de Solo e Território**
- Cadastro Ambiental Rural (CAR) e Programa de Regularização Ambiental (PRA)
- Projeto de Recuperação de Áreas Degradadas (PRAD)
- Monitoramento de áreas por satélite
- Plano de Gerenciamento de Resíduos Sólidos (PGRS)
- Atendimento de condicionantes de licença
- Perícia ambiental
- Cadastro Técnico Federal (CTF/IBAMA)

**Água e Licenciamento**
- Outorga de Direito de Uso de Água
- Projetos de licenciamento ambiental
- Plano de Gerenciamento de Resíduos Líquidos (PGRL)
- Interpretação e planejamento de ETA e ETE
- Projeto de reuso de água residuária
- Monitoramento hídrico por satélite

**Capacitação e Cultura Ambiental**
- Capacitação de equipes
- Auditoria interna preventiva
- Educação ambiental em empresas e escolas
- Palestras técnicas

### Como funciona a parceria

1. **Diagnóstico** — levantamento da situação documental e operacional atual, apontando riscos e pendências reais.
2. **Plano de ação** — priorização do que precisa ser resolvido primeiro, com prazos ligados a condicionantes e órgãos envolvidos.
3. **Execução** — protocolo e interlocução técnica com o órgão ambiental até a resposta oficial.
4. **Entrega de conformidade** — documentação organizada e prazos futuros mapeados, para a próxima renovação não pegar ninguém de surpresa.
5. **Acompanhamento** — pós-venda com monitoramento contínuo de prazos e condicionantes.

### Diferenciais

- Tradução técnica das exigências do órgão ambiental — a PL Ambiental cumpre e documenta em vez de deixar o cliente decifrar sozinho.
- Foco em prevenção: evitar auto de infração, embargo e multa custa menos do que resolver depois.
- Controle de calendário de renovações (outorga, CAR, CTF/IBAMA), para o protocolo sair antes do vencimento.

## Sobre este repositório

O site roda como uma aplicação Node/Express (não é mais HTML estático puro),
porque tem uma seção **"Direto do Instagram"** — um carrossel de posts —
controlada por um **painel administrativo** próprio (login, publicar/editar/
excluir posts, upload de imagem). Por isso não é mais compatível com GitHub
Pages (que só serve arquivos estáticos); o deploy real roda em uma VPS via
Docker + Traefik.

### Stack

- Node.js + Express (servidor + API do painel)
- HTML, CSS e JavaScript puro no frontend (sem framework/build step)
- Ícones via [Lucide](https://lucide.dev/) (CDN)
- Fonte [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)
- Dados salvos em arquivo (`data/posts.json` + `data/uploads/`), sem banco de dados

### Estrutura

```
server.js               servidor Express (site estático + API do painel)
data/
  posts.json            posts do carrossel "Direto do Instagram"
  uploads/               imagens dos posts
public/
  index.html             página principal
  css/style.css
  js/main.js
  admin/                 painel administrativo (login + CRUD de posts)
  assets/                 logos e ícones da marca
Dockerfile
docker-compose.vps.yml   deploy via Docker + Traefik
```

### Rodando localmente

```bash
npm install
npm start
```

Site em `http://localhost:3000`, painel em `http://localhost:3000/admin`. Na
primeira execução, uma senha de acesso ao painel é gerada aleatoriamente e
impressa no terminal — troque em Configurações assim que possível. Para
definir a senha inicial você mesmo: `ADMIN_PASSWORD=suasenha npm start`.

### Deploy

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Assume um Traefik já rodando na rede Docker externa `proxy` (mesmo padrão
usado nos outros projetos desta conta). Ajuste o `Host()` do label do Traefik
em `docker-compose.vps.yml` para o domínio desejado.

## Contato

- WhatsApp: [fale conosco](https://wa.me/5585988010166)
- Instagram: [@plambientalconsultoria](https://www.instagram.com/plambientalconsultoria/)
