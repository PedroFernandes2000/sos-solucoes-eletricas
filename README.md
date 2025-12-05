# ⚡ SOS Soluções Elétricas

## Bem-vindo!

SOS Soluções Elétricas é um site moderno e responsivo para uma empresa prestadora de serviços elétricos em Ubatuba e região. O projeto oferece uma plataforma completa para apresentar serviços, gerar contato via WhatsApp e coletar depoimentos de clientes.

---

## 🎯 Sobre o Projeto

Um website profissional construído com tecnologias modernas para conectar a empresa de eletricista com seus clientes. O site apresenta informações sobre serviços, depoimentos de clientes, seções sobre a empresa e um sistema de contato integrado com WhatsApp.

**Localização:** Ubatuba - São Paulo, Brasil  
**Propósito:** Apresentação de serviços elétricos residenciais e comerciais

---

## ✨ Principais Funcionalidades

- 🏠 **Landing Page Profissional** - Hero section atraente com call-to-action
- 🔧 **Catálogo de Serviços** - Exibição dos principais serviços oferecidos
- 💬 **Sistema de Depoimentos** - Feedback de clientes em tempo real
- 📱 **Design Responsivo** - Totalmente otimizado para mobile e desktop
- 🟢 **Integração WhatsApp** - Links diretos para contato via WhatsApp
- 💾 **Gerenciador de Comentários** - Backend para armazenar depoimentos com SQLite

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Estrutura semântica
- **Tailwind CSS** - Estilização utilitária moderna
- **Font Awesome** - Ícones profissionais
- **JavaScript Vanilla** - Interatividade

### Backend
- **Node.js + Express** - Servidor de API
- **SQLite3** - Banco de dados leve e portável
- **Netlify Functions** - Deploy serverless

---

## 📁 Estrutura do Projeto

```
sos-solucoes-eletricas/
├── public/                   # Arquivos estáticos
│   ├── index.html            # Página principal
│   └── img/                  # Imagens e ícones
├── netlify/
│   ├── functions/            # Funções serverless
|   └── comentarios.js        # API para gerenciar comentários
├── README.md                 # Este arquivo
└── .git/                     # Controle de versão
```

---

## 🚀 Como Começar

### Pré-requisitos

- Node.js (v14+ recomendado)
- npm ou yarn

### Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/PedroFernandes2000/sos-solucoes-eletricas.git
cd sos-solucoes-eletricas
```

2. **Instale as dependências:**
```bash
npm install
```

### Executar Localmente

1. **Inicie o servidor de comentários:**
```bash
node netlify/comentarios.js
```

2. **Abra o site:**
```bash
# Opção 1: Abra public/index.html diretamente no navegador
# Opção 2: Inicie um servidor local
```

3. **Acesse em seu navegador:**
```
http://localhost:8000/public/index.html
```

---

## 📋 Serviços Oferecidos

1. **Quadro de Distribuição**
   - Instalação e manutenção de quadros elétricos
   - Organização de circuitos
   - Substituição de disjuntores

2. **Portão Eletrônico**
   - Instalação de motores
   - Controles remotos
   - Sensores de segurança

3. **Ar Condicionado**
   - Instalação elétrica especializada
   - Disjuntores dedicados
   - Fiação adequada

4. **Outros Serviços**
   - Instalação residencial geral
   - Manutenção preventiva
   - Reparos de emergência

---

## 🔌 API de Comentários

### Endpoints Disponíveis

#### GET `/comentarios`
Retorna todos os comentários armazenados.

```bash
curl http://localhost:3000/comentarios
```

#### POST `/comentarios`
Cria um novo comentário.

```bash
curl -X POST http://localhost:3000/comentarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "mensagem": "Excelente atendimento!"
  }'
```

#### DELETE `/comentarios/:id`
Remove um comentário pelo ID.

```bash
curl -X DELETE http://localhost:3000/comentarios/1
```

### Dependências do Backend

- express
- sqlite3

Para instalar:
```bash
npm install express sqlite3
```

---

## 🎨 Design & Cores

O projeto utiliza um esquema de cores profissional:

- **Cor Primária:** #000000 (Preto)
- **Cor Secundária:** #FF8C00 (Laranja)
- **Cor de Destaque:** #FFA500 (Laranja Claro)
- **Verde Secundário:** #25D366 (WhatsApp)

---

## 📞 Contato & Links

- **WhatsApp:** [+55 12 99785-8600](https://wa.me/5512997858600)
- **Localização:** Ubatuba, São Paulo
- **Especialidade:** Serviços Elétricos Residenciais e Comerciais

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

## 📧 Suporte

Para dúvidas, entre em contato através do WhatsApp ou envie um email. Estamos aqui para ajudar!

---

**Desenvolvido com ⚡ por SOS Soluções Elétricas**