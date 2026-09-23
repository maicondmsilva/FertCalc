# Aplicativo FertCalc Precificação — arquitetura e plano técnico

## Decisão de arquitetura

O aplicativo deve reutilizar a aplicação React existente e as mesmas funções de
cálculo, validações, permissões e serviços Supabase. A recomendação é empacotar a
variante de precificação com Capacitor para Android e iOS. Não será criada uma
segunda calculadora nativa, pois isso duplicaria regras críticas e permitiria que o
resultado da web divergisse do aplicativo.

A PWA continuará disponível e o sistema web completo não será limitado. A variável
de compilação `VITE_APP_VARIANT=pricing` produz uma variante que aceita somente
rotas do módulo de precificação. A compilação pode ser validada com
`npm run build:pricing-app`.

## Escopo inicial das lojas

- autenticação e recuperação de senha existentes;
- calculadora completa e simplificada;
- batidas salvas e produtos formulados;
- histórico, aprovações, metas e relatórios de precificação;
- listas, produtos, clientes e agentes conforme as permissões do usuário;
- notificações e chat quando disponíveis para o perfil;
- PDF e compartilhamento adaptados ao dispositivo.

Módulos de carregamento, cartão corporativo, relatórios gerenciais, configurações e
portal da transportadora permanecem fora do primeiro aplicativo. A restrição é
aplicada pela variante do aplicativo, além das permissões normais do usuário.

## Segurança e dados

- o Supabase continua sendo a fonte única da verdade;
- nenhuma chave de serviço pode integrar o pacote do aplicativo;
- RLS e RPCs continuam obrigatórias; ocultar uma tela não substitui autorização;
- tokens devem permanecer no armazenamento seguro oferecido pela camada nativa;
- links de recuperação precisam usar deep links aprovados para Android e iOS;
- o aplicativo não deve calcular ou salvar silenciosamente quando estiver offline;
- mensagens devem distinguir falta de conexão, falta de permissão e falha do servidor.

## Fases de implantação

### Fase 5A — Fundação compartilhada

- criar a variante de compilação exclusiva de precificação;
- impedir acesso a módulos fora do escopo sem alterar a versão web;
- abrir a calculadora como entrada padrão;
- documentar arquitetura, segurança, publicação e critérios de aceite.

### Fase 5B — Preparação móvel

- revisar calculadora, modais e PDFs em celular e tablet;
- tratar teclado virtual, áreas seguras, orientação e botão Voltar;
- adaptar downloads e compartilhamento de PDFs;
- adicionar estados claros de conexão e atualização.

### Fase 5C — Contêiner Android

- adicionar Capacitor e projeto Android;
- configurar identidade do pacote, ícones, splash screen e deep links;
- validar login, cálculo, salvamento, PDF, notificações e chat em aparelho real;
- gerar pacote interno assinado para homologação, sem publicar ainda.

### Fase 5D — Contêiner iOS

- gerar o projeto iOS em ambiente macOS com Xcode;
- configurar identidade, ícones, splash screen, deep links e permissões;
- repetir a homologação funcional em iPhone e iPad;
- gerar distribuição interna pelo TestFlight.

### Fase 5E — Publicação controlada

- preparar política de privacidade, descrição, capturas e classificação etária;
- cadastrar contas e chaves das lojas sob propriedade da empresa;
- executar piloto com usuários autorizados;
- publicar gradualmente e acompanhar falhas, desempenho e versão mínima.

## Dependências externas

A publicação Android exige uma conta Google Play Console e uma chave de assinatura
protegida. A publicação iOS exige Apple Developer, macOS, Xcode e certificados da
empresa. Essas credenciais não devem ser enviadas ao repositório nem compartilhadas
por mensagens.

## Critérios de aceite da Fase 5A

- a compilação web padrão mantém todos os módulos atuais;
- a variante de precificação abre diretamente a calculadora;
- URLs de outros módulos não liberam seu conteúdo na variante móvel;
- todas as páginas de precificação continuam respeitando permissões existentes;
- recuperação de senha permanece acessível;
- TypeScript, lint, testes e compilação das duas variantes são aprovados.
