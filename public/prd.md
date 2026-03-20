# FertCalc Pro — Documento de Requisitos do Produto (PRD)

## 1. Introdução

Este Documento de Requisitos do Produto (PRD) detalha as funcionalidades e o comportamento esperado do sistema FertCalc Pro. Ele serve como um guia abrangente para desenvolvimento, testes e comunicação com as partes interessadas, garantindo que o produto final atenda às necessidades de negócio e dos usuários.

## 2. Visão Geral do Produto

O FertCalc Pro é uma plataforma robusta para otimização da precificação e gestão de vendas de fertilizantes. Seu objetivo é simplificar processos complexos de cálculo, centralizar informações de clientes e agentes, e fornecer insights acionáveis através de relatórios e acompanhamento de metas.

### 2.1. Objetivos de Negócio

*   Aumentar a eficiência no processo de precificação de fertilizantes.
*   Reduzir erros manuais nos cálculos e na gestão de dados.
*   Melhorar a visibilidade sobre o desempenho de vendas e o cumprimento de metas.
*   Centralizar dados de clientes, agentes e listas de preço para facilitar o acesso e a gestão.
*   Fornecer ferramentas para uma tomada de decisão mais estratégica.

### 2.2. Público-Alvo

*   **Vendedores:** Utilizam a calculadora para precificar, gerenciam suas vendas e acompanham suas metas.
*   **Gerentes de Vendas:** Supervisionam equipes, aprovam precificações, definem metas e analisam relatórios de desempenho.
*   **Administradores:** Gerenciam usuários, filiais, configurações do sistema e têm acesso total aos dados e relatórios.
*   **Diretoria/Gestão:** Acompanham indicadores de alto nível e relatórios estratégicos.

## 3. Módulos e Funcionalidades Detalhadas

O sistema é dividido em dois módulos principais: **Precificação** e **Configuração**, além do módulo **PRD** para documentação.

### 3.1. Módulo de Precificação

Este módulo é o coração do sistema, focado nas operações de vendas e precificação.

#### 3.1.1. Dashboard

*   **Descrição:** Visão geral personalizada para o usuário logado, exibindo métricas chave de vendas, metas e status de aprovações.
*   **Funcionalidades:**
    *   Exibição de vendas totais no período (semana, mês, ano).
    *   Progresso em relação às metas individuais ou da equipe (para gerentes/administradores).
    *   Notificações de aprovações pendentes ou concluídas.
    *   Atalhos rápidos para a calculadora e histórico.

#### 3.1.2. Calculadora de Preços

*   **Descrição:** Ferramenta interativa para construir fórmulas de fertilizantes e calcular o preço final com base em uma série de fatores.
*   **Funcionalidades:**
    *   **Seleção de Matérias-Primas:** Adicionar macros (N, P, K, S, Ca) e micros (outros nutrientes) de listas pré-definidas.
    *   **Definição de Quantidades:** Inserir a quantidade (em kg) de cada matéria-prima.
    *   **Cálculo da Fórmula:** O sistema calcula automaticamente a composição NPK e outros nutrientes resultantes.
    *   **Fatores de Precificação:**
        *   **Fator:** Multiplicador aplicado ao custo base das matérias-primas.
        *   **Desconto (R$):** Valor fixo de desconto aplicado ao preço total.
        *   **Margem (R$):** Valor fixo de margem adicionado ao custo.
        *   **Frete (R$):** Custo de frete por tonelada ou valor total.
        *   **Imposto (%):** Percentual de imposto sobre o valor da venda.
        *   **Comissão (%):** Percentual de comissão sobre o valor da venda (calculado sobre o preço final antes de impostos).
        *   **Juros Mensais (%):** Taxa de juros aplicada ao valor total da venda, baseada na data de vencimento.
        *   **Data de Vencimento:** Data para cálculo dos juros.
        *   **Isentar Mês Atual:** Opção para não aplicar juros no mês corrente.
        *   **Cliente:** Seleção de cliente cadastrado.
        *   **Agente:** Seleção de agente de vendas cadastrado.
        *   **Filial:** Seleção da filial de origem da precificação.
        *   **Lista de Preço:** Seleção da lista de preço base para as matérias-primas.
        *   **Total de Toneladas:** Quantidade total de fertilizante a ser precificado.
        *   **Observação Comercial:** Campo de texto livre para anotações.
    *   **Resumo da Precificação:** Exibição em tempo real dos resultados:
        *   Peso Total (kg)
        *   Custo Base (R$)
        *   Preço Base (R$)
        *   Valor dos Juros (R$)
        *   Valor do Imposto (R$)
        *   Valor da Comissão (R$)
        *   Valor do Frete (R$)
        *   Preço Final por Tonelada (R$)
        *   Valor Total da Venda (R$)
        *   NPK Resultante e Micros Resultantes.
    *   **Ações:** Salvar precificação, solicitar aprovação (se necessário), imprimir.
*   **Lógica de Cálculo (Exemplo Simplificado):**
    1.  **Custo Base MP:** Soma (quantidade MP * preço MP) para todas as matérias-primas.
    2.  **Custo Total:** Custo Base MP + Frete.
    3.  **Preço Base:** Custo Total * Fator + Margem.
    4.  **Desconto Aplicado:** Preço Base - Desconto (R$).
    5.  **Juros:** (Desconto Aplicado * Juros Mensais) / 100, proporcional aos meses até o vencimento (se não isento).
    6.  **Preço de Venda (antes Imposto/Comissão):** Desconto Aplicado + Juros.
    7.  **Comissão:** Preço de Venda * (Comissão / 100).
    8.  **Imposto:** Preço de Venda * (Taxa de Imposto / 100).
    9.  **Preço Final Total:** Preço de Venda + Imposto + Comissão.
    10. **Preço Final por Tonelada:** Preço Final Total / Total de Toneladas.

#### 3.1.3. Histórico de Precificações

*   **Descrição:** Lista todas as precificações salvas, permitindo consulta, edição e acompanhamento de status.
*   **Funcionalidades:**
    *   Listagem paginada e filtrável por cliente, agente, status (Em Andamento, Fechada, Perdida), data.
    *   Visualização detalhada de cada precificação (macros, micros, fatores, resumo).
    *   Opção para reabrir uma precificação para edição.
    *   Mudança de status (Fechada, Perdida).
    *   Acompanhamento do histórico de alterações da precificação.

#### 3.1.4. Listas de Preço

*   **Descrição:** Gerencia as listas de preço das matérias-primas por filial.
*   **Funcionalidades:**
    *   Criação e edição de listas de preço.
    *   Associação de matérias-primas (macros e micros) às listas.
    *   Definição de preço unitário e garantias para cada matéria-prima.
    *   Importação/Exportação de listas de preço.

#### 3.1.5. Clientes

*   **Descrição:** Cadastro e gestão de informações de clientes da empresa.
*   **Funcionalidades:**
    *   Criação, edição e exclusão de clientes.
    *   Campos: Código, Nome, Documento (CPF/CNPJ), E-mail, Telefone, Inscrição Estadual, Fazenda, Endereço.
    *   Busca e filtragem de clientes.

#### 3.1.6. Agentes

*   **Descrição:** Cadastro e gestão de informações dos agentes de vendas.
*   **Funcionalidades:**
    *   Criação, edição e exclusão de agentes.
    *   Campos: Código, Nome, Documento, E-mail, Telefone, Inscrição Estadual, Endereço.
    *   Busca e filtragem de agentes.

#### 3.1.7. Metas

*   **Descrição:** Definição e acompanhamento de metas de vendas para usuários ou equipes.
*   **Funcionalidades:**
    *   Criação de metas mensais ou anuais por usuário.
    *   Definição de valor alvo da meta.
    *   Acompanhamento do progresso da meta em tempo real (realizado vs. alvo).
    *   Status de aprovação de metas (Pendente, Aprovada, Reprovada).

#### 3.1.8. Aprovações

*   **Descrição:** Centraliza as solicitações de aprovação de precificações que excedem limites de desconto/margem.
*   **Funcionalidades:**
    *   Listagem de todas as precificações com status 'Pendente de Aprovação'.
    *   Visualização detalhada da precificação para análise.
    *   Opções para Aprovar ou Reprovar a solicitação.
    *   Registro de comentários na aprovação/reprovação.
    *   Notificações para o solicitante sobre o status da aprovação.

#### 3.1.9. Relatórios

*   **Descrição:** Geração de relatórios analíticos sobre vendas, desempenho e comissões.
*   **Funcionalidades:**
    *   **Relatório de Precificação:** Detalhes sobre precificações realizadas, rentabilidade, descontos médios.
    *   **Relatório de Comissão:** Cálculo de comissões devidas por agente/vendedor.
    *   Filtros por período, cliente, agente, filial, status.
    *   Exportação para PDF/Excel.

### 3.2. Módulo de Configuração

Este módulo é responsável pela administração e personalização do sistema.

#### 3.2.1. Usuários

*   **Descrição:** Gerenciamento completo de usuários do sistema.
*   **Funcionalidades:**
    *   Criação, edição e exclusão de usuários.
    *   Definição de Nível de Acesso (Vendedor, Gerente, Administrador, Master).
    *   Atribuição de Permissões de Módulo granular para cada usuário.
    *   Redefinição de senha.

#### 3.2.2. Filiais

*   **Descrição:** Cadastro e gestão das filiais da empresa.
*   **Funcionalidades:**
    *   Criação, edição e exclusão de filiais.
    *   Associação de usuários e listas de preço às filiais.

#### 3.2.3. Personalização

*   **Descrição:** Configurações gerais do sistema.
*   **Funcionalidades:**
    *   Configuração do nome e logo da empresa.
    *   Definição de CNPJ da empresa.
    *   Edição dos termos de precificação (texto que aparece em propostas/documentos).

### 3.3. Módulo PRD (Documentação do Produto)

*   **Descrição:** Acesso à documentação completa do Produto (este documento).
*   **Funcionalidades:**
    *   Exibição do PRD em formato Markdown.
    *   Conteúdo atualizável conforme a evolução do sistema.

## 4. Requisitos Não Funcionais

*   **Desempenho:**
    *   Tempo de resposta da interface do usuário: < 2 segundos para 90% das interações.
    *   Tempo de carregamento de relatórios complexos: < 5 segundos.
*   **Segurança:**
    *   Autenticação de usuário via e-mail e senha.
    *   Autorização baseada em funções (RBAC) e permissões granulares.
    *   Proteção contra ataques comuns (XSS, CSRF, injeção de SQL/NoSQL).
    *   Criptografia de senhas de usuários.
*   **Usabilidade (UX/UI):**
    *   Interface intuitiva e responsiva para diferentes dispositivos (desktop, tablet, mobile).
    *   Consistência visual e de interação em todo o sistema.
    *   Mensagens de erro e feedback claros para o usuário.
*   **Manutenibilidade:**
    *   Código modular, bem estruturado e com comentários adequados.
    *   Cobertura de testes automatizados (unitários, integração).
    *   Facilidade de implantação e atualização.
*   **Escalabilidade:**
    *   Capacidade de suportar um número crescente de usuários e volume de dados sem degradação significativa de desempenho.
    *   Arquitetura que permita a adição de novas funcionalidades com impacto mínimo.
*   **Confiabilidade:**
    *   Alta disponibilidade do sistema (uptime > 99.9%).
    *   Mecanismos de backup e recuperação de dados.

## 5. Tecnologias (Sugestões)

*   **Frontend:** React, TypeScript, Tailwind CSS, Recharts (para gráficos).
*   **Backend:** Node.js (Express), TypeScript.
*   **Banco de Dados:** MongoDB (NoSQL) ou PostgreSQL (SQL) - a definir.
*   **Autenticação:** JWT (JSON Web Tokens).

## 6. Próximos Passos

*   Refinamento dos requisitos em sessões de grooming com a equipe.
*   Criação de wireframes e protótipos de alta fidelidade para as principais telas.
*   Definição de um backlog priorizado para as próximas sprints.
*   Implementação e testes contínuos.

---

**Versão:** 1.1.0
**Data:** 25 de Fevereiro de 2026
**Autor:** Equipe de Desenvolvimento FertCalc Pro
